import {
  searchRecords,
  getRecord,
  toLang3,
  type CatalogRecord,
  type SearchResults,
  type FieldFilters,
} from "@geonetwork-ui/metadata-converter";
import type { Geometry } from "geojson";

export interface GeoNetworkConfig {
  baseUrl: string;
  lang?: string;
}

export class GeoNetworkClient {
  private gnUrl: string;
  private lang: string;
  private fetchFn: typeof fetch;

  constructor(config: GeoNetworkConfig) {
    this.gnUrl = config.baseUrl.replace(/\/+$/, "");
    this.lang = config.lang ?? "fr";

    const lang3 = toLang3(this.lang);
    this.fetchFn = (url: string | URL | Request, init?: RequestInit) => {
      return fetch(url, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string>),
          Accept: "application/json",
          "Accept-Language": lang3,
        },
      });
    };
  }

  async search(params: {
    query?: string;
    type?: string;
    organization?: string;
    bbox?: string;
    from?: number;
    size?: number;
  }): Promise<SearchResults> {
    const filters: FieldFilters = {};
    if (params.type) {
      filters.resourceType = params.type;
    }
    if (params.organization) {
      filters.OrgForResource = params.organization;
    }

    let geometry: Geometry | undefined;
    if (params.bbox) {
      const [west, south, east, north] = params.bbox.split(",").map(Number);
      if ([west, south, east, north].every((n) => !isNaN(n))) {
        geometry = {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        };
      }
    }

    return searchRecords({
      gnUrl: this.gnUrl,
      query: params.query,
      filters,
      from: params.from ?? 0,
      size: params.size ?? 20,
      geometry,
      language: this.lang,
      fetchFn: this.fetchFn,
    });
  }

  async getRecord(uuid: string): Promise<CatalogRecord | null> {
    return getRecord(uuid, {
      gnUrl: this.gnUrl,
      language: this.lang,
      fetchFn: this.fetchFn,
    });
  }
}

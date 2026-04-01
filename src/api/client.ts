import type {
  GeoNetworkConfig,
  SearchResult,
  RecordSummary,
  GeoNetworkRecord,
  Resource,
  Contact,
  BoundingBox,
} from "../types/geonetwork.js";
import { buildSearchQuery, type SearchParams } from "./search.js";

const DEFAULT_TIMEOUT = 30_000;

export class GeoNetworkClient {
  private baseUrl: string;
  private lang: string;
  private timeout: number;

  constructor(config: GeoNetworkConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.lang = config.lang ?? "fre";
    this.timeout = config.fetchTimeout ?? DEFAULT_TIMEOUT;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchWithTimeout(
    url: string,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  private get defaultHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Language": this.lang,
    };
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const url = `${this.baseUrl}/srv/api/search/records/_search?bucket=bucket`;
    const body = buildSearchQuery({ ...params, lang: this.lang });

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Erreur recherche GeoNetwork: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseSearchResult(data);
  }

  async getRecord(uuid: string): Promise<GeoNetworkRecord> {
    const url = `${this.baseUrl}/srv/api/search/records/_search?bucket=bucket`;
    const body = {
      query: {
        bool: {
          must: [{ term: { uuid } }],
          filter: [{ terms: { isTemplate: ["n"] } }],
        },
      },
      size: 1,
    };

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Erreur GeoNetwork: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const hits = (data.hits as Record<string, unknown>)?.hits as
      | Record<string, unknown>[]
      | undefined;

    if (!hits || hits.length === 0) {
      throw new Error(`Fiche '${uuid}' non trouvée dans le catalogue.`);
    }

    const source = hits[0]._source as Record<string, unknown>;
    return this.parseFullRecord(source);
  }

  async getRecordResources(uuid: string): Promise<Resource[]> {
    const record = await this.getRecord(uuid);
    return record.resources;
  }

  private parseSearchResult(data: Record<string, unknown>): SearchResult {
    const hitsObj = data.hits as Record<string, unknown>;
    const total =
      typeof hitsObj.total === "object"
        ? ((hitsObj.total as Record<string, unknown>).value as number)
        : (hitsObj.total as number);

    const hits = (hitsObj.hits as Record<string, unknown>[]) ?? [];

    const records: RecordSummary[] = hits.map((hit) => {
      const source = hit._source as Record<string, unknown>;
      return this.parseRecordSummary(source);
    });

    return { total, records };
  }

  private parseRecordSummary(source: Record<string, unknown>): RecordSummary {
    return {
      uuid: (source.uuid as string) ?? "",
      title: this.extractLocalizedText(source.resourceTitleObject),
      abstract: this.extractLocalizedText(source.resourceAbstractObject),
      type: this.extractFirstValue(source.resourceType) ?? "dataset",
      keywords: this.extractTags(source.tag),
      organization: this.extractFirstValue(source.OrgForResource) ?? "",
      thumbnailUrl: this.extractThumbnail(source.overview),
      updateDate: source.changeDate as string | undefined,
    };
  }

  private parseFullRecord(source: Record<string, unknown>): GeoNetworkRecord {
    const summary = this.parseRecordSummary(source);

    return {
      ...summary,
      topicCategories: this.extractArray(source.cl_topic),
      constraints: this.extractConstraints(source),
      lineage: this.extractLocalizedText(source.lineageObject) || undefined,
      spatialExtent: this.extractBbox(source.geom),
      temporalExtent: this.extractTemporalExtent(source),
      contacts: this.extractContacts(source),
      resources: this.extractResources(source.link),
      raw: source,
    };
  }

  private extractLocalizedText(obj: unknown): string {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    if (typeof obj !== "object") return String(obj);

    const record = obj as Record<string, unknown>;
    // Try the configured language first, then default, then any available
    return (
      (record[`lang${this.lang}`] as string) ??
      (record.default as string) ??
      (Object.values(record).find((v) => typeof v === "string" && v) as
        | string
        | undefined) ??
      ""
    );
  }

  private extractFirstValue(obj: unknown): string | undefined {
    if (!obj) return undefined;
    if (typeof obj === "string") return obj;
    if (Array.isArray(obj)) return obj[0] as string | undefined;
    return String(obj);
  }

  private extractTags(tags: unknown): string[] {
    if (!tags) return [];
    if (!Array.isArray(tags)) return [];
    return tags
      .map((tag) => {
        if (typeof tag === "string") return tag;
        if (typeof tag === "object" && tag !== null) {
          return this.extractLocalizedText(tag);
        }
        return "";
      })
      .filter(Boolean);
  }

  private extractThumbnail(overview: unknown): string | undefined {
    if (!overview) return undefined;
    const arr = Array.isArray(overview) ? overview : [overview];
    const first = arr[0] as Record<string, unknown> | undefined;
    return first?.url as string | undefined;
  }

  private extractArray(obj: unknown): string[] {
    if (!obj) return [];
    if (Array.isArray(obj)) {
      return obj
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null) {
            const rec = item as Record<string, unknown>;
            return (rec.default as string) ?? (rec.key as string) ?? "";
          }
          return "";
        })
        .filter(Boolean);
    }
    if (typeof obj === "string") return [obj];
    return [];
  }

  private extractConstraints(source: Record<string, unknown>): string[] {
    const constraints: string[] = [];
    for (const key of [
      "cl_accessConstraints",
      "MD_LegalConstraintsUseLimitationObject",
      "licenseObject",
    ]) {
      const val = source[key];
      if (val) {
        const texts = Array.isArray(val) ? val : [val];
        for (const t of texts) {
          const text = this.extractLocalizedText(t);
          if (text) constraints.push(text);
        }
      }
    }
    return constraints;
  }

  private extractBbox(geom: unknown): BoundingBox | undefined {
    if (!geom) return undefined;
    // GN4 stores geom as GeoJSON; extract bounding box from coordinates
    try {
      const geometry = geom as Record<string, unknown>;
      const type = geometry.type as string;
      const coordinates = geometry.coordinates as number[][][] | number[][][][];

      if (!coordinates) return undefined;

      // Flatten all coordinates
      const flat: number[][] = [];
      const flatten = (arr: unknown): void => {
        if (
          Array.isArray(arr) &&
          arr.length === 2 &&
          typeof arr[0] === "number"
        ) {
          flat.push(arr as number[]);
        } else if (Array.isArray(arr)) {
          for (const item of arr) flatten(item);
        }
      };

      if (type === "Point") {
        const coords = geometry.coordinates as number[];
        return {
          west: coords[0],
          south: coords[1],
          east: coords[0],
          north: coords[1],
        };
      }

      flatten(coordinates);
      if (flat.length === 0) return undefined;

      return {
        west: Math.min(...flat.map((c) => c[0])),
        south: Math.min(...flat.map((c) => c[1])),
        east: Math.max(...flat.map((c) => c[0])),
        north: Math.max(...flat.map((c) => c[1])),
      };
    } catch {
      return undefined;
    }
  }

  private extractTemporalExtent(
    source: Record<string, unknown>
  ): string | undefined {
    const start = source.resourceTemporalDateRange;
    if (!start) return undefined;

    if (Array.isArray(start) && start.length > 0) {
      const range = start[0] as Record<string, unknown>;
      const gte = (range.gte as string) ?? "";
      const lte = (range.lte as string) ?? "";
      if (gte || lte) return `${gte || "?"} - ${lte || "?"}`;
    }

    return undefined;
  }

  private extractContacts(source: Record<string, unknown>): Contact[] {
    const contacts: Contact[] = [];
    for (const key of ["contact", "contactForResource"]) {
      const val = source[key];
      if (!val) continue;
      const arr = Array.isArray(val) ? val : [val];
      for (const c of arr) {
        const contact = c as Record<string, unknown>;
        contacts.push({
          name: (contact.individual as string) ?? undefined,
          organization: (contact.organisation as string) ?? "",
          role: (contact.role as string) ?? "",
          email: (contact.email as string) ?? undefined,
        });
      }
    }
    return contacts;
  }

  private extractResources(links: unknown): Resource[] {
    if (!links) return [];
    const arr = Array.isArray(links) ? links : [links];

    return arr.map((link) => {
      const l = link as Record<string, unknown>;
      return {
        url: (l.urlObject as Record<string, unknown>)?.default as string
          ?? (l.url as string)
          ?? "",
        protocol: (l.protocol as string) ?? "",
        name: this.extractLocalizedText(l.nameObject) || (l.name as string) || undefined,
        description:
          this.extractLocalizedText(l.descriptionObject) ||
          (l.description as string) ||
          undefined,
        function: (l.function as string) ?? undefined,
        applicationProfile: (l.applicationProfile as string) ?? undefined,
      };
    });
  }
}

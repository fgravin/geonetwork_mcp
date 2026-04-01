export interface GeoNetworkConfig {
  baseUrl: string;
  lang?: string;
  fetchTimeout?: number;
}

export interface SearchResult {
  total: number;
  records: RecordSummary[];
}

export interface RecordSummary {
  uuid: string;
  title: string;
  abstract: string;
  type: string;
  keywords: string[];
  organization: string;
  thumbnailUrl?: string;
  updateDate?: string;
}

export interface GeoNetworkRecord extends RecordSummary {
  topicCategories: string[];
  constraints: string[];
  lineage?: string;
  spatialExtent?: BoundingBox;
  temporalExtent?: string;
  contacts: Contact[];
  resources: Resource[];
  raw?: Record<string, unknown>;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Contact {
  name?: string;
  organization: string;
  role: string;
  email?: string;
}

export interface Resource {
  url: string;
  protocol: string;
  name?: string;
  description?: string;
  function?: string;
  applicationProfile?: string;
}

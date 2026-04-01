/**
 * ElasticSearch query builder aligned with geonetwork-ui patterns.
 * Replicates the query structure from GNUI's ElasticsearchService.
 * @see https://github.com/geonetwork/geonetwork-ui/blob/main/libs/api/repository/src/lib/gn4/elasticsearch
 */

export interface SearchParams {
  query?: string;
  type?: string;
  organization?: string;
  bbox?: string;
  from?: number;
  size?: number;
  lang?: string;
}

// Same _source fields as GNUI's ES_SOURCE_SUMMARY
const ES_SOURCE_SUMMARY = [
  "uuid",
  "id",
  "title",
  "resource*",
  "resourceTitleObject",
  "resourceAbstractObject",
  "overview",
  "logo",
  "link",
  "linkProtocol",
  "contactForResource*.organisation*",
  "contact*.organisation*",
  "contact*.email",
  "userSavedCount",
  "cl_topic",
  "cl_maintenanceAndUpdateFrequency",
  "cl_presentationForm",
  "MD_LegalConstraints*Object",
  "qualityScore",
  "allKeywords",
  "recordLink",
];

// Boosted fields for free text search, matching GNUI patterns
function getSearchFields(lang: string): string[] {
  return [
    `resourceTitleObject.lang${lang}^15`,
    "resourceTitleObject.*^5",
    `tag.lang${lang}^14`,
    "tag.*^4",
    `resourceAbstractObject.lang${lang}^3`,
    "resourceAbstractObject.*^2",
    "any.*",
  ];
}

export function buildSearchQuery(params: SearchParams): Record<string, unknown> {
  const lang = params.lang ?? "fre";
  const must: Record<string, unknown>[] = [];
  const filter: Record<string, unknown>[] = [];

  // Free text search with boosted fields (GNUI pattern)
  if (params.query) {
    must.push({
      query_string: {
        query: params.query,
        default_operator: "AND",
        fields: getSearchFields(lang),
      },
    });
  }

  // Filter by resource type (GNUI uses query_string for filters)
  if (params.type) {
    filter.push({
      query_string: {
        query: `resourceType:("${params.type}")`,
      },
    });
  }

  // Filter by organization
  if (params.organization) {
    filter.push({
      query_string: {
        query: `OrgForResource:("${params.organization}")`,
      },
    });
  }

  // Spatial filter (bbox)
  if (params.bbox) {
    const [west, south, east, north] = params.bbox.split(",").map(Number);
    if ([west, south, east, north].every((n) => !isNaN(n))) {
      filter.push({
        geo_shape: {
          geom: {
            shape: {
              type: "envelope",
              coordinates: [
                [west, north],
                [east, south],
              ],
            },
            relation: "intersects",
          },
        },
      });
    }
  }

  // Only include records, not templates (GNUI pattern)
  filter.push({
    terms: { isTemplate: ["n"] },
  });

  const body: Record<string, unknown> = {
    from: params.from ?? 0,
    size: params.size ?? 20,
    track_total_hits: true,
    _source: ES_SOURCE_SUMMARY,
    query: {
      bool: {
        ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
        // Exclude featureCatalogs (GNUI pattern)
        must_not: [
          {
            query_string: {
              query:
                "resourceType:featureCatalog AND !resourceType:dataset AND !cl_level.key:dataset",
            },
          },
        ],
        filter,
      },
    },
    sort: [{ _score: "desc" }, { changeDate: "desc" }],
  };

  return body;
}

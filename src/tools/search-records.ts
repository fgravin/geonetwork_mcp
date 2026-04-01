import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeoNetworkClient } from "../api/client.js";
import type { RecordSummary } from "../types/geonetwork.js";

export function registerSearchRecordsTool(
  server: McpServer,
  client: GeoNetworkClient
): void {
  server.registerTool(
    "search_records",
    {
      title: "Rechercher des fiches",
      description:
        "Rechercher des fiches de métadonnées dans le catalogue GeoNetwork. " +
        "Permet de chercher par texte libre, type de ressource, organisation, " +
        "ou emprise géographique. Retourne un résumé de chaque fiche trouvée.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Texte libre de recherche (cherche dans titre, résumé, mots-clés)"
          ),
        type: z
          .string()
          .optional()
          .describe(
            "Type de ressource : dataset, series, service, map, nonGeographicDataset"
          ),
        organization: z
          .string()
          .optional()
          .describe("Filtrer par nom d'organisation"),
        bbox: z
          .string()
          .optional()
          .describe(
            "Emprise géographique au format 'west,south,east,north' (EPSG:4326)"
          ),
        from: z
          .number()
          .int()
          .min(0)
          .default(0)
          .optional()
          .describe("Index de départ pour la pagination (défaut: 0)"),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .optional()
          .describe("Nombre de résultats (défaut: 20, max: 100)"),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, type, organization, bbox, from, size }) => {
      try {
        const result = await client.search({
          query,
          type,
          organization,
          bbox,
          from: from ?? 0,
          size: size ?? 20,
        });

        if (result.total === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Aucune fiche trouvée pour ces critères de recherche.",
              },
            ],
          };
        }

        const lines: string[] = [
          `# ${result.total} fiche(s) trouvée(s)`,
          "",
        ];

        if (result.total > result.records.length) {
          lines.push(
            `*Affichage de ${result.records.length} sur ${result.total} résultats.*`,
            ""
          );
        }

        lines.push(result.records.map(formatRecordSummary).join("\n\n---\n\n"));

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

function formatRecordSummary(record: RecordSummary): string {
  const lines: string[] = [
    `**${record.title || "Sans titre"}** (\`${record.uuid}\`)`,
    `- Type: ${record.type}`,
  ];

  if (record.organization) {
    lines.push(`- Organisation: ${record.organization}`);
  }

  if (record.abstract) {
    const short =
      record.abstract.length > 200
        ? record.abstract.substring(0, 200) + "..."
        : record.abstract;
    lines.push(`- Description: ${short}`);
  }

  if (record.keywords.length > 0) {
    lines.push(`- Mots-clés: ${record.keywords.slice(0, 8).join(", ")}`);
  }

  if (record.updateDate) {
    lines.push(`- Dernière mise à jour: ${record.updateDate.split("T")[0]}`);
  }

  return lines.join("\n");
}

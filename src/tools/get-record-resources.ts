import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeoNetworkClient } from "../api/client.js";
import {
  getUsagesForLink,
  getLinkLabel,
  getFileFormat,
  LinkUsage,
  type DatasetOnlineResource,
  type ServiceOnlineResource,
} from "@geonetwork-ui/metadata-converter";

type ClassifiableResource = DatasetOnlineResource | ServiceOnlineResource;

export function registerGetRecordResourcesTool(
  server: McpServer,
  client: GeoNetworkClient
): void {
  server.registerTool(
    "get_record_resources",
    {
      title: "Ressources d'une fiche",
      description:
        "Récupérer les ressources et liens associés à une fiche de métadonnées, " +
        "classifiés par usage : " +
        "api (endpoint de données interrogeable), " +
        "mapapi (service affichable sur une carte : WMS, WMTS, TMS), " +
        "geodata (données géographiques téléchargeables : WFS, OGC Features, GeoJSON...), " +
        "data (données tabulaires : CSV, Excel, JSON), " +
        "download (fichier téléchargeable). " +
        "Chaque ressource indique son URL, protocole, nom de couche et format.",
      inputSchema: z.object({
        uuid: z
          .string()
          .describe("Identifiant unique (UUID) de la fiche de métadonnées"),
      }),
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ uuid }) => {
      try {
        const record = await client.getRecord(uuid);

        if (!record) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Fiche '${uuid}' non trouvée dans le catalogue.`,
              },
            ],
            isError: true,
          };
        }

        const resources = (record.onlineResources ?? []) as ClassifiableResource[];

        if (resources.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Aucune ressource associée à cette fiche.",
              },
            ],
          };
        }

        const lines: string[] = [
          `# Ressources de "${record.title}"`,
          "",
        ];

        for (const r of resources) {
          const usages = getUsagesForLink(r);
          const label = getLinkLabel(r);
          const format = getFileFormat(r);

          lines.push(`## ${label || r.type}`);
          lines.push(`- **Usages:** ${usages.join(", ")}`);
          lines.push(`- **Type:** \`${r.type}\``);
          if ("accessServiceProtocol" in r && r.accessServiceProtocol) {
            lines.push(`- **Protocole:** \`${r.accessServiceProtocol}\``);
          }
          lines.push(`- **URL:** ${r.url}`);
          const name = "name" in r ? r.name : undefined;
          if (name) {
            lines.push(`- **Couche / nom:** \`${name}\``);
          }
          if (format) {
            lines.push(`- **Format:** ${format}`);
          }
          if (r.description) {
            lines.push(`- **Description:** ${r.description}`);
          }
          lines.push("");
        }

        // Summary by usage for quick agent reference
        const byUsage = groupByUsage(resources);
        if (Object.keys(byUsage).length > 0) {
          lines.push("---", "## Résumé par usage", "");
          for (const [usage, items] of Object.entries(byUsage)) {
            const descriptions = USAGE_DESCRIPTIONS[usage as LinkUsage];
            lines.push(`**${usage}** — ${descriptions ?? ""}`);
            for (const r of items) {
              const proto =
                "accessServiceProtocol" in r && r.accessServiceProtocol
                  ? ` (${r.accessServiceProtocol})`
                  : "";
              const name = "name" in r && r.name ? ` — couche: \`${r.name}\`` : "";
              lines.push(`- ${r.url}${proto}${name}`);
            }
            lines.push("");
          }
        }

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

const USAGE_DESCRIPTIONS: Record<string, string> = {
  [LinkUsage.API]: "endpoint interrogeable pour requêter les données",
  [LinkUsage.MAP_API]: "service de tuiles affichable sur une carte",
  [LinkUsage.GEODATA]: "données géographiques (téléchargeables ou via API)",
  [LinkUsage.DATA]: "données tabulaires (CSV, Excel, JSON)",
  [LinkUsage.DOWNLOAD]: "fichier téléchargeable",
  [LinkUsage.LANDING_PAGE]: "page d'accueil de la ressource",
  [LinkUsage.UNKNOWN]: "autre lien",
};

function groupByUsage(
  resources: ClassifiableResource[]
): Record<string, ClassifiableResource[]> {
  const result: Record<string, ClassifiableResource[]> = {};
  for (const r of resources) {
    for (const usage of getUsagesForLink(r)) {
      if (!result[usage]) result[usage] = [];
      result[usage].push(r);
    }
  }
  return result;
}

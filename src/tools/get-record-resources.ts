import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeoNetworkClient } from "../api/client.js";
import type { Resource } from "../types/geonetwork.js";

export function registerGetRecordResourcesTool(
  server: McpServer,
  client: GeoNetworkClient
): void {
  server.registerTool(
    "get_record_resources",
    {
      title: "Ressources d'une fiche",
      description:
        "Récupérer les ressources et liens associés à une fiche de métadonnées. " +
        "Retourne les services OGC (WMS, WFS, WMTS...), les liens de téléchargement, " +
        "et les autres liens web. Utile pour accéder aux données et APIs référencées.",
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
        const resources = await client.getRecordResources(uuid);

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

        // Group resources by category
        const ogcServices: Resource[] = [];
        const downloads: Resource[] = [];
        const webLinks: Resource[] = [];

        for (const r of resources) {
          const proto = (r.protocol ?? "").toUpperCase();
          if (
            proto.includes("OGC:") ||
            proto.includes("WMS") ||
            proto.includes("WFS") ||
            proto.includes("WMTS") ||
            proto.includes("WCS") ||
            proto.includes("CSW") ||
            proto.includes("ESRI")
          ) {
            ogcServices.push(r);
          } else if (
            proto.includes("DOWNLOAD") ||
            proto.includes("FILE") ||
            (r.function ?? "").toLowerCase() === "download"
          ) {
            downloads.push(r);
          } else {
            webLinks.push(r);
          }
        }

        const lines: string[] = [
          `# ${resources.length} ressource(s) associée(s)`,
          "",
        ];

        if (ogcServices.length > 0) {
          lines.push("## Services OGC / API");
          for (const r of ogcServices) {
            lines.push(formatResource(r));
          }
          lines.push("");
        }

        if (downloads.length > 0) {
          lines.push("## Téléchargements");
          for (const r of downloads) {
            lines.push(formatResource(r));
          }
          lines.push("");
        }

        if (webLinks.length > 0) {
          lines.push("## Liens web");
          for (const r of webLinks) {
            lines.push(formatResource(r));
          }
          lines.push("");
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

function formatResource(r: Resource): string {
  const lines = [`- **${r.name || r.protocol || "Lien"}**`];
  if (r.protocol) lines.push(`  - Protocole: \`${r.protocol}\``);
  lines.push(`  - URL: ${r.url}`);
  if (r.description) lines.push(`  - Description: ${r.description}`);
  if (r.applicationProfile)
    lines.push(`  - Profil: ${r.applicationProfile}`);
  return lines.join("\n");
}

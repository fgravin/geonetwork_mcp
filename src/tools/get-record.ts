import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeoNetworkClient } from "../api/client.js";

export function registerGetRecordTool(
  server: McpServer,
  client: GeoNetworkClient
): void {
  server.registerTool(
    "get_record",
    {
      title: "Consulter une fiche",
      description:
        "Récupérer les métadonnées complètes d'une fiche du catalogue GeoNetwork " +
        "à partir de son UUID. Retourne le titre, résumé, mots-clés, contacts, " +
        "contraintes, généalogie, étendue spatiale et temporelle.",
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
        const lines: string[] = [`# ${record.title || "Sans titre"}`, ""];

        // Identification
        lines.push("## Identification");
        lines.push(`- **UUID:** \`${record.uuid}\``);
        lines.push(`- **Type:** ${record.type}`);
        if (record.organization) {
          lines.push(`- **Organisation:** ${record.organization}`);
        }
        if (record.updateDate) {
          lines.push(
            `- **Dernière mise à jour:** ${record.updateDate.split("T")[0]}`
          );
        }

        // Abstract
        if (record.abstract) {
          lines.push("", "## Résumé", record.abstract);
        }

        // Keywords
        if (record.keywords.length > 0) {
          lines.push("", "## Mots-clés", record.keywords.join(", "));
        }

        // Topic categories
        if (record.topicCategories.length > 0) {
          lines.push(
            "",
            "## Catégories thématiques",
            record.topicCategories.join(", ")
          );
        }

        // Spatial extent
        if (record.spatialExtent) {
          const ext = record.spatialExtent;
          lines.push(
            "",
            "## Emprise géographique",
            `- Ouest: ${ext.west}`,
            `- Sud: ${ext.south}`,
            `- Est: ${ext.east}`,
            `- Nord: ${ext.north}`
          );
        }

        // Temporal extent
        if (record.temporalExtent) {
          lines.push("", "## Étendue temporelle", record.temporalExtent);
        }

        // Lineage
        if (record.lineage) {
          lines.push("", "## Généalogie", record.lineage);
        }

        // Constraints
        if (record.constraints.length > 0) {
          lines.push(
            "",
            "## Contraintes d'accès et d'utilisation",
            ...record.constraints.map((c) => `- ${c}`)
          );
        }

        // Contacts
        if (record.contacts.length > 0) {
          lines.push("", "## Contacts");
          for (const contact of record.contacts) {
            const parts = [contact.organization];
            if (contact.name) parts.unshift(contact.name);
            if (contact.role) parts.push(`(${contact.role})`);
            if (contact.email) parts.push(`— ${contact.email}`);
            lines.push(`- ${parts.join(" ")}`);
          }
        }

        // Resources summary
        if (record.resources.length > 0) {
          lines.push(
            "",
            `*${record.resources.length} ressource(s) associée(s) — utilisez get_record_resources pour les détails.*`
          );
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

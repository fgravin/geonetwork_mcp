import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeoNetworkClient } from "../api/client.js";
import type {
  CatalogRecord,
  DatasetRecord,
  Individual,
} from "@geonetwork-ui/metadata-converter";

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

        return {
          content: [
            { type: "text" as const, text: formatRecord(record) },
          ],
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

function formatRecord(record: CatalogRecord): string {
  const lines: string[] = [`# ${record.title || "Sans titre"}`, ""];

  // Identification
  lines.push("## Identification");
  lines.push(`- **UUID:** \`${record.uniqueIdentifier}\``);
  lines.push(`- **Type:** ${record.kind}`);
  if (record.ownerOrganization?.name) {
    lines.push(`- **Organisation:** ${record.ownerOrganization.name}`);
  }
  if (record.recordUpdated) {
    lines.push(
      `- **Dernière mise à jour:** ${record.recordUpdated.toISOString().split("T")[0]}`
    );
  }
  if (record.kind === "dataset") {
    const ds = record as DatasetRecord;
    if (ds.status) lines.push(`- **Statut:** ${ds.status}`);
  }
  if (record.updateFrequency) {
    const freq =
      typeof record.updateFrequency === "string"
        ? record.updateFrequency
        : `${record.updateFrequency.updatedTimes}x par ${record.updateFrequency.per}`;
    lines.push(`- **Fréquence de mise à jour:** ${freq}`);
  }

  // Abstract
  if (record.abstract) {
    lines.push("", "## Résumé", record.abstract);
  }

  // Keywords
  if (record.keywords.length > 0) {
    lines.push(
      "",
      "## Mots-clés",
      record.keywords.map((k) => k.label).join(", ")
    );
  }

  // Topics
  if (record.topics.length > 0) {
    lines.push("", "## Catégories thématiques", record.topics.join(", "));
  }

  // Spatial extents
  if (record.spatialExtents?.length > 0) {
    lines.push("", "## Emprise géographique");
    for (const ext of record.spatialExtents) {
      if (ext.description) lines.push(`- ${ext.description}`);
      if (ext.bbox) {
        const [w, s, e, n] = ext.bbox;
        lines.push(`- Bbox: [${w}, ${s}, ${e}, ${n}]`);
      }
    }
  }

  // Temporal extents
  if ("temporalExtents" in record && record.temporalExtents?.length > 0) {
    lines.push("", "## Étendue temporelle");
    for (const ext of record.temporalExtents) {
      const start = ext.start.toISOString().split("T")[0];
      const end = ext.end ? ext.end.toISOString().split("T")[0] : "...";
      lines.push(`- ${start} → ${end}`);
    }
  }

  // Lineage
  if ("lineage" in record && record.lineage) {
    lines.push("", "## Généalogie", record.lineage);
  }

  // Constraints
  const allConstraints = [
    ...record.licenses.map((c) => `[Licence] ${c.text}`),
    ...record.legalConstraints.map((c) => `[Légal] ${c.text}`),
    ...record.otherConstraints.map((c) => c.text),
  ];
  if (allConstraints.length > 0) {
    lines.push(
      "",
      "## Contraintes d'accès et d'utilisation",
      ...allConstraints.map((c) => `- ${c}`)
    );
  }

  // Contacts
  const contacts = [
    ...record.contacts,
    ...record.contactsForResource,
  ];
  if (contacts.length > 0) {
    lines.push("", "## Contacts");
    const seen = new Set<string>();
    for (const c of contacts) {
      const key = `${c.organization?.name}-${c.email}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${formatContact(c)}`);
    }
  }

  // Resources hint
  const resourceCount = record.onlineResources?.length ?? 0;
  if (resourceCount > 0) {
    lines.push(
      "",
      `*${resourceCount} ressource(s) associée(s) — utilisez get_record_resources pour les détails.*`
    );
  }

  return lines.join("\n");
}

function formatContact(c: Individual): string {
  const parts: string[] = [];
  if (c.firstName || c.lastName) {
    parts.push([c.firstName, c.lastName].filter(Boolean).join(" "));
  }
  if (c.organization?.name) parts.push(c.organization.name);
  if (c.role) parts.push(`(${c.role})`);
  if (c.email) parts.push(`— ${c.email}`);
  return parts.join(" ");
}

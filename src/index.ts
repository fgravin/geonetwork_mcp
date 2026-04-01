#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GeoNetworkClient } from "./api/client.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const baseUrl = process.argv[2] || process.env.GEONETWORK_URL;

  if (!baseUrl) {
    console.error(
      "Usage: geonetwork-mcp <GEONETWORK_URL>\n" +
        "  ou définir la variable d'environnement GEONETWORK_URL\n" +
        "  Exemple: geonetwork-mcp https://example.org/geonetwork"
    );
    process.exit(1);
  }

  const client = new GeoNetworkClient({ baseUrl });
  const server = createServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

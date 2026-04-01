import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GeoNetworkClient } from "./api/client.js";
import { registerSearchRecordsTool } from "./tools/search-records.js";
import { registerGetRecordTool } from "./tools/get-record.js";
import { registerGetRecordResourcesTool } from "./tools/get-record-resources.js";

export function createServer(client: GeoNetworkClient): McpServer {
  const server = new McpServer(
    {
      name: "geonetwork-mcp",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
    }
  );

  registerSearchRecordsTool(server, client);
  registerGetRecordTool(server, client);
  registerGetRecordResourcesTool(server, client);

  return server;
}

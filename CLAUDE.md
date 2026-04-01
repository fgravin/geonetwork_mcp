# geonetwork-mcp

MCP server for GeoNetwork 4.x catalog discovery and data access.

## Build & Run

```bash
npm install
npm run build    # tsc
npm start        # node dist/index.js (requires GEONETWORK_URL)
```

## Architecture

- `src/types/` — TypeScript type definitions (Record, Resource, SearchResult, etc.)
- `src/api/` — GeoNetwork 4.x API client (ElasticSearch search, records API)
- `src/tools/` — 3 MCP tools (search_records, get_record, get_record_resources)

## MCP Client Configuration

```json
{
  "mcpServers": {
    "geonetwork": {
      "command": "node",
      "args": ["/path/to/geonetwork_mcp/dist/index.js"],
      "env": {
        "GEONETWORK_URL": "https://example.org/geonetwork"
      }
    }
  }
}
```

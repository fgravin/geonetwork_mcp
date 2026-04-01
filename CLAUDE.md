# geonetwork-mcp

MCP server for GeoNetwork 4.x catalog discovery and data access.

## Build & Run

```bash
npm install
npm run build    # tsc
npm start        # node dist/index.js (requires GEONETWORK_URL)
```

## Architecture

- `lib/metadata-converter/` — @geonetwork-ui/metadata-converter lib (CatalogRecord model, GN4 converter, link utilities)
- `src/api/` — GeoNetworkClient wrapping the lib's searchRecords/getRecord
- `src/tools/` — 3 MCP tools (search_records, get_record, get_record_resources)

All GN4 ElasticSearch responses are converted to `CatalogRecord` (DatasetRecord | ServiceRecord | ReuseRecord) via the metadata-converter lib. Link classification uses `getUsagesForLink()` and `getLinkLabel()` from the lib.

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

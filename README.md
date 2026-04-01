# geonetwork-mcp

Serveur MCP pour la découverte et l'accès aux données d'un catalogue [GeoNetwork 4.x](https://geonetwork-opensource.org/).

Permet à un assistant IA de rechercher des fiches de métadonnées, consulter leurs détails et découvrir les services (WMS, WFS, téléchargements...) référencés dans le catalogue.

Les réponses de l'API GeoNetwork sont converties en `CatalogRecord` (modèle pivot de [geonetwork-ui](https://github.com/geonetwork/geonetwork-ui)) via la librairie `@geonetwork-ui/metadata-converter`.

## Installation

```bash
npm install
npm run build
```

## Configuration MCP

```json
{
  "mcpServers": {
    "geonetwork": {
      "command": "node",
      "args": ["/chemin/vers/geonetwork_mcp/dist/index.js"],
      "env": {
        "GEONETWORK_URL": "https://example.org/geonetwork"
      }
    }
  }
}
```

L'URL peut aussi être passée en argument CLI :

```bash
node dist/index.js https://example.org/geonetwork
```

## Tools

### `search_records`

Rechercher des fiches de métadonnées dans le catalogue.

| Paramètre      | Type   | Description                                              |
|-----------------|--------|----------------------------------------------------------|
| `query`         | string | Texte libre (titre, résumé, mots-clés)                  |
| `type`          | string | Type de ressource : `dataset`, `series`, `service`, `map` |
| `organization`  | string | Filtrer par nom d'organisation                           |
| `bbox`          | string | Emprise géographique `west,south,east,north` (EPSG:4326) |
| `from`          | number | Index de départ pour la pagination (défaut: 0)           |
| `size`          | number | Nombre de résultats (défaut: 20, max: 100)               |

### `get_record`

Consulter les métadonnées complètes d'une fiche : titre, résumé, mots-clés, contacts, contraintes, généalogie, emprise spatiale et temporelle, catégories thématiques.

| Paramètre | Type   | Description              |
|-----------|--------|--------------------------|
| `uuid`    | string | UUID de la fiche         |

### `get_record_resources`

Lister les ressources associées à une fiche, groupées par usage (classification via `getUsagesForLink` de geonetwork-ui) :
- **Services / API** — WFS, OGC Features, ESRI REST...
- **Services cartographiques** — WMS, WMTS, TMS
- **Données géographiques** — GeoJSON, Shapefile, GeoPackage...
- **Données tabulaires** — CSV, Excel, JSON
- **Téléchargements** — fichiers téléchargeables
- **Autres liens** — pages d'information, documentation

| Paramètre | Type   | Description              |
|-----------|--------|--------------------------|
| `uuid`    | string | UUID de la fiche         |

## Architecture

```
src/
├── index.ts                     # Entry point (stdio transport)
├── server.ts                    # McpServer + enregistrement des tools
├── api/
│   └── client.ts                # GeoNetworkClient (wrapper sur la lib)
└── tools/
    ├── search-records.ts
    ├── get-record.ts
    └── get-record-resources.ts
lib/
└── metadata-converter/          # @geonetwork-ui/metadata-converter
    └── ...                      # Modèle CatalogRecord, converter GN4, link utilities
```

## Développement

```bash
npm run dev          # tsc --watch
npm run test         # vitest
```

## Prérequis

- Node.js >= 18
- Un catalogue GeoNetwork 4.x accessible en réseau

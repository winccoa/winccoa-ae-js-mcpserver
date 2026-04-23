# S7Plus Driver Documentation

Knowledge base for the S7Plus driver (Siemens S7-1200/S7-1500) in WinCC OA.

## Documents

| # | Document | Description |
|---|----------|-------------|
| 00 | [Quickstart](00-quickstart.md) | End-to-end workflow from zero to receiving PLC values, prerequisites, common mistakes |
| 01 | [Overview](01-overview.md) | What S7Plus is, supported PLCs, key concepts, features |
| 02 | [Configuration Values](02-types-and-enums.md) | All configuration values (PLC types, directions, transformations, states), parameters, defaults |
| 03 | [Connection Management](03-connection-management.md) | Connection lifecycle, creating/modifying/deleting, driver management, datapoint structure |
| 04 | [Address Configuration](04-address-configuration.md) | DPE-to-PLC linking, polling vs. subscription, three-step pattern, poll groups |
| 05 | [Browsing](05-browsing.md) | Online/offline/root browse, pagination, path navigation, TIA project discovery |
| 06 | [TLS and Security](06-tls-and-security.md) | TLS setup, CA certificate management, PLC password protection |
| 07 | [Redundancy](07-redundancy.md) | Redundant PLCs, ReduLan, switch conditions, configuration examples |
| 08 | [Architecture](08-architecture-and-integration.md) | System architecture, data flows, Pmon integration, datapoint overview |
| 09 | [Troubleshooting](09-troubleshooting.md) | Common issues with setup, connections, addresses, browsing, TLS, drivers |

## RAG System

These documents are designed for chunk-based retrieval in a RAG system:
- Each file covers one self-contained topic
- No programming language or framework dependencies
- Tables and structured text optimized for parsing
- Technical terms defined at first use

### Recommended Chunking Strategy
- Split at H2 headings (`##`) for medium-granularity chunks
- Each chunk is self-contained at the H2 level
- File 02 (Configuration Values) benefits from splitting at H3 level

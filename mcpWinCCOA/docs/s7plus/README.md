# S7Plus-Treiber Dokumentation

Wissenssammlung zum S7Plus-Treiber (Siemens S7-1200/S7-1500) in WinCC OA.

## Dokumente

| # | Dokument | Beschreibung |
|---|----------|-------------|
| 00 | [Quickstart](00-quickstart.md) | End-to-End-Workflow von Null bis zum Empfang von SPS-Werten, Voraussetzungen, häufige Fehler |
| 01 | [Überblick](01-overview.md) | Was S7Plus ist, unterstützte SPSen, Grundkonzepte, Features |
| 02 | [Konfigurationswerte](02-types-and-enums.md) | Alle Konfigurationswerte (SPS-Typen, Richtungen, Transformationen, Zustände), Parameter, Standardwerte |
| 03 | [Verbindungsverwaltung](03-connection-management.md) | Verbindungs-Lebenszyklus, Erstellen/Ändern/Löschen, Treiberverwaltung, Datenpunktstruktur |
| 04 | [Adresskonfiguration](04-address-configuration.md) | DPE-SPS-Verknüpfung, Polling vs. Subscription, Drei-Schritt-Muster, Pollgruppen |
| 05 | [Browsing](05-browsing.md) | Online/Offline/Root-Browse, Paginierung, Pfadnavigation, TIA-Projekt-Erkennung |
| 06 | [TLS und Sicherheit](06-tls-and-security.md) | TLS-Einrichtung, CA-Zertifikatsverwaltung, SPS-Passwortschutz |
| 07 | [Redundanz](07-redundancy.md) | Redundante SPSen, ReduLan, Umschaltbedingungen, Konfigurationsbeispiele |
| 08 | [Architektur](08-architecture-and-integration.md) | Systemarchitektur, Datenflüsse, Pmon-Integration, Datenpunktübersicht |
| 09 | [Fehlerbehebung](09-troubleshooting.md) | Häufige Probleme bei Einrichtung, Verbindungen, Adressen, Browsing, TLS, Treiber |

## RAG-System

Diese Dokumente sind für Chunk-basiertes Retrieval in einem RAG-System konzipiert:
- Jede Datei behandelt ein eigenständiges Thema
- Keine Programmiersprachen- oder Framework-Abhängigkeiten
- Tabellen und strukturierter Text für einfaches Parsing
- Fachbegriffe werden bei Erstverwendung erklärt

### Empfohlene Chunking-Strategie
- Trennung bei H2-Überschriften (`##`) für mittelgroße Chunks
- Jeder Chunk ist auf H2-Ebene inhaltlich eigenständig
- Datei 02 (Konfigurationswerte) profitiert von Trennung auf H3-Ebene

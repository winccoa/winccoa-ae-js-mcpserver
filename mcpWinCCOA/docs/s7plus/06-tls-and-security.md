# S7Plus TLS und Sicherheit

## Überblick

S7Plus-Verbindungen können mit TLS (Transport Layer Security) verschlüsselt werden. Dies ist wichtig in Umgebungen, in denen die Netzwerksicherheit relevant ist.

## TLS-Konfiguration

### TLS aktivieren

Am Verbindungsdatenpunkt:
```
Config.UseTls            = true
Config.Certificate       = "my_plc_cert.pem"    (optional: Server-Zertifikat)
Config.LegitimationLevel = 0                     (wird automatisch gesetzt)
```

### Voraussetzungen

Bevor eine TLS-Verbindung erstellt wird:

1. **Mindestens ein CA-Zertifikat** muss in der Vertrauensliste sein (`_S7PlusConfig.CaCertificates`)
2. **Zertifikatsdateien** müssen im Zertifikatsverzeichnis des WinCC OA Projekts liegen (`data/s7plus/cert`)

### Legitimation Level

Der `Config.UseTls`-Parameter wird intern auf `Config.LegitimationLevel` abgebildet:
- `UseTls = true` → LegitimationLevel = 0 (Failsafe)
- `UseTls = false` → LegitimationLevel = -1 (Invalid)

Der LegitimationLevel-Enum hat weitere Werte (Full=1, ReadWrite=2, ReadOnly=3, InactiveAccess=4) für SPS-Zugriffsberechtigungen. Siehe Konfigurationswerte-Dokument.

## CA-Zertifikatsverwaltung

CA-Zertifikate werden in `_S7PlusConfig.CaCertificates` gespeichert — der Root-Vertrauensliste, die **für alle S7Plus-Verbindungen** im Projekt gilt.

### Aktionen

| Aktion | Beschreibung |
|--------|-------------|
| Auflisten | `_S7PlusConfig.CaCertificates` lesen |
| Hinzufügen | Dateinamen zur `CaCertificates`-Liste hinzufügen (Duplikate werden übersprungen) |
| Entfernen | Dateinamen aus der `CaCertificates`-Liste entfernen |

Zertifikatsdateien müssen im Verzeichnis `data/s7plus/cert` des WinCC OA Projekts vorhanden sein.

## Zertifikatstypen

| Zertifikat | Speicherort | Zweck |
|-----------|-------------|-------|
| **CA-Zertifikat** | `_S7PlusConfig.CaCertificates` | Root-Vertrauensliste — validiert die Identität der SPS. Gilt für alle Verbindungen. |
| **Server-Zertifikat** | `Config.Certificate` (pro Verbindung) | Spezifische Zertifikatsdatei für diese Verbindung. Optional. |

Es gibt keine Client-Zertifikats-Verifizierung — die SPS verifiziert den WinCC OA Client nicht.

## TLS-Einrichtungs-Workflow

```
1. Zertifikatsdateien nach data/s7plus/cert kopieren

2. CA-Zertifikate zur Vertrauensliste hinzufügen:
   _S7PlusConfig.CaCertificates = ["root_ca.pem"]

3. Verbindung mit TLS erstellen:
   Config.Address   = "192.168.1.100"
   Config.PLCType   = 16
   Config.UseTls    = true
   Config.Certificate = "plc_cert.pem"   (optional)

4. Verbindung aktivieren und Status prüfen:
   State.ConnState = 3 (Connected)
```

## SPS-Passwortschutz

Zusätzlich zu TLS können SPSen ein Passwort für den Zugriff erfordern:

```
Config.Password = "myPLCpassword"
```

Das Passwort ist unabhängig von TLS — beides kann einzeln oder kombiniert verwendet werden.

## Sicherheits-Best-Practices

- TLS für alle Produktionsverbindungen verwenden, besonders bei Netzwerkübergängen
- CA-Zertifikate vor Ablauf rotieren
- Separate Server-Zertifikate pro Verbindung verwenden
- TLS mit SPS-Passwortschutz kombinieren (Defense in Depth)
- Verbindungsstatus auf unerwartete `Failure`-Zustände überwachen (können auf Zertifikatsprobleme hinweisen)

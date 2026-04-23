# S7Plus Konfigurationswerte und Datentypen

## SPS-Typ (Config.PLCType)

Bestimmt die Ziel-SPS-Hardware. Muss mit der tatsächlichen SPS übereinstimmen.

| Name | Wert | Beschreibung |
|------|------|-------------|
| Automatic | 1 | Auto-Erkennung aus TIA Projekt (erfordert Offline-Browse) |
| RH | 2 | Redundant High Availability — zwei SPSen |
| RH_Single | 3 | Einzelne SPS in einem redundanten System |
| S7_1500 | 16 | Standard S7-1500 |
| S7_1200 | 272 | S7-1200 |
| S7_1500_SoftCtrl | 528 | Software-basierter S7-1500 Controller |
| PLCSim | 768 | PLCSIM Simulationsumgebung |

## Verbindungstyp (Config.ConnType)

| Name | Wert | Beschreibung |
|------|------|-------------|
| Single | 0 | Einzelne Netzwerkverbindung (Standard) |
| ReduLan | 1 | Redundantes LAN — zwei unabhängige Netzwerkpfade |

ReduLan erfordert eine sekundäre IP-Adresse (`Config.ReduAddress`) und optional einen separaten Access Point (`Config.ReduAccessPoint`).

## Verbindungsstatus (State.ConnState)

| Name | Wert | Beschreibung |
|------|------|-------------|
| Inactive | 0 | Verbindung nicht initialisiert |
| Disconnected | 1 | Konfiguriert aber nicht aktiv |
| Connecting | 2 | Verbindungsaufbau läuft |
| Connected | 3 | Erfolgreich verbunden |
| Disconnecting | 4 | Kontrollierter Verbindungsabbau |
| Failure | 5 | Verbindung fehlgeschlagen (WinCC OA Log prüfen) |

## Aufbaumodus (Config.EstablishmentMode)

| Name | Wert | Beschreibung |
|------|------|-------------|
| Inactive | 0 | Verbindung muss manuell aktiviert werden |
| AutomaticActive | 1 | Verbindung wird automatisch beim Serverstart aktiviert |

Bei `EstablishmentMode = 1` und `Command.Enable = true` wird die Verbindung automatisch aufgebaut.

## Zeitsynchronisation (Config.TimeSyncMode)

| Name | Wert | Beschreibung |
|------|------|-------------|
| Inactive | 0 | Keine Zeitsynchronisation |
| SyncPLCtoOA | 1 | SPS-Uhr an WinCC OA-Uhr synchronisieren |

Synchronisationsintervall konfigurierbar (Standard: 86400 Sekunden = 24 Stunden).

## SPS-Betriebszustand (State.Connections.OpState)

Nur verfügbar wenn `Config.ReadOpState = true`.

| Name | Wert | Beschreibung |
|------|------|-------------|
| Stop | 4 | SPS im Stop-Modus |
| Startup | 6 | SPS startet hoch |
| Run | 8 | SPS läuft normal |
| RunRedundant | 9 | SPS läuft im redundanten Modus |
| RunODIS | 18 | SPS läuft mit Online-Diagnose (ODIS) |

## SPS-Login-Status (State.Connections.State)

| Name | Wert | Beschreibung |
|------|------|-------------|
| LoggedOut | 0 | Nicht authentifiziert |
| LoggingIn | 1 | Authentifizierung läuft |
| LoggedIn | 2 | Erfolgreich authentifiziert |
| LoggingOut | 3 | Abmeldung läuft |

## Legitimation Level (Config.LegitimationLevel)

Steuert die Zugriffsebene zur SPS. Dies ist **nicht** einfach ein TLS an/aus — es definiert die Berechtigungsstufe.

| Name | Wert | Beschreibung |
|------|------|-------------|
| Invalid | -1 | Ungültige/fehlgeschlagene Authentifizierung (auch für "kein TLS") |
| Failsafe | 0 | Failsafe-Zugriff, minimale Rechte (auch bei `useTls: true`) |
| Full | 1 | Vollzugriff auf alle SPS-Ressourcen |
| ReadWrite | 2 | Lese- und Schreibzugriff |
| ReadOnly | 3 | Nur Lesezugriff |
| InactiveAccess | 4 | Inaktiv (kein Zugriff) |

Bei TLS: LegitimationLevel = 0 (Failsafe). Ohne TLS: LegitimationLevel = -1 (Invalid).

## Redundanz-Umschaltbedingung (Config.SwitchCondition)

| Name | Wert | Beschreibung |
|------|------|-------------|
| Disabled | 0 | Keine automatische Redundanzumschaltung |
| OpState | 1 | Umschalten bei Änderung des SPS-Betriebszustands |
| ConnState | 2 | Umschalten bei Verbindungsverlust |
| Both | 3 | Umschalten bei OpState ODER ConnState |
| SwitchTag | 4 | Umschalten basierend auf einer booleschen SPS-Variable |

SwitchTag (4) erfordert `Config.SwitchTag` mit dem Namen der SPS-Variable.

## Adressrichtung (_address._direction)

| Name | Wert | Verwendung |
|------|------|------------|
| Output | 1 | Nur Schreiben zur SPS |
| InputSpont | 2 | **NICHT UNTERSTÜTZT** bei S7Plus |
| InputSQuery | 3 | Einmalige Leseanfrage |
| InputPoll | 4 | Zyklisches Lesen |
| OutputSingle | 5 | Einmaliges Schreiben |
| IOSpont | 6 | **NICHT UNTERSTÜTZT** bei S7Plus |
| IOPoll | 7 | Bidirektionales Polling — **auch für Subscriptions** |
| IOSQuery | 8 | Bidirektionale Einmalanfrage |

**Kritisch:** Direction 7 (IOPoll) dient doppelt. Sowohl Polling als auch Subscription verwenden diesen Wert. Der Unterschied liegt in der Registrierung in `_S7PlusConfig.Subscriptions`. Siehe Adresskonfiguration für Details.

Spontane Modi (2, 6) funktionieren bei S7Plus nicht — das Protokoll erfordert Polling oder explizite Subscription.

## Datentyptransformation (_address._datatype)

Mappt SPS-Datentypen auf WinCC OA Datentypen. Wertebereich: 1001-1027.

| Name | Wert | SPS-Typ | WinCC OA Typ |
|------|------|---------|--------------|
| DEFAULT | 1001 | Auto-Erkennung (empfohlen) | automatisch |
| BOOL | 1002 | Boolean | bool |
| BYTE | 1003 | 8-Bit unsigned | int |
| WORD | 1004 | 16-Bit unsigned | int |
| DWORD | 1005 | 32-Bit unsigned | int |
| LWORD | 1006 | 64-Bit unsigned | int |
| USINT | 1007 | Unsigned 8-Bit Integer | int |
| UINT | 1008 | Unsigned 16-Bit Integer | int |
| UDINT | 1009 | Unsigned 32-Bit Integer | int |
| ULINT | 1010 | Unsigned 64-Bit Integer | int |
| SINT | 1011 | Signed 8-Bit Integer | int |
| INT | 1012 | Signed 16-Bit Integer | int |
| DINT | 1013 | Signed 32-Bit Integer | int |
| LINT | 1014 | Signed 64-Bit Integer | int |
| REAL | 1015 | 32-Bit Float | float |
| LREAL | 1016 | 64-Bit Double | float |
| DATE | 1017 | Datum (Tage seit 1970-01-01) | time |
| DATETIME | 1018 | Datum und Uhrzeit | time |
| TIME | 1019 | Zeit in Millisekunden (32-Bit) | time |
| TIME_OF_DAY | 1020 | Tageszeit in ms seit Mitternacht | time |
| LDATETIME | 1021 | Langes Datum und Uhrzeit | time |
| LTIME | 1022 | Lange Zeit in Nanosekunden (64-Bit) | time |
| LTOD | 1023 | Lange Tageszeit (64-Bit) | time |
| DTL | 1024 | Date and Time Long (12-Byte Struct) | time |
| S5TIME | 1025 | S5-kompatible Zeit (16-Bit) | time |
| STRING | 1026 | ASCII-String | string |
| WSTRING | 1027 | Wide (Unicode) String | string |

Für STRING und WSTRING: `_address._offset` bzw. `itemLength` auf die maximale Stringlänge setzen.

## Verbindungsparameter

### Pflichtparameter

| Parameter | Datenpunktfeld | Beschreibung |
|-----------|---------------|-------------|
| IP-Adresse | Config.Address | IPv4-Adresse der SPS |
| SPS-Typ | Config.PLCType | SPS-Hardware-Typ (siehe Tabelle oben) |
| Treibernummer | Config.DrvNumber | S7Plus-Treibernummer (1-99) |

### Optionale Parameter

| Parameter | Datenpunktfeld | Standard | Beschreibung |
|-----------|---------------|---------|-------------|
| Access Point | Config.AccessPoint | "S7ONLINE" | Netzwerk-Zugangspunkt |
| Verbindungstyp | Config.ConnType | 0 (Single) | Verbindungstyp |
| Verbindung aktivieren | Config.EstablishmentMode | 0 | 0=Inaktiv, 1=AutomaticActive |
| Keep-Alive | Config.KeepAliveTimeout | 20 | Keep-Alive in Sekunden |
| Reconnect | Config.ReconnectTimeout | 20 | Reconnect-Intervall in Sekunden |
| UTC verwenden | Config.UseUtc | true | UTC-Zeitstempel |
| Zeitzone | Config.Timezone | 0 | Zeitzonen-Offset |
| Invalid-Bit | Config.SetInvalidBit | false | Invalid-Bit bei Kommunikationsfehlern |
| Statistik | Config.EnableStatistics | true | Treiberstatistik |
| Diagnose | Config.EnableDiagnostics | false | Diagnose aktivieren |
| OpState lesen | Config.ReadOpState | false | SPS-Betriebszustand lesen |
| Werte bei Connect | Config.AcquireValuesOnConnect | true | Alle Werte bei Verbindung lesen |
| Zeitsync-Modus | Config.TimeSyncMode | 0 (Inaktiv) | Zeitsynchronisation |
| Zeitsync-Intervall | Config.TimeSyncInterval | 86400 | Sync-Intervall in Sekunden |
| Passwort | Config.Password | — | SPS-Zugangspasswort |
| TLS | Config.UseTls | false | TLS-Verschlüsselung |
| Zertifikat | Config.Certificate | — | Server-Zertifikatsdatei |
| Stationsname | Config.StationName | — | TIA-Stationsname für Browse |
| Codepage | Config.Codepage | — | Zeichencodierung |
| Redu-Adresse | Config.ReduAddress | — | Sekundäre SPS-IP |
| Redu-AccessPoint | Config.ReduAccessPoint | — | Sekundärer Zugangspunkt |
| Umschaltbedingung | Config.SwitchCondition | 0 (Disabled) | Redundanz-Umschaltung |
| Switch-Tag | Config.SwitchTag | — | SPS-Variable für SwitchTag |

## Browse-Ergebnisfelder

Jeder Browse-Knoten enthält:

| Feld | Beschreibung |
|------|-------------|
| path | Symbolischer Pfad (als `_reference` in der Adresskonfiguration verwenden) |
| comment | Beschreibung aus dem TIA Portal Projekt |
| systemType | SPS-Systemtyp-Identifier |
| valueType | Datentyp (z.B. "Int", "Real", "Bool", "String") |
| itemLength | Stringlänge für STRING/WSTRING (0 bei anderen Typen) |
| hasChildren | Wenn true, kann tiefer navigiert werden |

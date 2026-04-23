# S7Plus Verbindungsverwaltung

## Verbindungs-Lebenszyklus

```
[Keine Verbindung] 
    │ _S7PlusConnection Datenpunkt erstellen + Config setzen
    ▼
[Erstellt - Inaktiv] 
    │ EstablishmentMode = 1 (AutomaticActive) + Command.Enable = true
    ▼
[Connecting] 
    │ Erfolgreicher Handshake mit SPS
    ▼
[Connected] ◄──── normaler Betriebszustand
    │
    ├── Config ändern → [Temporär deaktiviert] → [Wieder aktiviert]
    │
    └── Datenpunkt löschen → [Gelöscht]
```

## Voraussetzungen

**Der S7Plus-Treiber muss in Pmon registriert sein.** Die Registrierung erfolgt in der WinCC OA Console:

1. WinCC OA Console öffnen
2. Manager `WCCOAs7plusdrv` hinzufügen
3. Optionen: `-num 1` (Treibernummer 1-99)
4. Startmodus: `always`

Wenn der Treiber registriert aber gestoppt ist, wird er automatisch gestartet sobald eine Verbindung aktiviert wird.

## Verbindung erstellen

### Datenpunkt anlegen

Ein Datenpunkt vom Typ `_S7PlusConnection` wird benötigt (z.B. `_S7PlusConnection1`).

### Konfiguration setzen

**Pflichtfelder:**
```
Config.Address    = "192.168.1.100"       (IP-Adresse der SPS)
Config.PLCType    = 16                     (SPS-Typ, z.B. 16 = S7-1500)
Config.DrvNumber  = 1                      (Treibernummer)
```

**Optionale Felder (mit Standardwerten):**
```
Config.AccessPoint           = "S7ONLINE"
Config.ConnType              = 0           (Single)
Config.KeepAliveTimeout      = 20          (Sekunden)
Config.ReconnectTimeout      = 20          (Sekunden)
Config.UseUtc                = true
Config.Timezone              = 0
Config.SetInvalidBit         = false
Config.EnableStatistics      = true
Config.EnableDiagnostics     = false
Config.ReadOpState           = false
Config.AcquireValuesOnConnect = true
Config.TimeSyncMode          = 0           (Inactive)
Config.TimeSyncInterval      = 86400       (24 Stunden)
```

### CheckConn konfigurieren

Jede Verbindung benötigt eine interne CheckConn-Adresse. Diese wird am `CheckConn`-Unterelement des Verbindungsdatenpunkts konfiguriert — über den gleichen Drei-Schritt-Mechanismus wie normale Adressen:

1. `_distrib` setzen (Treiberzuordnung)
2. `_address` setzen (ohne `_active`)
3. `_active = true` setzen (separater `dpSetWait`)

### Verbindung aktivieren

```
Config.EstablishmentMode = 1               (AutomaticActive)
Command.Enable           = true
Command.GQ               = false
Command.IGQ              = false
```

### Browse-Modus

Der Browse-Modus wird über `Config.StationName` gesteuert und ist **nach Erstellung fixiert**:

- **Online:** `Config.StationName` enthält `"S7Plus$Online|Online"` → Browse einer laufenden SPS
- **Offline:** `Config.StationName` enthält `"ExportName|StationName"` → Browse eines TIA Portal Exports

Wenn beide Modi benötigt werden, müssen zwei separate Verbindungen erstellt werden.

## Verbindung ändern

Zum Ändern einer bestehenden Verbindung:

1. Verbindung deaktivieren: `Config.EstablishmentMode = 0`, `Command.Enable = false`
2. Config-Felder ändern
3. Verbindung wieder aktivieren

**Achtung:** Wird `Config.EstablishmentMode` nach der Änderung wieder auf 1 gesetzt, wird die Verbindung immer aktiviert — auch wenn sie vorher manuell deaktiviert war.

Alle bestehenden `_address`-Konfigurationen an Datenpunkten bleiben bei Änderungen erhalten.

## Verbindung löschen

**Warnung:** Das Löschen des `_S7PlusConnection`-Datenpunkts zerstört alle `_address`-Konfigurationen, die diese Verbindung referenzieren. Dies kann nicht rückgängig gemacht werden.

Empfohlene Reihenfolge:
1. Verbindung deaktivieren
2. `_S7PlusConnection`-Datenpunkt löschen

## Treibernummern-Verwaltung

### Funktionsweise

- Jede S7Plus-Treiberinstanz hat eine eindeutige Nummer (1-99)
- Die Nummer wird mit dem `-num` Parameter in der Manager-Kommandozeile angegeben
- Mehrere Verbindungen können die gleiche Treiberinstanz teilen
- Treibernummern dürfen nicht mit anderen Treibertypen im Projekt kollidieren

### Treiber-Auflösungslogik

1. Pmon nach registrierten Managern abfragen
2. S7Plus-Treiber (`WCCOAs7plusdrv`) finden und `-num` Parameter auslesen
3. Wenn ein Treiber mit der gewünschten Nummer existiert, diesen verwenden (starten falls gestoppt)
4. Wenn kein Treiber mit dieser Nummer existiert aber andere S7Plus-Treiber registriert sind, den ersten verfügbaren verwenden
5. Wenn kein S7Plus-Treiber registriert ist → **Fehler** — Treiber muss erst in Pmon hinzugefügt werden

## Datenpunktstruktur _S7PlusConnection

```
_S7PlusConnection1
├── Config
│   ├── Address                (string: IP-Adresse)
│   ├── PLCType                (int: SPS-Typ)
│   ├── AccessPoint            (string: z.B. "S7ONLINE")
│   ├── DrvNumber              (int: Treibernummer)
│   ├── ConnType               (int: 0=Single, 1=ReduLan)
│   ├── KeepAliveTimeout       (int: Sekunden)
│   ├── ReconnectTimeout       (int: Sekunden)
│   ├── UseUtc                 (bool)
│   ├── Timezone               (int: Offset)
│   ├── SetInvalidBit          (bool)
│   ├── EnableStatistics       (bool)
│   ├── EnableDiagnostics      (bool)
│   ├── ReadOpState            (bool)
│   ├── AcquireValuesOnConnect (bool)
│   ├── TimeSyncMode           (int: 0=Inaktiv, 1=SyncPLCtoOA)
│   ├── TimeSyncInterval       (int: Sekunden)
│   ├── Password               (string)
│   ├── StationName            (string: Browse-Pfad)
│   ├── Codepage               (int)
│   ├── UseTls                 (bool)
│   ├── Certificate            (string: Zertifikatsdatei)
│   ├── EstablishmentMode      (int: 0=Inaktiv, 1=AutomaticActive)
│   ├── LegitimationLevel      (int: Zugriffsebene)
│   ├── ReduAddress            (string: sekundäre IP)
│   ├── ReduAccessPoint        (string)
│   ├── SwitchCondition        (int: Redundanz-Umschaltung)
│   └── SwitchTag              (string: SPS-Variable für Umschaltung)
├── Command
│   ├── Enable                 (bool: Verbindung starten/stoppen)
│   ├── GQ                     (bool: General Query)
│   └── IGQ                    (bool: Initial General Query)
├── State
│   └── ConnState              (int: aktueller Verbindungsstatus)
└── CheckConn                  (intern: Verbindungsüberwachung)
    ├── _address                (Peripherie-Adresskonfiguration)
    └── _distrib                (Treiberzuordnung)
```

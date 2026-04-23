# S7Plus Redundanzkonfiguration

## Überblick

S7Plus unterstützt redundante SPS-Verbindungen für Hochverfügbarkeitsszenarien. Redundanz stellt sicher, dass die Datenerfassung auch bei Ausfall einer SPS oder eines Netzwerkpfads fortgesetzt wird.

## SPS-Typen für Redundanz

| SPS-Typ | Wert | Beschreibung |
|---------|------|-------------|
| RH | 2 | Voll-redundantes System — zwei SPSen im Aktiv/Standby-Betrieb. **System-IP** verwenden (wird von der SPS selbst für Failover verwaltet). |
| RH_Single | 3 | Einzelne SPS in einem redundanten System. **Individuelle CPU-IP** verwenden (nicht die System-IP). |

## Verbindungstypen

| Verbindungstyp | Wert | Beschreibung |
|---------------|------|-------------|
| Single | 0 | Ein Netzwerkpfad zur SPS |
| ReduLan | 1 | Zwei unabhängige Netzwerkpfade (redundantes LAN) |

Bei ReduLan werden zwei IP-Adressen konfiguriert. Der Treiber hält Verbindungen über beide Netzwerkpfade und kann bei Ausfall eines Pfads umschalten.

## Umschaltbedingungen

Die Umschaltbedingung bestimmt, wann der Treiber von der primären SPS zur Backup-SPS wechselt.

### Disabled (0)
Keine automatische Umschaltung. Manuelles Eingreifen erforderlich.

### OpState (1) — Betriebszustand
Schaltet um, wenn sich der Betriebszustand der SPS ändert (z.B. von RUN nach STOP). Der Treiber überwacht `State.OpState`.

### ConnState (2) — Verbindungszustand
Schaltet um, wenn die Verbindung zur primären SPS verloren geht. Deckt Netzwerkausfälle, SPS-Stromausfall oder Kommunikationsfehler ab.

### Both (3) — Kombiniert
Schaltet bei Betriebszustands- ODER Verbindungszustandsänderung um. Höchste Verfügbarkeit, aber möglicherweise häufigere Umschaltungen.

### SwitchTag (4) — Variablen-basiert
Schaltet basierend auf dem Wert einer booleschen SPS-Variable um. Ermöglicht anwendungsgesteuerte Redundanzumschaltung.

Erfordert `Config.SwitchTag`:
```
Config.SwitchCondition = 4
Config.SwitchTag       = "MyDB.SwitchToBackup"
```

Wenn die SPS-Variable `MyDB.SwitchToBackup` den Wert `true` erhält, schaltet der Treiber auf die Backup-SPS um.

## Konfigurationsbeispiele

### Volle Redundanz mit ReduLan

```
Config.Address          = "192.168.1.100"
Config.PLCType          = 2               (RH)
Config.ConnType         = 1               (ReduLan)
Config.ReduAddress      = "192.168.2.100"
Config.ReduAccessPoint  = "S7ONLINE_2"
Config.SwitchCondition  = 3               (Both)
```

Erstellt:
- Primäre Verbindung über 192.168.1.100 auf Access Point S7ONLINE
- Sekundäre Verbindung über 192.168.2.100 auf Access Point S7ONLINE_2
- Automatische Umschaltung bei OpState- oder ConnState-Änderung

### Single-LAN-Redundanz

```
Config.Address          = "192.168.1.100"
Config.PLCType          = 2               (RH)
Config.ConnType         = 0               (Single)
Config.SwitchCondition  = 2               (ConnState)
```

Verwendet einen einzelnen Netzwerkpfad, überwacht aber den Verbindungsstatus für Umschaltung.

## Verbindungsbenennung bei Redundanz

Bei redundanten Verbindungen erstellt WinCC OA automatisch einen Backup-Verbindungsdatenpunkt mit dem Suffix `_2`:

```
_S7PlusConnection1    → Primäre Verbindung
_S7PlusConnection1_2  → Backup-Verbindung (automatisch erstellt)
```

Die `_2`-Verbindungen werden beim Auflisten normalerweise herausgefiltert.

## Redundanz-Datenpunktfelder

```
_S7PlusConnection1
├── Config
│   ├── ConnType          (int: 0=Single, 1=ReduLan)
│   ├── ReduAddress       (string: Backup-SPS-IP)
│   ├── ReduAccessPoint   (string: Backup-Access-Point)
│   ├── SwitchCondition   (int: Umschaltbedingung)
│   └── SwitchTag         (string: SPS-Variable für SwitchTag)
└── State
    ├── ConnState         (int: aktueller Verbindungsstatus)
    └── OpState           (int: SPS-Betriebszustand, wenn ReadOpState=true)
```

## Best Practices

- `Both` (3) als Umschaltbedingung für maximale Verfügbarkeit verwenden
- Failover-Szenarien vor Produktivbetrieb testen
- Sowohl primären als auch Backup-Verbindungsstatus überwachen
- ReduLan (1) verwenden wenn Netzwerksicherheit ein Thema ist — zwei unabhängige Pfade schützen gegen Switch-/Kabelausfälle
- SwitchTag (4) für anwendungsgesteuerte Umschaltung in komplexen Szenarien erwägen

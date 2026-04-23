# S7Plus Adresskonfiguration

## Was ist eine Adresskonfiguration?

Eine Adresskonfiguration verknüpft ein WinCC OA Datenpunktelement (DPE) mit einer SPS-Variable. Sie definiert:
- **Welche SPS-Variable** gelesen/geschrieben wird (symbolische Referenz)
- **Welche Verbindung** verwendet wird
- **In welche Richtung** Daten fließen (lesen, schreiben, beides)
- **Welche Datentyptransformation** angewendet wird
- **Wie gepollt wird** (Intervall, Pollgruppe, Subscription)

## DPE-Namensformat in WinCC OA

```
Datenpunktname.Elementname:_original.._value
│               │            │          │
│               │            │          └── Attribut (der eigentliche Wert)
│               │            └── Config-Name (interne Adresskonfiguration)
│               └── Elementpfad (kann verschachtelt sein: ebene1.ebene2)
└── Datenpunktname
```

**Beispiele:**
- `SPS1.Temperatur.wert` — der Elementpfad
- `SPS1.Temperatur.wert:_original.._value` — mit Config-Attribut

**Wichtig:** Das DPE muss bereits in WinCC OA existieren, bevor die Adresse konfiguriert wird.

## Modi und Richtungen

| Modus | Direction-Wert | Beschreibung |
|-------|---------------|-------------|
| Polling | 7 (IOPoll) | Zyklisches bidirektionales Lesen/Schreiben |
| Subscription | 7 (IOPoll) | Ereignisgesteuert (nur bei Änderung) |
| Output | 1 | Nur Schreiben zur SPS |
| SingleRead | 3 (InputSQuery) | Einmaliges Lesen |
| InputPoll | 4 | Zyklisches Nur-Lesen |
| SingleWrite | 5 (OutputSingle) | Einmaliges Schreiben |
| IOSingleQuery | 8 (IOSQuery) | Einmalige bidirektionale Anfrage |

## Polling vs. Subscription — Der entscheidende Unterschied

Beide verwenden Direction 7 (IOPoll) intern. Der Unterschied:

- **Polling**: Der Treiber liest die SPS-Variable zyklisch im konfigurierten Intervall. Die Pollgruppe definiert die Zykluszeit.
- **Subscription**: Der Treiber registriert sich bei der SPS für Updates nur bei Wertänderung. Dies wird durch Registrierung in `_S7PlusConfig.Subscriptions` aktiviert.

**Wie wird der Subscription-Modus bestimmt?**
Entscheidend ist, ob die Adresse in `_S7PlusConfig.Subscriptions` registriert wird. Intern wird dies durch den `onlyChanges`-Parameter gesteuert:

| Konfiguration | Tatsächliches Verhalten |
|--------------|------------------------|
| Direction 7, keine Subscription-Registrierung | Polling |
| Direction 7, in _S7PlusConfig.Subscriptions registriert | Subscription |

**Subscription-Registrierung:**
Der `_S7PlusConfig` Datenpunkt hat drei parallele dynamische Arrays:
- `Subscriptions.Names` — Pollgruppen-Namen
- `Subscriptions.Pollgroups` — Pollgruppen-Datenpunkt-Referenzen
- `Subscriptions.Options` — Optionen (z.B. onlyChanges Flag)

Diese drei Arrays müssen synchron bleiben (gleicher Index = gleicher Eintrag).

## Drei-Schritt-Adresskonfiguration

Alle WinCC OA Treiberadressen verwenden dieses Muster:

```
Schritt 1: _distrib setzen
  → _type   = DPCONFIG_DISTRIBUTION_INFO
  → _driver = Treibernummer

Schritt 2: _address setzen (alle Felder AUSSER _active)
  → _type       = DPCONFIG_PERIPH_ADDR_MAIN
  → _drv_ident  = "S7PLUS"
  → _connection = Verbindungsdatenpunkt-Name
  → _reference  = symbolische SPS-Adresse
  → _direction  = Direction-Wert (1, 3, 4, 5, 7 oder 8)
  → _datatype   = Transformationswert (1001-1027)
  → _subindex   = 0
  → _internal   = 0
  → _lowlevel   = false
  → _offset     = 0
  → _poll_group = Pollgruppen-Datenpunktname

Schritt 3: _active = true (MUSS ein separater dpSetWait sein)
```

**Warum separate Schritte?** WinCC OA verarbeitet `_address`-Änderungen wenn `_active` auf true wechselt. Werden beide gleichzeitig gesetzt, kann der Treiber eine unvollständig konfigurierte Adresse verwenden — das führt zu Fehlern oder Datenverfälschung.

## Beispiele

### Polling (zyklisches Lesen/Schreiben)

```
_distrib:
  _type   = DPCONFIG_DISTRIBUTION_INFO
  _driver = 1

_address:
  _type       = DPCONFIG_PERIPH_ADDR_MAIN
  _drv_ident  = "S7PLUS"
  _connection = "_S7PlusConnection1"
  _reference  = "DataBlock1.Temperature"
  _direction  = 7                          (IOPoll)
  _datatype   = 1001                       (DEFAULT)
  _poll_group = "_S7Plus_Poll_1s"

_active = true                             (separater dpSetWait!)
```

### Subscription (ereignisgesteuert)

Gleiche Adresskonfiguration wie Polling (Direction 7), **plus** Registrierung in `_S7PlusConfig.Subscriptions`:

```
_address:
  _direction  = 7                          (IOPoll)
  _poll_group = "_S7Plus_Subscr"

Zusätzlich in _S7PlusConfig registrieren:
  Subscriptions.Names[n]      = "_S7Plus_Subscr"
  Subscriptions.Pollgroups[n] = Referenz auf _S7Plus_Subscr
  Subscriptions.Options[n]    = onlyChanges-Flag
```

### Nur Schreiben

```
_address:
  _direction = 1                           (Output)
```
Keine Pollgruppe nötig.

## Pollgruppen

Pollgruppen steuern das Timing der zyklischen Datenerfassung.

### Datenpunktstruktur _PollGroup

```
_S7Plus_Poll_1s (Typ: _PollGroup)
├── PollInterval    (int: Millisekunden)
└── Active          (bool)
```

### Standard-Pollgruppen

| Name | Zweck | Standard-Intervall |
|------|-------|-------------------|
| `_S7Plus_Poll_1s` | Standard-Polling | 1000ms |
| `_S7Plus_Subscr` | Subscription-Registrierung | 1000ms |

Beide verwenden intern `_PollGroup` in WinCC OA. Für Subscription ist die Pollgruppe ein Registrierungs-Handle, kein Timing-Mechanismus.

### Eigene Pollgruppen

Eigene Pollgruppen (z.B. `_S7Plus_Poll_500ms`) können als `_PollGroup`-Datenpunkte angelegt werden. `PollInterval` bestimmt das Intervall in Millisekunden.

## Direction-Details

### Output (1) — Nur Schreiben
Für Sollwerte, Kommandos oder Parameter, die nur zur SPS geschrieben werden.

### InputSQuery (3) — Einmaliges Lesen
Liest den Wert einmal. Kein zyklisches Polling.

### InputPoll (4) — Zyklisches Nur-Lesen
Liest im konfigurierten Intervall. Kann nicht zurückschreiben.

### IOPoll (7) — Bidirektionales Polling / Subscription
Die am häufigsten verwendete Direction. Unterstützt:
- **Polling**: Zyklisches Lesen mit Schreibmöglichkeit
- **Subscription**: Ereignisgesteuert (bei Registrierung in `_S7PlusConfig.Subscriptions`)

### OutputSingle (5) — Einmaliges Schreiben
Sendet einen Wert einmal.

### IOSQuery (8) — Bidirektionale Einmalanfrage
Für einmalige Lese-/Schreiboperationen.

### Nicht unterstützte Directions
- **InputSpont (2)** und **IOSpont (6)** funktionieren bei S7Plus nicht. Das Protokoll erfordert Polling oder explizite Subscription.

## Datentyptransformation

Der `_datatype`-Wert mappt SPS-Datentypen auf WinCC OA Datentypen. Verwende `1001` (DEFAULT) für Auto-Erkennung — empfohlen für die meisten Fälle.

Häufige Mappings:
- DEFAULT (1001) — Auto-Erkennung (empfohlen)
- BOOL (1002) — WinCC OA `bool`
- INT (1012) — WinCC OA `int`
- REAL (1015) — WinCC OA `float`
- STRING (1026) — WinCC OA `string`

Für STRING und WSTRING: `itemLength` auf die maximale Stringlänge der SPS-Variable setzen.

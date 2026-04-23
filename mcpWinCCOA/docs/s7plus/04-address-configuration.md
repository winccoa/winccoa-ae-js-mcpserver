# S7Plus Address Configuration

## What is an Address Configuration?

An address configuration links a WinCC OA datapoint element (DPE) with a PLC variable. It defines:
- **Which PLC variable** is read/written (symbolic reference)
- **Which connection** is used
- **In which direction** data flows (read, write, both)
- **Which data type transformation** is applied
- **How polling is performed** (interval, poll group, subscription)

## DPE Name Format in WinCC OA

```
DatapointName.ElementName:_original.._value
|               |            |          |
|               |            |          +-- Attribute (the actual value)
|               |            +-- Config name (internal address configuration)
|               +-- Element path (can be nested: level1.level2)
+-- Datapoint name
```

**Examples:**
- `PLC1.Temperature.value` — the element path
- `PLC1.Temperature.value:_original.._value` — with config attribute

**Important:** The DPE must already exist in WinCC OA before the address is configured.

## Modes and Directions

| Mode | Direction Value | Description |
|------|----------------|-------------|
| Polling | 7 (IOPoll) | Cyclic bidirectional read/write |
| Subscription | 7 (IOPoll) | Event-driven (only on change) |
| Output | 1 | Write only to PLC |
| SingleRead | 3 (InputSQuery) | Single read |
| InputPoll | 4 | Cyclic read-only |
| SingleWrite | 5 (OutputSingle) | Single write |
| IOSingleQuery | 8 (IOSQuery) | Single bidirectional request |

## Polling vs. Subscription — The Key Difference

Both use Direction 7 (IOPoll) internally. The difference:

- **Polling**: The driver reads the PLC variable cyclically at the configured interval. The poll group defines the cycle time.
- **Subscription**: The driver registers with the PLC for updates only on value change. This is activated by registration in `_S7PlusConfig.Subscriptions`.

**How is the subscription mode determined?**
What matters is whether the address is registered in `_S7PlusConfig.Subscriptions`. Internally, this is controlled by the `onlyChanges` parameter:

| Configuration | Actual Behavior |
|--------------|-----------------|
| Direction 7, no subscription registration | Polling |
| Direction 7, registered in _S7PlusConfig.Subscriptions | Subscription |

**Subscription registration:**
The `_S7PlusConfig` datapoint has three parallel dynamic arrays:
- `Subscriptions.Names` — poll group names
- `Subscriptions.Pollgroups` — poll group datapoint references
- `Subscriptions.Options` — options (e.g., onlyChanges flag)

These three arrays must be kept in sync (same index = same entry).

## Three-Step Address Configuration

All WinCC OA driver addresses use this pattern:

```
Step 1: Set _distrib
  -> _type   = DPCONFIG_DISTRIBUTION_INFO
  -> _driver = driver number

Step 2: Set _address (all fields EXCEPT _active)
  -> _type       = DPCONFIG_PERIPH_ADDR_MAIN
  -> _drv_ident  = "S7PLUS"
  -> _connection = connection datapoint name
  -> _reference  = symbolic PLC address
  -> _direction  = direction value (1, 3, 4, 5, 7, or 8)
  -> _datatype   = transformation value (1001-1027)
  -> _subindex   = 0
  -> _internal   = 0
  -> _lowlevel   = false
  -> _offset     = 0
  -> _poll_group = poll group datapoint name

Step 3: _active = true (MUST be a separate dpSetWait)
```

**Why separate steps?** WinCC OA processes `_address` changes when `_active` transitions to true. If both are set simultaneously, the driver may use an incompletely configured address — leading to errors or data corruption.

## Examples

### Polling (cyclic read/write)

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

_active = true                             (separate dpSetWait!)
```

### Subscription (event-driven)

Same address configuration as polling (Direction 7), **plus** registration in `_S7PlusConfig.Subscriptions`:

```
_address:
  _direction  = 7                          (IOPoll)
  _poll_group = "_S7Plus_Subscr"

Additionally register in _S7PlusConfig:
  Subscriptions.Names[n]      = "_S7Plus_Subscr"
  Subscriptions.Pollgroups[n] = reference to _S7Plus_Subscr
  Subscriptions.Options[n]    = onlyChanges flag
```

### Write Only

```
_address:
  _direction = 1                           (Output)
```
No poll group needed.

## Poll Groups

Poll groups control the timing of cyclic data acquisition.

### Datapoint Structure _PollGroup

```
_S7Plus_Poll_1s (Type: _PollGroup)
+-- PollInterval    (int: milliseconds)
+-- Active          (bool)
```

### Default Poll Groups

| Name | Purpose | Default Interval |
|------|---------|-----------------|
| `_S7Plus_Poll_1s` | Default polling | 1000ms |
| `_S7Plus_Subscr` | Subscription registration | 1000ms |

Both internally use `_PollGroup` in WinCC OA. For subscriptions, the poll group is a registration handle, not a timing mechanism.

### Custom Poll Groups

Custom poll groups (e.g., `_S7Plus_Poll_500ms`) can be created as `_PollGroup` datapoints. `PollInterval` determines the interval in milliseconds.

## Direction Details

### Output (1) — Write Only
For setpoints, commands, or parameters that are only written to the PLC.

### InputSQuery (3) — Single Read
Reads the value once. No cyclic polling.

### InputPoll (4) — Cyclic Read-Only
Reads at the configured interval. Cannot write back.

### IOPoll (7) — Bidirectional Polling / Subscription
The most commonly used direction. Supports:
- **Polling**: Cyclic reading with write capability
- **Subscription**: Event-driven (when registered in `_S7PlusConfig.Subscriptions`)

### OutputSingle (5) — Single Write
Sends a value once.

### IOSQuery (8) — Bidirectional Single Request
For one-time read/write operations.

### Unsupported Directions
- **InputSpont (2)** and **IOSpont (6)** do not work with S7Plus. The protocol requires polling or explicit subscription.

## Data Type Transformation

The `_datatype` value maps PLC data types to WinCC OA data types. Use `1001` (DEFAULT) for auto-detection — recommended for most cases.

Common mappings:
- DEFAULT (1001) — auto-detection (recommended)
- BOOL (1002) — WinCC OA `bool`
- INT (1012) — WinCC OA `int`
- REAL (1015) — WinCC OA `float`
- STRING (1026) — WinCC OA `string`

For STRING and WSTRING: set `itemLength` to the maximum string length of the PLC variable.

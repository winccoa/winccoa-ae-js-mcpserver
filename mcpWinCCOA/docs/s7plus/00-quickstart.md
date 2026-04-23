# S7Plus Quickstart — End-to-End Workflow

Step-by-step guide: from an empty WinCC OA project to receiving PLC values via the S7Plus driver.

## Prerequisites

1. **WinCC OA project is running** with Event Manager and Data Manager active
2. **S7Plus driver is registered in Pmon** (WinCC OA Console)
3. **PLC is reachable** over the network (ping test)
4. **TIA Portal export** is available in the project directory (only needed for offline browsing)
5. **Datapoints exist** in WinCC OA to receive PLC values

## Step 1: Register the S7Plus Driver

The S7Plus driver (`WCCOAs7plusdrv`) must be registered in Pmon before connections can be created.

1. Open WinCC OA Console
2. Add a new manager of type `WCCOAs7plusdrv`
3. Set command line options: `-num 1` (driver number)
4. Start mode: `always` (automatic restart on crash)

The driver does not need to be started manually — it is started automatically when a connection is created.

## Step 2: Create a Connection

### Online Connection (to a live PLC)

Create a `_S7PlusConnection` datapoint and configure it:

```
Config.Address           = "192.168.1.100"
Config.PLCType           = 16               (S7-1500)
Config.DrvNumber         = 1
Config.AccessPoint       = "S7ONLINE"
Config.EstablishmentMode = 1                (AutomaticActive)
Command.Enable           = true
```

### Offline Connection (to a TIA Portal export)

```
Config.Address           = "0.0.0.0"
Config.PLCType           = 1                (Automatic)
Config.DrvNumber         = 1
Config.StationName       = "MyExport|PLC_1"
Config.EstablishmentMode = 0                (Inactive)
```

## Step 3: Verify Connection State

Check the value of `_S7PlusConnection1.State.ConnState`:

| Value | Meaning |
|-------|---------|
| 0 | Inactive |
| 1 | Disconnected |
| 2 | Connecting |
| **3** | **Connected** (target state) |
| 4 | Disconnecting |
| 5 | Failure |

If `Failure` (5), check:
- Is the IP address correct?
- Does the PLC type match? (PLCSim=768, S7-1500=16)
- Is a firewall blocking TCP port 102?

## Step 4: Browse the PLC Structure

Use the S7Plus driver's browse mechanism to discover available PLC variables. The browse returns for each variable:

- `path` — the symbolic path (used as `_reference` in the address configuration)
- `valueType` — the PLC data type (helps choose the right transformation)
- `hasChildren` — whether deeper navigation is possible

Example result node:
```
path:        "DataBlock1.Temperature"
valueType:   "Real"
hasChildren: false
```

## Step 5: Create Datapoints in WinCC OA

Target datapoints must exist in WinCC OA before addresses can be configured. Create them using the PARA module or via CTRL scripts. The WinCC OA data type should match the PLC variable type:

| PLC Type | WinCC OA Type |
|----------|---------------|
| Bool | bool |
| Int, DInt, USInt, UInt, etc. | int |
| Real | float |
| LReal | float |
| String, WString | string |
| Date, DateTime, Time | time |

## Step 6: Configure the Address

The address configuration links a datapoint element (DPE) to a PLC variable. Configuration is done via `_address` and `_distrib` on the DPE.

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
  _datatype   = 1001                       (DEFAULT = auto-detect)
  _poll_group = "_S7Plus_Poll_1s"
  _active     = true                       (MUST be set separately!)
```

### Subscription (event-driven, only on change)

Same as polling (direction 7), but additionally registered in `_S7PlusConfig.Subscriptions`. The difference lies not in the direction but in the subscription registration.

### Write-only (send setpoints to PLC)

```
_address:
  _direction = 1                           (Output)
```

## Step 7: Verify Data Flow

After address configuration, WinCC OA should start receiving PLC values. Verify using:
- **PARA module** (check the datapoint value)
- **CTRL script** with `dpGet()` or `dpConnect()`
- **GEDI module** (create a panel with the datapoint)

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Wrong PLC type | Connection shows `Failure` | Use correct type (16=S7-1500, 768=PLCSim) |
| No S7Plus driver in Pmon | Connection cannot be established | Add `WCCOAs7plusdrv` in WinCC OA Console |
| DPE does not exist | Address configuration fails | Create the datapoint first in PARA |
| Wrong symbolic path | No data arrives | Use browse to find the correct path |
| Subscription without registration | Behaves like polling | Register in `_S7PlusConfig.Subscriptions` |
| `_active` set together with `_address` | Race condition, corrupt data | Always set `_active` in a separate `dpSetWait` |

## Complete Example: Temperature Monitoring

```
1. Register driver:
   Add WCCOAs7plusdrv to Pmon with -num 1

2. Create datapoint:
   "Furnace.Temperature.actual" in WinCC OA (type: float)

3. Create connection:
   _S7PlusConnection1 with IP 192.168.1.100, PLCType 16, DrvNumber 1

4. Verify connection:
   State.ConnState = 3 (Connected)

5. Find variable:
   Browse → path="FurnaceDB.Temperature", valueType="Real"

6. Configure address:
   On DPE "Furnace.Temperature.actual":
   _distrib: _driver=1
   _address: _drv_ident="S7PLUS", _connection="_S7PlusConnection1",
             _reference="FurnaceDB.Temperature", _direction=7,
             _datatype=1015 (REAL), _poll_group="_S7Plus_Subscr"
   _active: true (separate dpSetWait)
   Register in _S7PlusConfig.Subscriptions for subscription mode

7. WinCC OA now receives temperature updates from the PLC on every value change.
```

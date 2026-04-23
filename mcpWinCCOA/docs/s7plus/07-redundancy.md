# S7Plus Redundancy Configuration

## Overview

S7Plus supports redundant PLC connections for high-availability scenarios. Redundancy ensures that data acquisition continues even if a PLC or a network path fails.

## PLC Types for Redundancy

| PLC Type | Value | Description |
|----------|-------|-------------|
| RH | 2 | Fully redundant system — two PLCs in active/standby operation. **Use the system IP** (managed by the PLC itself for failover). |
| RH_Single | 3 | Single PLC in a redundant system. **Use the individual CPU IP** (not the system IP). |

## Connection Types

| Connection Type | Value | Description |
|----------------|-------|-------------|
| Single | 0 | One network path to the PLC |
| ReduLan | 1 | Two independent network paths (redundant LAN) |

With ReduLan, two IP addresses are configured. The driver maintains connections over both network paths and can switch over if one path fails.

## Switch Conditions

The switch condition determines when the driver switches from the primary PLC to the backup PLC.

### Disabled (0)
No automatic switchover. Manual intervention required.

### OpState (1) — Operating State
Switches when the operating state of the PLC changes (e.g., from RUN to STOP). The driver monitors `State.OpState`.

### ConnState (2) — Connection State
Switches when the connection to the primary PLC is lost. Covers network failures, PLC power loss, or communication errors.

### Both (3) — Combined
Switches on operating state OR connection state change. Highest availability, but potentially more frequent switchovers.

### SwitchTag (4) — Variable-Based
Switches based on the value of a boolean PLC variable. Enables application-controlled redundancy switchover.

Requires `Config.SwitchTag`:
```
Config.SwitchCondition = 4
Config.SwitchTag       = "MyDB.SwitchToBackup"
```

When the PLC variable `MyDB.SwitchToBackup` receives the value `true`, the driver switches to the backup PLC.

## Configuration Examples

### Full Redundancy with ReduLan

```
Config.Address          = "192.168.1.100"
Config.PLCType          = 2               (RH)
Config.ConnType         = 1               (ReduLan)
Config.ReduAddress      = "192.168.2.100"
Config.ReduAccessPoint  = "S7ONLINE_2"
Config.SwitchCondition  = 3               (Both)
```

Creates:
- Primary connection via 192.168.1.100 on access point S7ONLINE
- Secondary connection via 192.168.2.100 on access point S7ONLINE_2
- Automatic switchover on OpState or ConnState change

### Single-LAN Redundancy

```
Config.Address          = "192.168.1.100"
Config.PLCType          = 2               (RH)
Config.ConnType         = 0               (Single)
Config.SwitchCondition  = 2               (ConnState)
```

Uses a single network path but monitors the connection state for switchover.

## Connection Naming with Redundancy

With redundant connections, WinCC OA automatically creates a backup connection datapoint with the suffix `_2`:

```
_S7PlusConnection1    -> Primary connection
_S7PlusConnection1_2  -> Backup connection (automatically created)
```

The `_2` connections are normally filtered out when listing.

## Redundancy Datapoint Fields

```
_S7PlusConnection1
+-- Config
|   +-- ConnType          (int: 0=Single, 1=ReduLan)
|   +-- ReduAddress       (string: backup PLC IP)
|   +-- ReduAccessPoint   (string: backup access point)
|   +-- SwitchCondition   (int: switch condition)
|   +-- SwitchTag         (string: PLC variable for SwitchTag)
+-- State
    +-- ConnState         (int: current connection status)
    +-- OpState           (int: PLC operating state, when ReadOpState=true)
```

## Best Practices

- Use `Both` (3) as the switch condition for maximum availability
- Test failover scenarios before production deployment
- Monitor both primary and backup connection status
- Use ReduLan (1) when network reliability is a concern — two independent paths protect against switch/cable failures
- Consider SwitchTag (4) for application-controlled switchover in complex scenarios

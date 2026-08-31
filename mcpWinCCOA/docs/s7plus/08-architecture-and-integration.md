# S7Plus Architecture in WinCC OA

## System Architecture

```
+------------------------------------------+
|  WinCC OA Runtime                        |
|  +-- Event Manager                      |
|  +-- Data Manager                       |
|  +-- S7Plus Driver (WCCOAs7plusdrv)      |
|  +-- Pmon (Process Monitor)             |
+------------------------------------------+
         |                    |
         | dpSetWait/dpGet    | S7Plus Protocol (TCP 102)
         v                    v
   WinCC OA Datapoints    Siemens PLC (S7-1200/1500)
```

## Flow: Creating a Connection

```
1. Check S7Plus driver in Pmon
   - Is a driver with the desired number registered?
   - If yes: use it (start if stopped)
   - If no: error — driver must be registered first

2. Create _S7PlusConnection datapoint

3. Set Config values
   - Config.Address, Config.PLCType, Config.DrvNumber, ...
   - Config.EstablishmentMode, timeouts, TLS, redundancy

4. Configure CheckConn (three-step)
   - _distrib -> _address -> _active

5. Activate connection
   - Config.EstablishmentMode = 1 (AutomaticActive)
   - Command.Enable = true

6. S7Plus driver connects to the PLC
   - State.ConnState transitions to 3 (Connected)
```

## Flow: Configuring an Address

```
1. Verify DPE existence in WinCC OA

2. Determine mode (polling vs. subscription)

3. Create poll group if needed
   - _PollGroup datapoint with PollInterval

4. For subscription: register in _S7PlusConfig
   - Subscriptions.Names, Pollgroups, Options (keep in sync)

5. Configure address (three-step)
   - Step 1: dpSetWait -> _distrib
   - Step 2: dpSetWait -> _address (without _active)
   - Step 3: dpSetWait -> _active = true

6. S7Plus driver begins reading the PLC variable
   - DPE value in Data Manager is updated
```

## Three-Step Address Pattern

This fundamental pattern applies to all address configurations in WinCC OA:

```
Step 1: _distrib     -> Assigns the DPE to a specific driver
Step 2: _address     -> Configures how the PLC variable is read/written
Step 3: _active=true -> Activates the address (MUST be a separate dpSetWait)
```

**Why is _active separate?**
WinCC OA processes _address changes when _active transitions to true. If both are set simultaneously, the driver may use an incompletely configured address — errors or data corruption are the result.

## Pmon (Process Monitor)

Pmon is the process manager of WinCC OA. The S7Plus driver interacts with Pmon for:

- **Listing managers**: Which S7Plus drivers are registered and running
- **Reading driver numbers**: `-num` parameter from the manager command line
- **Starting stopped drivers**: Starting registered but stopped drivers
- **Detecting conflicts**: Ensuring driver numbers do not conflict with other drivers

### Registering a Driver

The S7Plus driver is registered in Pmon as follows:

```
Manager:     WCCOAs7plusdrv
Position:    (position in the startup order)
Start mode:  always (automatic restart on crash)
Options:     -num 1 (driver number)
SecKill:     30 (seconds until SIGKILL)
RestartCount: 3 (restart attempts)
ResetMin:    5 (minutes to reset the restart counter)
```

## Important WinCC OA Datapoints for S7Plus

| Datapoint | Type | Scope | Purpose |
|-----------|------|-------|---------|
| `_S7PlusConnection<n>` | _S7PlusConnection | Per connection | Connection configuration, status, commands |
| `_S7PlusConnection<n>_2` | _S7PlusConnection | Per redundant connection | Automatically created backup connection |
| `_S7PlusConfig` | _S7PlusConfig | Global (once per project) | CA certificates and subscription registration |
| `_S7Plus_Poll_1s` | _PollGroup | Global | Default poll group for polling (1000ms) |
| `_S7Plus_Subscr` | _PollGroup | Global | Default poll group for subscriptions |

## S7Plus Behavior at a Glance

| Aspect | Behavior |
|--------|----------|
| Driver auto-creation | No — must be registered in Pmon beforehand |
| Driver auto-start | Yes — automatically starts a stopped driver |
| Subscription mechanism | Via `_S7PlusConfig.Subscriptions` registration |
| Browse capability | Yes — online (running PLC) and offline (TIA export) |
| TIA Portal integration | Yes — browse and detection of TIA exports |
| Redundancy support | Yes — ReduLan + various switch conditions |
| Protocol | S7Plus over TCP port 102 |
| Addressing | Exclusively symbolic (no byte/bit addresses) |

# Oil & Gas Industry Instructions

## Overview
This configuration applies to WinCC OA systems used in Oil & Gas production, refining, and distribution facilities.

## Safety Requirements
- **CRITICAL**: Never modify safety-critical datapoints without explicit authorization
- All changes to production systems require validation and confirmation
- Emergency shutdown systems are strictly read-only
- Interlock conditions must be verified before any process modifications

## Operational Limits
- **Flow rates**: 0-1000 m³/h (validate against pipe capacity)
- **Pressure**: Maximum 100 bar (safety valve at 110 bar)
- **Temperature**: -20°C to +80°C operational range
- **Valve positions**: 0-100% (check for intermediate restrictions)

## Datapoint Naming Conventions
- `*_SAFETY_*`: Safety instrumented systems - READ ONLY
- `*_ESD_*`: Emergency shutdown - READ ONLY
- `*_PROD_*`: Production systems - requires validation
- `*_FLOW_*`: Flow measurements and control
- `*_PRESSURE_*`: Pressure measurements and control
- `*_TEMP_*`: Temperature measurements and control
- `*_VALVE_*`: Valve positions and control
- `*_AI_Assistant`: Datapoints designated for AI manipulation

## Process Control Rules
1. **Before changing flow rates**:
   - Verify upstream and downstream pressures
   - Check valve positions in the flow path
   - Confirm tank levels are within limits

2. **Recipe Management**:
   - Recipe percentages represent VALVE POSITIONS, not volume percentages
   - Material consumption = (valve_position/100) × flow_rate × time
   - Always validate total consumption against target volume

3. **Cascade Control**:
   - Changes to master controllers affect all slaves
   - Verify slave controller limits before modifying master setpoints

## Alarm Management
- Critical alarms (Priority 1-2) require immediate operator attention
- Do not suppress alarms without proper authorization
- Alarm limits should only be modified through approved change management

## Integration Points
- OPC UA nodes under `ns=2;s=Production/*` are production critical
- Modbus registers 40001-40100 contain safety interlocks
- SQL historian updates every 10 seconds for trending data

## Compliance Notes
- All changes are logged for regulatory compliance
- Maintain audit trail for production setpoint modifications
- Environmental limits must be respected at all times
# Transportation Systems Instructions

## Overview
This configuration applies to WinCC OA systems used in transportation infrastructure including rail, traffic management, and logistics systems.

## Safety Critical Systems
- **Emergency Stop Systems**: Absolutely read-only, no modifications allowed
- **Signal Interlocking**: Changes must respect interlocking logic
- **Track Switching**: Requires coordination with dispatch systems
- **Platform Safety**: Door and barrier systems have strict sequencing

## Traffic Signal Management
- Signal states must follow proper sequencing (RED → RED+YELLOW → GREEN → YELLOW → RED)
- Pedestrian crossings have priority during their active phase
- Conflicting movements must be interlocked
- Emergency vehicle preemption overrides normal operation

## Datapoint Naming Conventions
- `*_EMSTOP_*`: Emergency stop systems - STRICTLY READ ONLY
- `*_SIGNAL_*`: Traffic or rail signals - validate sequences
- `*_TRACK_*`: Track/route control - coordinate with dispatch
- `*_BARRIER_*`: Safety barriers and gates
- `*_DETECTOR_*`: Vehicle/train detection systems
- `*_DISPATCH_*`: Dispatch and scheduling systems
- `*_AI_Assistant`: Datapoints designated for AI manipulation

## Operational Rules

### Rail Systems
1. **Track Switching**:
   - Verify no train in section before switching
   - Check signal aspects match intended route
   - Confirm switch position feedback

2. **Signal Control**:
   - Maintain safe braking distances
   - Respect block occupancy
   - Follow fail-safe principles (default to stop)

### Traffic Management
1. **Intersection Control**:
   - Minimum green times must be respected
   - Yellow phase duration based on approach speed
   - All-red clearance intervals are mandatory

2. **Adaptive Control**:
   - Queue detectors influence timing
   - Bus/tram priority requires validation
   - Network coordination maintains green waves

## Communication Systems
- CCTV systems are monitor-only unless specifically designated
- Variable message signs require approved messages
- PA systems have zone-based authorization

## Scheduling Integration
- Timetable systems are authoritative for planned movements
- Real-time adjustments must consider knock-on effects
- Passenger information systems update automatically

## Data Recording
- All control actions are logged with timestamp and operator
- Video recording retention follows legal requirements
- Incident data preserved for investigation

## Maintenance Mode
- Maintenance overrides require special authorization
- Test modes must not affect live operations
- Return to normal operation requires verification

## Environmental Considerations
- Weather stations may trigger speed restrictions
- Ice/snow detection affects signal timing
- Wind sensors can close bridges/tunnels

## Integration Protocols
- IEC 61850 for substation automation
- NTCIP for traffic devices
- RaSTA for safety-critical rail communication
# Default WinCC OA Instructions

## Overview
These are general instructions for WinCC OA systems when no specific field configuration is selected.

## General Safety Guidelines
- Always verify the impact of changes before execution
- Critical systems should not be modified without authorization
- Emergency stop functionality must remain accessible
- Backup current values before making modifications

## Datapoint Conventions
- `*_AI_Assistant`: Datapoints designated for AI manipulation
- `*_TEST_*`: Test points safe for experimentation
- `*_DEMO_*`: Demonstration datapoints
- System datapoints (starting with `_`) are generally read-only

## Best Practices
1. **Read Before Write**:
   - Always check current value before modification
   - Understand the datapoint's purpose and connections
   - Verify engineering units and ranges

2. **Change Management**:
   - Document reasons for changes
   - Consider impact on connected systems
   - Test in non-production environment when possible

3. **Monitoring**:
   - Watch for alarms after making changes
   - Verify expected behavior
   - Be prepared to revert changes if needed

## Common Datapoint Types
- **Analog Values**: Respect min/max limits
- **Digital Values**: Usually 0/1 or TRUE/FALSE
- **String Values**: Check for valid enumeration values
- **Complex Types**: Modify individual elements carefully

## System Integration
- External systems may have delayed reactions
- Database updates may not be immediate
- Communication timeouts should be considered

## Troubleshooting
- Check datapoint quality codes
- Verify communication status
- Look for configuration mismatches
- Review recent changes in system

## Access Control
- Respect user permissions
- Some operations require elevated privileges
- Audit trails track all modifications

This default configuration provides basic safety while allowing experimentation with designated test points.
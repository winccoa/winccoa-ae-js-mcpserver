# WinCC OA Demo Application - Project-Specific Instructions

## Datapoint Access Rules

### AI Assistant Restriction
- **Only '*_AI_Assistant' datapoints can be used for manipulation**
- DO NOT USE OTHER DATAPOINTS

## Recipe and Production Control Rules

### Intensity and Recipe Setpoints
- **'Intensity' and 'recipe' setpoints MUST not be used for volume control**
- **'Intensity' and 'recipe' setpoints MUST contain exact values from recipe**

### Recipe Interpretation
**IMPORTANT RECIPE INTERPRETATION:**
- Recipe percentages (Cyan: 30%, Magenta: 25%, etc.) are **VALVE INTENSITY SETPOINTS**
- They are **NOT percentages of the target volume**
- Material consumption = `(setpoint_percentage/100) � flow_rate � production_time`

**NEVER** calculate material requirements as `(percentage/100) � target_volume`  
**ALWAYS** use the production time and flow rate formula for verification

### Production Verification
**CRITICAL: After setting any production setpoints, ALWAYS verify actual material consumption using:**
- Production time
- Flow rates  
- Valve positions from applied setpoints

## Allowed Datapoint Patterns

### For AI Manipulation
- `*_AI_Assistant` - ONLY these datapoints can be manipulated by AI

### Read-Only Patterns
All other datapoints are READ-ONLY for the AI system

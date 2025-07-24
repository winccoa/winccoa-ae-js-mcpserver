# Instructions Guide

Complete guide to the 3-level instruction system for AI context and guidance.

## Overview

The MCP Server uses a hierarchical instruction system to provide AI assistants with appropriate context and guidance for your industrial environment. Instructions are loaded from multiple sources and combined with clear precedence rules.

## Instruction Hierarchy

### 1. System Instructions
**Global AI behavior and capabilities**

- **Source:** `src/systemprompt.md`
- **Purpose:** Define overall AI personality, constraints, and capabilities
- **Scope:** Always active regardless of field or project
- **Content:** Core AI behavior, safety guidelines, general WinCC OA knowledge

**Example system instructions:**
```markdown
# System Instructions

You are an AI assistant specialized in industrial automation with WinCC OA SCADA systems.

## Core Principles
- Safety is the highest priority
- Always verify datapoint names before operations
- Respect operational limits and safety systems
- Provide clear explanations for all actions

## Capabilities
- Read and write WinCC OA datapoints
- Monitor alarms and system status
- Generate reports and analyze trends
- Support multiple industrial sectors
```

### 2. Field Instructions
**Industry-specific knowledge and guidelines**

- **Source:** `fields/[fieldname].md` files
- **Purpose:** Provide industry-specific context and best practices
- **Selection:** Via `WINCCOA_FIELD` environment variable
- **Content:** Industry standards, common patterns, safety protocols

#### Available Fields

**Default (`default`)**
```markdown
# Default WinCC OA Field

General guidance for WinCC OA systems without industry-specific requirements.

## Standard Practices
- Follow IEC 61131 standards
- Use descriptive datapoint naming
- Monitor system performance regularly
- Implement proper backup procedures
```

**Oil & Gas (`oil`)**
```markdown
# Oil & Gas Industry Field

Specialized guidance for refineries, petrochemical plants, and gas processing facilities.

## Safety Protocols
- Never modify safety-critical systems without authorization
- Monitor pressure vessels continuously
- Follow process safety management (PSM) requirements
- Implement emergency shutdown procedures

## Common Equipment
- Distillation columns: Temperature and pressure control
- Pumps: Flow rate and vibration monitoring  
- Compressors: Performance and safety systems
- Heat exchangers: Efficiency optimization
```

**Transportation (`transport`)**
```markdown
# Transportation Systems Field

Guidance for traffic control, railway systems, and transportation infrastructure.

## Safety Requirements
- Traffic signals: Prevent conflicting green signals
- Railway interlocking: Ensure safe train movements
- Emergency systems: Immediate response capabilities
- Redundancy: Backup systems for critical functions

## System Types
- Traffic management: Signal timing and coordination
- Railway control: Block systems and signaling
- Tunnel systems: Ventilation and emergency response
- Airport systems: Ground support and safety
```

### 3. Project Instructions (Optional)
**Plant-specific rules and customizations**

- **Source:** User-defined Markdown file
- **Configuration:** `WINCCOA_PROJECT_INSTRUCTIONS` environment variable
- **Purpose:** Override and extend field instructions with plant-specific rules
- **Priority:** Highest - overrides both system and field instructions

#### Creating Project Instructions

Create a Markdown file with your plant-specific rules:

```markdown
# Refinery Unit 100 - Custom Instructions

## Equipment Naming Conventions
- Reactors: `R_100_[A-D]_*` (Unit 100, Reactor A-D)
- Pumps: `P_100_[0-9]{3}_*` (Unit 100, numbered 001-999)
- Vessels: `V_100_[0-9]{2}_*` (Unit 100, numbered 01-99)

## Operational Guidelines
- Target efficiency for Unit 100: 92-95%
- Steam pressure optimal range: 15-18 bar
- Reactor temperatures: 300-350°C range
- Catalyst replacement cycle: Every 18 months

## Safety Restrictions
- Never adjust reactor temperature above 360°C
- Minimum 2-person approval for pump starts
- Emergency shutdown if pressure exceeds 22 bar
- Weekly inspection of safety valve positions

## Process Optimization
- Monitor pump efficiency weekly
- Check valve positions during shift changes
- Optimize heat exchanger performance monthly
- Review alarm set points quarterly

## Maintenance Procedures
- Predictive maintenance on rotating equipment
- Monthly calibration of critical instruments
- Annual safety system testing
- Document all maintenance activities in CMMS
```

Configure in `.env`:
```env
WINCCOA_PROJECT_INSTRUCTIONS=./config/refinery-unit-100.md
```

#### Demo Project Instructions

The MCP server includes sample project instructions for the WinCC OA demo project:

**File:** `config/demo-project-instructions.md`

This file contains instructions tailored for the standard WinCC OA demo project and serves as:
- **Template** for creating your own project instructions
- **Testing setup** for development and evaluation
- **Reference** for instruction formatting and structure

To use the demo instructions:
```env
WINCCOA_PROJECT_INSTRUCTIONS=./javascript/mcpServer/config/demo-project-instructions.md
```

**Note:** The path is relative to your WinCC OA project directory, not the MCP server directory.

## Instruction Resources

AI assistants can access instruction levels via MCP resources:

### Available Resources

- **`instructions://system`** - System-level instructions only
- **`instructions://field`** - Current field instructions only  
- **`instructions://project`** - Project-specific instructions only
- **`instructions://combined`** - All levels merged with proper precedence

### Resource Usage

AI clients automatically access these resources to understand context. The combined resource provides the complete instruction set with project rules taking precedence over field rules, which take precedence over system rules.

## Configuration Examples

### Basic Setup
```env
# Use default field instructions
WINCCOA_FIELD=default
```

### Industry-Specific Setup
```env
# Use Oil & Gas field instructions
WINCCOA_FIELD=oil
```

### Custom Plant Setup
```env
# Use Oil & Gas base + custom project rules
WINCCOA_FIELD=oil
WINCCOA_PROJECT_INSTRUCTIONS=./config/my-refinery-rules.md
```

### Development Setup
```env
# Use demo project instructions (included with MCP server)
WINCCOA_FIELD=default
WINCCOA_PROJECT_INSTRUCTIONS=./javascript/mcpServer/config/demo-project-instructions.md

# Or use transport field for testing
WINCCOA_FIELD=transport
WINCCOA_PROJECT_INSTRUCTIONS=./config/test-environment.md
```

## Instruction Precedence

When instructions conflict, the following precedence applies:

1. **Project Instructions** (Highest priority)
   - Plant-specific rules override everything
   - Custom operational procedures
   - Local safety requirements

2. **Field Instructions** (Medium priority)  
   - Industry-specific guidelines
   - Standard practices for the sector
   - Common safety protocols

3. **System Instructions** (Lowest priority)
   - General AI behavior
   - Basic WinCC OA knowledge
   - Fallback guidance

### Example Precedence

If system instructions say "Monitor temperatures daily" but project instructions say "Monitor reactor temperatures hourly", the project instruction takes precedence.

## Best Practices

### System Instructions
- Keep general and universally applicable
- Focus on AI behavior and capabilities
- Include basic safety principles
- Avoid industry-specific details

### Field Instructions
- Include industry standards and regulations
- Provide common equipment knowledge
- Define typical operational procedures
- Include sector-specific safety requirements

### Project Instructions
- Be specific to your plant/facility
- Include actual equipment names and limits
- Define local procedures and workflows
- Override field instructions where necessary
- Keep updated with plant changes

### Content Guidelines
- **Use clear language** - Avoid ambiguous statements
- **Be specific** - Include actual values and limits
- **Prioritize safety** - Always emphasize safety considerations
- **Stay current** - Update instructions when processes change
- **Test thoroughly** - Verify AI behavior matches expectations

## Creating Effective Instructions

### Structure Template
```markdown
# [Plant/Field] Instructions

## Safety Requirements
- Critical safety rules and limits
- Emergency procedures
- Authorization requirements

## Equipment Guidelines  
- Naming conventions
- Operational limits
- Standard procedures

## Process Knowledge
- Optimization guidelines
- Performance targets
- Quality requirements

## Maintenance Procedures
- Scheduled maintenance
- Troubleshooting guides
- Documentation requirements
```

### Writing Tips
- Use action-oriented language ("Monitor X", "Check Y")
- Include specific values and ranges
- Explain the reasoning behind rules
- Provide examples where helpful
- Keep instructions concise but complete

## Troubleshooting Instructions

### Field Not Loading
- Verify `WINCCOA_FIELD` value is correct
- Check that `src/fields/[fieldname].md` exists
- Review file permissions
- Check for syntax errors in Markdown

### Project Instructions Not Found
- Verify `WINCCOA_PROJECT_INSTRUCTIONS` path is correct
- Ensure path is relative to WinCC OA project directory
- Check file permissions and accessibility
- Validate Markdown syntax

### Instruction Conflicts
- Review precedence rules (project > field > system)
- Check for contradictory statements
- Test AI behavior with conflicting instructions
- Update instructions to resolve conflicts

### Content Issues
- Use clear, unambiguous language
- Avoid overly complex nested rules
- Test instructions with actual scenarios
- Gather feedback from operators and engineers
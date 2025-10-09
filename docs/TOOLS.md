# Tools Guide

Complete reference for available tools and custom tool development.

## Overview

The MCP server provides tools that AI assistants can use to interact with WinCC OA systems. Tools are loaded dynamically based on the `TOOLS` configuration in your `.env` file.

## Available Tools

### Datapoint Tools

**`datapoints/dp_basic`** - Basic datapoint operations
- `get-dpTypes` - List available datapoint types
- `get-datapoints` - Search datapoints by pattern  
- `get-value` - Read current values and timestamps

**`datapoints/dp_create`** - Create new datapoints
- `create-datapoint` - Create datapoints with specified type and optional system/ID

**`datapoints/dp_set`** - Datapoint value setting
- `dp-set` - Write values to datapoints

**`datapoints/dp_types`** - Datapoint type management
- `dp-type-get` - Get structure of a datapoint type as tree
- `dp-type-name` - Get datapoint type for a given datapoint name

**`datapoints/dp_type_create`** - Create new datapoint types
- `dp-type-create` - Create datapoint types (DPT) with complete structure definitions

### OPC UA Tools

**`opcua/opcua_connection`** - OPC UA connection management
- `opcua-add-connection` - Create and configure OPC UA client connections
- `opcua-browse` - Browse OPC UA address space and explore available nodes

## Tool Configuration

### Basic Configuration

```env
# Load all available tools
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,datapoints/dp_type_create,opcua/opcua_connection

# Load only basic datapoint operations
TOOLS=datapoints/dp_basic,datapoints/dp_set

# Load only creation and type tools
TOOLS=datapoints/dp_create,datapoints/dp_types,datapoints/dp_type_create

# Load only OPC UA tools
TOOLS=opcua/opcua_connection
```

### Error Handling

If a tool file doesn't exist or fails to load:
- An error is logged to the console
- The server continues running with other tools
- Missing tools won't be available to AI clients

## Custom Tool Development

You can create your own tools to extend the MCP server with custom WinCC OA functionality.

### Tool Structure

1. **File Location:** `src/tools/[category]/[toolname].js`
2. **Export Function:** Must export `registerTools(server, context)`  
3. **Return Count:** Function must return number of tools registered

### Basic Tool Template

Create `src/tools/custom/my-tool.js`:

```javascript
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

/**
 * Register custom tools with the MCP server
 * @param {Object} server - MCP server instance
 * @param {Object} context - Shared context with winccoa instance
 * @returns {number} Number of tools registered
 */
export function registerTools(server, context) {
  const { winccoa } = context;

  server.tool("my-custom-tool", "Description of what this tool does", {
    // Input validation using Zod
    parameter1: z.string().min(1, "Parameter 1 is required"),
    parameter2: z.number().optional(),
    parameter3: z.boolean().default(false)
  }, async ({ parameter1, parameter2, parameter3 }) => {
    try {
      // Your WinCC OA logic here
      console.log(`Executing custom tool with: ${parameter1}`);
      
      // Example: Use winccoa manager functions
      // const values = await winccoa.dpGet([parameter1]);
      // const result = await winccoa.dpSet([parameter1], [newValue]);
      
      const result = {
        message: `Processed ${parameter1}`,
        value: parameter2 || 0,
        enabled: parameter3
      };

      return createSuccessResponse(result);
    } catch (error) {
      console.error('Error in custom tool:', error);
      return createErrorResponse(`Failed to process: ${error.message}`);
    }
  });

  return 1; // Number of tools registered
}
```

### Advanced Tool Example

More complex tool with multiple operations:

```javascript
import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

export function registerTools(server, context) {
  const { winccoa } = context;

  // Tool 1: Pump Control
  server.tool("control-pump", "Start/stop pumps with safety checks", {
    pumpName: z.string().min(1),
    action: z.enum(['start', 'stop']),
    force: z.boolean().default(false)
  }, async ({ pumpName, action, force }) => {
    try {
      // Safety check: verify pump exists
      const pumpExists = await winccoa.dpExists(pumpName);
      if (!pumpExists) {
        return createErrorResponse(`Pump ${pumpName} not found`);
      }

      // Safety check: check maintenance mode (unless forced)
      if (!force) {
        const maintenance = await winccoa.dpGet([`${pumpName}.maintenance`]);
        if (maintenance[0]) {
          return createErrorResponse(`Pump ${pumpName} is in maintenance mode`);
        }
      }

      // Execute action
      const command = action === 'start' ? 1 : 0;
      await winccoa.dpSet([`${pumpName}.command`], [command]);

      return createSuccessResponse({
        pump: pumpName,
        action: action,
        status: 'success',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return createErrorResponse(`Pump control failed: ${error.message}`);
    }
  });

  // Tool 2: Batch Operations
  server.tool("batch-operation", "Execute operations on multiple datapoints", {
    pattern: z.string().min(1),
    operation: z.enum(['read', 'reset']),
    filter: z.string().optional()
  }, async ({ pattern, operation, filter }) => {
    try {
      // Find matching datapoints
      const datapoints = winccoa.dpNames(pattern);
      let filteredDps = datapoints;

      // Apply additional filter if provided
      if (filter) {
        filteredDps = datapoints.filter(dp => dp.includes(filter));
      }

      const results = [];

      for (const dp of filteredDps) {
        try {
          if (operation === 'read') {
            const value = await winccoa.dpGet([dp]);
            results.push({ datapoint: dp, value: value[0], status: 'success' });
          } else if (operation === 'reset') {
            await winccoa.dpSet([dp], [0]);
            results.push({ datapoint: dp, status: 'reset' });
          }
        } catch (error) {
          results.push({ datapoint: dp, status: 'error', error: error.message });
        }
      }

      return createSuccessResponse({
        operation: operation,
        pattern: pattern,
        processed: results.length,
        results: results
      });
    } catch (error) {
      return createErrorResponse(`Batch operation failed: ${error.message}`);
    }
  });

  return 2; // Number of tools registered
}
```

### Enable Your Custom Tool

Add to `.env` configuration:

```env
# Include your custom tool
TOOLS=datapoints/dp_basic,datapoints/dp_set,custom/my-tool
```

### Available Context

Your tool has access to these context objects:

```javascript
const { 
  winccoa,        // WinCC OA manager instance
  fieldContent,   // Current field instructions  
  projectContent, // Project-specific instructions
  systemPrompt    // System prompt content
} = context;
```

### Helper Functions

Import these utilities for consistent responses:

```javascript
import { 
  createSuccessResponse,     // Standard success format
  createErrorResponse,       // Standard error format
  mkTypesContent,           // Format datapoint types
  addDescriptionAndUnitsToChildren  // Add metadata to structures
} from '../../utils/helpers.js';
```

### WinCC OA Manager Functions

Common winccoa-manager functions available:

```javascript
// Datapoint operations
await winccoa.dpGet(['System1:Pump.state']);
await winccoa.dpSet(['System1:Pump.command'], [1]);
await winccoa.dpCreate('newDp', 'ExampleDP_Float');

// Query operations  
winccoa.dpNames('System1:*Pump*');
winccoa.dpTypes('*Pump*');
winccoa.dpExists('System1:Pump');

// Metadata
winccoa.dpTypeName('System1:Pump');
winccoa.dpGetDescription('System1:Pump');
winccoa.dpGetUnit('System1:Pump.value');
```

## Best Practices

### Tool Design
1. **Clear naming** - Use descriptive tool names
2. **Comprehensive validation** - Validate all inputs with Zod
3. **Error handling** - Always use try-catch blocks
4. **Logging** - Log operations for debugging
5. **Documentation** - Provide clear tool descriptions

### Performance
1. **Batch operations** - Group multiple dpGet/dpSet calls
2. **Async patterns** - Use async/await properly
3. **Error recovery** - Handle partial failures gracefully
4. **Resource cleanup** - Clean up any resources used

### Security
1. **Input validation** - Never trust user input
2. **Access control** - Respect WinCC OA permissions
3. **Safe operations** - Add safety checks for critical operations
4. **Audit logging** - Log security-relevant operations

### Testing
1. **Unit tests** - Test tool logic independently
2. **Integration tests** - Test with actual WinCC OA system
3. **Error scenarios** - Test error handling paths
4. **Performance tests** - Verify tool performance under load

## Tool Categories

Organize tools in logical categories:

- **`process/`** - Process control operations
- **`maintenance/`** - Maintenance and diagnostic tools
- **`reporting/`** - Data collection and reporting
- **`safety/`** - Safety system interactions
- **`custom/`** - Plant-specific tools

## Debugging Tools

### Enable Debug Logging

Add debug output to your tools:

```javascript
const DEBUG = process.env.DEBUG_TOOLS === 'true';

if (DEBUG) {
  console.log(`Tool executed with params:`, { parameter1, parameter2 });
}
```

### Error Diagnostics

Comprehensive error handling:

```javascript
try {
  // Tool logic
} catch (error) {
  console.error(`Tool ${toolName} error:`, {
    message: error.message,
    stack: error.stack,
    params: { parameter1, parameter2 }
  });
  
  return createErrorResponse(`Operation failed: ${error.message}`, {
    errorCode: error.code,
    timestamp: new Date().toISOString()
  });
}
```
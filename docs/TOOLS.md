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
  - Automatically registers connection with running driver (no restart required)
  - Uses `AddServer` command to dynamically add connection to running OPC UA driver
  - Creates necessary manager datapoints (_OPCUA{num})
  - Configures connection parameters (URL, security, authentication)
- `opcua-browse` - Browse OPC UA server address space with **full recursive exploration**
  - **Smart Auto-Depth Browsing (OMIT depth parameter - RECOMMENDED):**
    - **Root nodes** (Objects folder): Conservative, tries depth=2 → depth=1 if needed
    - **Specific branches**: FULL RECURSIVE EXPLORATION to all leaf nodes
      - Uses depth-first exploration with batched API calls (minimizes WinCC OA calls)
      - Continues until reaching leaf nodes OR hitting 1000-node hard limit
      - Returns `recursionStats`: maxDepthReached, leafNodesReached, totalApiCalls
      - Returns `exploredBranches` (fully explored) and `expandableBranches` (hit limit)
      - Uses `hasChildren` field to intelligently skip leaf nodes
      - Soft limit: 800 nodes (completes current branch), Hard limit: 1000 nodes (absolute stop)
    - Provides intelligent guidance on which branches to browse next
  - **Returns minimal fields for performance:**
    - displayName, nodeId, nodeClass, hasChildren
    - ~50% smaller payload than full details
  - **Smart Guidance Fields:**
    - `largeBranches`: Array of branches with many children detected
      - Each includes: nodeId, displayName, estimatedChildren, level
      - Tells you exactly which nodes to browse next
    - `expandableBranches`: Branches not expanded due to 800-node limit
    - `exploredBranches`: Branches fully explored to all leaf nodes
    - `recursionStats`: Statistics about recursive exploration (depth, leaf nodes, API calls)
    - `warning`: Human-readable guidance for next steps
  - **User-Specified Depth (less flexible, not recommended for branches):**
    - Specify depth=1-5 for explicit control
    - Uses fixed depth (does NOT explore to leaf nodes)
    - Validated against address space size (rejected if would exceed 800 nodes)
    - depth=0 disabled for safety (prevents crashes)
  - **Pagination Support:**
    - Default limit: 800 nodes per request (optimal for context window)
    - Use `offset` and `limit` parameters for pagination
    - Response includes: `totalNodes`, `hasMore`, `nextOffset`
  - **Safety & Performance:**
    - 800-node soft limit (orientation, completes current branch)
    - 1000-node hard limit (absolute stop)
    - 2-minute timeout protection
    - 5-minute caching with 'auto' key for faster responses
    - Batched API calls minimize WinCC OA load (e.g., 5 calls vs 5000)
  - **Best Practices:**
    - **Always omit depth for full branch exploration** (recommended)
    - Follow guidance in `largeBranches` field
    - Browse large branches individually
    - Use caching for repeated navigation
    - Check `hasChildren` field to understand node structure

**`opcua/opcua_address`** - OPC UA address configuration
- `opcua-add-address-config` - Configure OPC UA addresses for datapoint elements
  - Links datapoint elements to OPC UA server variables
  - Auto-detects manager number from connection
  - Creates poll groups automatically

**Note:** When a new OPC UA connection is created using `opcua-add-connection`, the tool automatically triggers the `AddServer` command on the running OPC UA driver. This means the connection becomes immediately available without requiring a driver restart, making the workflow more seamless and automated.

## Tool Configuration

### Basic Configuration

```env
# Load all available tools
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,datapoints/dp_type_create,opcua/opcua_connection,opcua/opcua_address

# Load only basic datapoint operations
TOOLS=datapoints/dp_basic,datapoints/dp_set

# Load only creation and type tools
TOOLS=datapoints/dp_create,datapoints/dp_types,datapoints/dp_type_create

# Load OPC UA tools only (recommended: include both for full OPC UA support)
TOOLS=opcua/opcua_connection,opcua/opcua_address
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
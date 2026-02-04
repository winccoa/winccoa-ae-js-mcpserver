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
  - **Connection naming:** Auto-generates sequential names (_OpcUAConnection1, _OpcUAConnection2, etc.)
  - Automatically registers connection with running driver (no restart required)
  - Uses `AddServer` command to dynamically add connection to running OPC UA driver
  - Creates necessary manager datapoints (_OPCUA{num})
  - Configures connection parameters (URL, security, authentication)
  - Returns the auto-generated connection name for use with other tools
- `opcua-browse` - Browse OPC UA server address space with **full recursive exploration**
  - **Prerequisites:**
    - Connection must be established (Common.State.ConnState >= 256)
    - Automatically validates connection status before browsing
    - Returns clear error if connection is not active (with current state and troubleshooting guidance)
    - Uses unified WinCC OA driver state: < 256 = not connected, >= 256 = connected
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

- `opcua-delete-connection` - Completely delete an existing OPC UA client connection
  - Removes connection from manager's server list
  - Deletes connection datapoint
  - Auto-cleans up unused manager datapoints
  - Stops and removes OPC UA driver if no connections remain

**Note:** When a new OPC UA connection is created using `opcua-add-connection`, the tool automatically triggers the `AddServer` command on the running OPC UA driver. This means the connection becomes immediately available without requiring a driver restart, making the workflow more seamless and automated.

### Alarm Tools

**`alarms/alarm_set`** - Configure alarm thresholds
- `alarm-set` - Set or update alarm configuration for a datapoint element
  - **Binary alarms:** For BOOL datapoints, triggers on TRUE (ASC) or FALSE (DESC)
  - **Analog alarms:** For numeric types (CHAR, INT, UINT, LONG, ULONG, FLOAT) with 1-3 thresholds
  - **Parameters:**
    - `config.dpe` - Datapoint element name (required)
    - `config.direction` - "ASC" (ascending) or "DESC" (descending) (required)
    - `config.thresholds` - Array of 1-3 threshold values (required for analog alarms)
    - `config.alarmClasses` - Custom alarm class names (optional)
    - `config.force` - Force update if configuration exists (optional)
  - **Default alarm classes:**
    - ASC: ['information.', 'warning.', 'alert.']
    - DESC: ['alert.', 'warning.', 'information.']

**`alarms/alarm_delete`** - Remove alarm configuration
- `alarm-delete` - Delete alarm configuration from a datapoint element
  - Acknowledges alert first
  - Deactivates alert
  - Permanently deletes configuration
  - **Parameters:**
    - `dpe` - Datapoint element name (required)

### Archive Tools

**`archive/archive_query`** - Query historical data
- `archive-query` - Query historical archived data from datapoint elements using chunked retrieval
  - **Parameters:**
    - `config.dpe` - Datapoint element(s) to query (string or array, required)
    - `config.startTime` - ISO 8601 format (e.g., "2024-01-01T00:00:00Z") (required)
    - `config.endTime` - ISO 8601 format (required)
    - `config.count` - Extra values before/after period (default: 0)
  - Uses `dpGetPeriodSplit` for chunked retrieval (handles large datasets)
  - Requires archive configuration enabled on datapoint
  - Returns values with timestamps for specified period
  - Includes progress tracking for long queries

**`archive/archive_set`** - Configure archiving
- `archive-set` - Set or update archive configuration for a datapoint element
  - **Parameters:**
    - `config.dpe` - Datapoint element name (required)
    - `config.archiveClass` - Archive class name (default: "_NGA_G_EVENT")
    - `config.force` - Force update if configuration exists (optional)
  - Configures value archiving (DPATTR_ARCH_PROC_VALARCH)
  - Default archive class: "_NGA_G_EVENT"

**`archive/archive_delete`** - Remove archiving
- `archive-delete` - Delete archive configuration from a datapoint element
  - Stops historical data collection for element
  - Permanently removes configuration
  - **Parameters:**
    - `dpe` - Datapoint element name (required)

### Common Configuration Tools

**`common/common_query`** - Query common attributes
- `common-query` - Query existing common config attributes from a datapoint element
  - Returns: description, alias, format, unit (UTF-8 encoded), configured flag
  - Returns only attributes that are set
  - All language strings are UTF-8 encoded
  - **Parameters:**
    - `dpe` - Datapoint element name (required)

**`common/common_set`** - Set common attributes
- `common-set` - Set one or more common config attributes for a datapoint element
  - **Parameters:**
    - `config.dpe` - Datapoint element name (required)
    - `config.description` - Multi-language description (UTF-8) or string (optional)
    - `config.alias` - Alias name (optional)
    - `config.format` - Multi-language format (UTF-8) or string (optional)
    - `config.unit` - Multi-language unit (UTF-8) or string (optional)
  - All parameters are optional and independent (set any combination)
  - Does NOT require existing _common config (auto-created)
  - **IMPORTANT:** Language strings MUST use UTF-8 encoding (.utf8), NOT ISO

**`common/common_delete`** - Delete common attributes
- `common-delete` - Delete specific common config attributes from a datapoint element
  - **Parameters:**
    - `config.dpe` - Datapoint element name (required)
    - `config.description` - Delete description if true (optional)
    - `config.alias` - Delete alias if true (optional)
    - `config.format` - Delete format if true (optional)
    - `config.unit` - Delete unit if true (optional)
    - `config.all` - Delete all attributes if true (optional)
  - Deletes by setting attributes to empty strings
  - At least one attribute or 'all' must be specified

### PV Range Tools

**`pv_range/pv_range_query`** - Query value ranges
- `pv-range-query` - Query existing pv_range (min/max) configuration from a datapoint element
  - Returns: type, min, max, includeMin, includeMax, configured flag
  - Returns null if not configured
  - Shows boundary inclusivity settings
  - **Parameters:**
    - `dpe` - Datapoint element name (required)

**`pv_range/pv_range_set`** - Set value ranges
- `pv-range-set` - Set or update pv_range (min/max) configuration for a datapoint element
  - **Parameters:**
    - `config.dpe` - Datapoint element name (required)
    - `config.min` - Minimum value (required)
    - `config.max` - Maximum value (required)
    - `config.includeMin` - Include min in valid range (default: true)
    - `config.includeMax` - Include max in valid range (default: true)
    - `config.force` - Force update if configuration exists (optional)
  - Supported types: CHAR, INT, UINT, LONG, ULONG, FLOAT
  - min must be < max
  - Default: inclusive boundaries

**`pv_range/pv_range_delete`** - Delete value ranges
- `pv-range-delete` - Delete pv_range (min/max) configuration from a datapoint element
  - Removes value validation
  - Permanently removes configuration
  - **Parameters:**
    - `dpe` - Datapoint element name (required)

### Manager Control Tools (Pmon)

**`manager/manager_list`** - List and monitor managers
- `list-managers` - List all WinCC OA managers with their current status
  - **Parameters:**
    - `includeDetails` - Include detailed configuration (default: false)
  - Returns: index, name, state, PID, start mode, start time, manager number, Pmon status
  - Requires Pmon running on localhost:4999
  - **States:** stopped, initializing, running, blocked
  - **Start modes:** manual, once, always

- `get-manager-status` - Get the status of a specific manager by index
  - **Parameters:**
    - `managerIndex` - Manager index (0 for Pmon, 1+ for others) (required)
  - Returns: state, PID, start mode, start time, manager number
  - Uses 0-based indexing (0=Pmon)

**`manager/manager_control`** - Control manager lifecycle
- `start-manager` - Start a WinCC OA manager
  - **Parameters:**
    - `managerIndex` - Manager index (1-100) (required)
  - Manager must exist and be stopped
  - Data Manager should be started first
  - Some managers depend on others (Data, Event)

- `stop-manager` - Stop a WinCC OA manager gracefully (SIGTERM)
  - **Parameters:**
    - `managerIndex` - Manager index (1-100) (required)
  - Sends SIGTERM (graceful shutdown)
  - Manager has 'secKill' seconds before SIGKILL
  - Stopping critical managers (Data, Event) affects others

- `kill-manager` - Force kill a WinCC OA manager immediately (SIGKILL)
  - **Parameters:**
    - `managerIndex` - Manager index (1-100) (required)
  - **WARNING:** Immediate forced termination, data may be lost
  - Use only for unresponsive or blocked managers
  - Prefer stop-manager for graceful shutdown

**`manager/manager_add`** - Add new managers
- `add-manager` - Add a new manager to WinCC OA Pmon configuration
  - **Parameters:**
    - `managerName` - Manager name without .exe extension (required)
    - `position` - Position in startup sequence (1-100) (required)
    - `startMode` - "manual", "once", or "always" (default: "always") (required)
    - `options` - Command line options (default: "")
    - `secKill` - Seconds before SIGKILL (default: 30)
    - `restartCount` - Restart attempts (default: 3)
    - `resetMin` - Minutes to reset restart counter (default: 5)
  - Manager index starts at 1 (0 is Pmon)
  - Can only add if target position and following managers are stopped
  - Maximum 100 managers
  - Data Manager must be first (index 1)

**`manager/manager_remove`** - Remove managers
- `remove-manager` - Remove a manager from WinCC OA Pmon configuration
  - **Parameters:**
    - `managerIndex` - Manager index to remove (1-100) (required)
  - Cannot remove Pmon (index 0)
  - Manager and following managers must be stopped
  - Does not stop running manager (stop first)

**`manager/manager_properties`** - Configure manager properties
- `get-manager-properties` - Get configuration properties of a specific manager
  - **Parameters:**
    - `managerIndex` - Manager index (1-100) (required)
  - Returns: startMode, secKill, restartCount, resetMin, commandlineOptions
  - Use before updating properties

- `update-manager-properties` - Update configuration properties of a specific manager
  - **Parameters:**
    - `managerIndex` - Manager index (1-100) (required)
    - `startMode` - "manual", "once", or "always" (required)
    - `secKill` - Seconds before SIGKILL (required)
    - `restartCount` - Restart attempts (required)
    - `resetMin` - Minutes to reset counter (required)
    - `options` - Command line options (default: "")
  - Changes take effect on next start (restart if running)
  - All parameters must be provided
  - Manager name cannot be changed

### Dashboard & Widget Tools

**`dashboards/dashboard`** - Dashboard management
- `create-dashboard` - Create a new dashboard in WinCC OA
  - **Parameters:**
    - `name` - Dashboard name (required)
    - `description` - Dashboard description (required)
    - `createdBy` - Username (must exist in _Users.UserName, cannot be "root") (required)
  - Auto-assigns unique ID
  - Returns: dashboard datapoint name (e.g., "_Dashboard_000001")
  - **CRITICAL:** Do NOT use "root" as creator (cannot be modified later)
  - Dashboard layout uses 4-column grid (50 columns wide)

- `edit-dashboard` - Edit an existing dashboard's properties
  - **Parameters:**
    - `dashboardId` - Dashboard datapoint name (required)
    - `name` - New dashboard name (optional)
    - `description` - New description (optional)
  - At least one of name or description required

- `delete-dashboard` - Delete a dashboard
  - **Parameters:**
    - `dashboardId` - Dashboard datapoint name (required)
  - Marks as unpublished
  - Clears all widgets

- `list-dashboards` - List all dashboards in the system
  - No parameters required
  - Returns: id, dashboardNumber, name, description, widgetCount, isPublished

**`dashboards/widget`** - Widget management
- `add-widget` - Add a widget to a dashboard
  - **Widget types:** "gauge", "label", "trend", "pie", "progressbar", "barchart"
  - **Parameters:**
    - `dashboardId` - Dashboard datapoint name (required)
    - `type` - Widget type (required)
    - `title` - Widget title (required)
    - `dataPoint` - Single datapoint (for gauge, label, progressbar, single-series trend)
    - `dataPoints` - Array of datapoints or objects (for pie, barchart, multi-series trend)
    - `dataPointsDescriptions` - Descriptions for pie slices
    - `rangeSettings` - Range configuration for gauge
    - `timeRange` - Time range for trend (default: "now/h")
    - `layout` - "auto", "small", "medium", "large", "fullwidth" or {x, y, cols, rows}
    - Appearance: titleIcon, headerTitle, titleAlignment, subtitleIcon, footerTitle, subtitleAlignment, backgroundColor, borderColor, showFullscreenButton, linkTitle, linkOpenInNewTab
    - Progress bar: color, size, unit, format, min, max, showRange, isAbsolute, alertRanges
    - Bar chart: yAxisName, yAxisUnit, yAxisColor, range, isStacked, isHorizontal, showTooltip, showLegend, legendPosition
  - Returns: widget ID (UUID)
  - **CRITICAL:** DO NOT provide `yAxisUnit` or `unit` parameters - auto-populated from DPE config
  - Use "auto" layout to prevent overlaps
  - Dashboard grid: 50 columns × 25 rows
  - Recommended sizes: gauge (8x8), trend (24x8), chart (12x8)
  - Time ranges: "now/h" (current hour), "24h" (last 24h), "1d/d" (yesterday), etc.

- `edit-widget` - Edit a widget on a dashboard
  - **Parameters:**
    - `dashboardId` - Dashboard datapoint name (required)
    - `widgetIdentifier` - {id: "uuid"} or {index: 0} (required)
    - `title` - New widget title (optional)
    - `layout` - New layout (optional)
    - Appearance and widget-specific parameters same as add-widget
  - At least one parameter must be provided
  - **WARNING:** DO NOT manually edit `unit` or `yAxisUnit` - auto-managed

- `delete-widget` - Delete a widget from a dashboard
  - **Parameters:**
    - `dashboardId` - Dashboard datapoint name (required)
    - `widgetIdentifier` - {id: "uuid"} or {index: 0} (required)
  - Removes widget permanently

- `list-widgets` - List all widgets on a dashboard
  - **Parameters:**
    - `dashboardId` - Dashboard datapoint name (required)
  - Returns: array of widgets with full configuration

### Icon Tools

**`icons/icon`** - Icon management
- `create-custom-icon` - Create a custom SVG icon for dashboard widgets
  - **Parameters:**
    - `name` - Icon filename (without .svg) (required)
    - `type` - "simple", "trend", "gauge", "alert", "custom" (required)
    - `color` - SVG color (default: "currentColor")
    - `size` - Viewbox size (default: 24, supported: 16, 24, 32)
    - `customSvg` - Custom SVG path data (required for "custom" type)
  - Icons saved to /data/WebUI/icons/
  - Returns: icon path (e.g., "/data/WebUI/icons/my-icon.svg")
  - Must be small (24x24px) to match Siemens IX library
  - Follow Siemens IX design guidelines (2px stroke, geometric shapes)
  - Use "currentColor" for theme support

- `list-custom-icons` - List all available custom icons
  - No parameters required
  - Returns: array of icon paths in /data/WebUI/icons/
  - Shows all created custom icons

- `delete-custom-icon` - Delete a custom icon
  - **Parameters:**
    - `name` - Icon filename (with or without .svg) (required)
  - Permanently deletes icon file from /data/WebUI/icons/

- `list-ix-icons` - Search and filter through 1,407 built-in Siemens IX icons
  - **Parameters:**
    - `search` - Keyword filter (e.g., "trend", "chart") (optional)
    - `category` - Category filter (optional)
      - Categories: "trend", "chart", "status", "action", "navigation", "settings", "time", "device", "user", "file", "plant", "battery", "network"
    - `limit` - Max results (default: 50, max: 200) (optional)
  - Returns: array of icon names, category information, total count
  - 1,407 built-in icons available
  - All 24×24 pixels
  - Use icon names directly in titleIcon/subtitleIcon

## Tool Configuration

### Basic Configuration

```env
# Full feature set (all tools)
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,datapoints/dp_type_create,opcua/opcua_connection,opcua/opcua_address,alarms/alarm_set,alarms/alarm_delete,archive/archive_query,archive/archive_set,archive/archive_delete,common/common_query,common/common_set,common/common_delete,pv_range/pv_range_query,pv_range/pv_range_set,pv_range/pv_range_delete,manager/manager_list,manager/manager_control,manager/manager_add,manager/manager_remove,manager/manager_properties,dashboards/dashboard,dashboards/widget,icons/icon

# Read-only monitoring (safe for production)
TOOLS=datapoints/dp_basic,datapoints/dp_types,archive/archive_query,common/common_query,pv_range/pv_range_query,manager/manager_list

# Datapoint operations only
TOOLS=datapoints/dp_basic,datapoints/dp_set,datapoints/dp_create,datapoints/dp_types

# Dashboard-focused setup
TOOLS=datapoints/dp_basic,dashboards/dashboard,dashboards/widget,icons/icon

# Manager control setup
TOOLS=manager/manager_list,manager/manager_control,manager/manager_add,manager/manager_remove,manager/manager_properties

# OPC UA integration (recommended: include both for full OPC UA support)
TOOLS=opcua/opcua_connection,opcua/opcua_address,datapoints/dp_basic

# Alarm and archive configuration
TOOLS=datapoints/dp_basic,alarms/alarm_set,alarms/alarm_delete,archive/archive_set,archive/archive_delete
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
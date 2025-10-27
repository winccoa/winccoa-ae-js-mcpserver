/**
 * Icon Tools
 *
 * MCP tools for generating custom SVG icons for dashboard widgets
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';
import { IconGenerator } from '../../helpers/icons/IconGenerator.js';
import { IconList } from '../../helpers/icons/IconList.js';

/**
 * Register icon tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const iconGenerator = new IconGenerator();
  const iconList = new IconList();

  // ==================== CREATE CUSTOM ICON ====================
  server.tool(
    'create-custom-icon',
    `Create a custom SVG icon for dashboard widgets.

Icons are saved to /data/WebUI/icons/ and can be referenced in widget headers/footers.
After creating an icon, use its path in the titleIcon or subtitleIcon parameter when editing widgets.

IMPORTANT: Icons must be small (24x24 pixels by default) to match Siemens IX icon library.
Widget header/footer icons cannot be full-width - they must be icon-sized.

WHEN TO CREATE CUSTOM ICONS:
- ONLY if list-ix-icons search returns no suitable match from the 1,407 IX icons
- For brand-specific symbols not in the standard Siemens library
- For domain-specific industrial icons unique to your application

---

## SIEMENS IX DESIGN GUIDELINES

When creating custom SVG icons, follow Siemens Industrial Experience standards to ensure visual consistency:

**Grid & Size:**
- Base grid: 24×24 pixels (matches IX icon library exactly)
- Include 2px clearance zone from edges (icons should not touch outer boundary)
- Use geometric shapes with sharp corners and straight lines

**Stroke & Style:**
- Default stroke width: 2px (preferred for all icons)
- Use 1.5px or 1px stroke ONLY when readability requires it
- Prefer outlines over filled shapes (use fills sparingly)
- Maintain 2px gaps between separate shapes to prevent anti-aliasing blur

**Design Principles:**
- Keep it simple and geometric - avoid complex details that don't scale well
- Use straight lines and sharp corners as default (NOT rounded)
- Only use curves when representing actual object characteristics (e.g., gauge needles, circles)
- Avoid unsafe pixel patterns that create visual ambiguity

**Technical Requirements:**
- All strokes must be converted to outlines before export
- Combine shapes into single path via boolean operations where possible
- Size: 24×24px for widget headers/footers (DO NOT use larger sizes)
- Format: SVG with currentColor support for theme compatibility

**Color Usage:**
- Use "currentColor" as default (adapts to light/dark themes automatically)
- Only specify custom colors for brand-specific or status-indicating icons
- Avoid hardcoded colors unless absolutely necessary

**Reference:** https://ix.siemens.io/docs/icons/design-new-icons

---

Parameters:
- name: Icon filename (without .svg extension) (required)
- type: Icon type - "simple", "trend", "gauge", "alert", or "custom" (required)
- color: SVG color (optional, default: "currentColor" for theme support)
- size: Viewbox size in pixels (optional, default: 24, supported: 16, 24, 32)
- customSvg: Custom SVG path data (required only for "custom" type)

Icon Types:
- simple: Basic circle icon (24x24)
- trend: Line chart/trend icon with data points (24x24)
- gauge: Semicircular gauge/meter icon (24x24)
- alert: Warning triangle icon (24x24)
- custom: Custom shape from SVG path data (size configurable, default 24x24)

Returns: Path to the created icon (e.g., "/data/WebUI/icons/my-icon.svg")

Example 1 - Create a trend icon:
{
  "name": "production-trend",
  "type": "trend",
  "color": "#4ecdc4"
}
→ Result: /data/WebUI/icons/production-trend.svg

Example 2 - Create a gauge icon:
{
  "name": "temperature-gauge",
  "type": "gauge",
  "color": "#ff6b6b",
  "size": 24
}
→ Result: /data/WebUI/icons/temperature-gauge.svg

Example 3 - Create an alert icon:
{
  "name": "critical-alert",
  "type": "alert",
  "color": "#f38181"
}
→ Result: /data/WebUI/icons/critical-alert.svg

Example 4 - Create a custom icon:
{
  "name": "my-custom-icon",
  "type": "custom",
  "customSvg": "M12 2 L22 12 L12 22 L2 12 Z",
  "color": "#95e1d3",
  "size": 24
}
→ Result: /data/WebUI/icons/my-custom-icon.svg

---

## COLOR CUSTOMIZATION

ALL icon types support custom colors via the "color" parameter!

**Status-Indicating Colors:**
- Red alerts: {"name": "high-alarm", "type": "alert", "color": "#ff0000"}
- Orange warnings: {"name": "medium-warning", "type": "alert", "color": "#ff6b35"}
- Green success: {"name": "ok-status", "type": "custom", "customSvg": "M4 12 L10 18 L20 4", "color": "#00ff00"}
- Blue info: {"name": "info-indicator", "type": "trend", "color": "#4ecdc4"}

**Brand-Specific Colors:**
- Company brand: {"name": "brand-logo", "type": "custom", "customSvg": "...", "color": "#YOUR_BRAND_COLOR"}
- Department colors: {"name": "production-icon", "type": "gauge", "color": "#ffa500"}

**Theme-Aware (Default):**
- Use "currentColor" or omit color parameter entirely for icons that adapt to light/dark themes
- Recommended for most icons unless you need specific status colors

**Common Industrial Colors:**
- Critical (Red): #ff0000, #dc143c, #b22222
- Warning (Orange/Yellow): #ff6b35, #ffa500, #ffd700
- OK/Running (Green): #00ff00, #32cd32, #228b22
- Info (Blue): #4ecdc4, #1e90ff, #4169e1
- Neutral (Gray): #808080, #a9a9a9, #696969

---

After creating the icon, use it in a widget header or footer:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 0},
  "titleIcon": "/data/WebUI/icons/production-trend.svg",
  "headerTitle": "Production Line 1"
}`,
    {
      name: z.string().min(1, 'Icon name is required'),
      type: z.enum(['simple', 'trend', 'gauge', 'alert', 'custom']),
      color: z.string().optional(),
      size: z.number().int().min(16).max(32).optional(),
      customSvg: z.string().optional()
    },
    async (params: {
      name: string;
      type: 'simple' | 'trend' | 'gauge' | 'alert' | 'custom';
      color?: string;
      size?: number;
      customSvg?: string;
    }) => {
      try {
        const { name, type, color, size, customSvg } = params;

        console.log(`Creating custom icon: ${name} (type: ${type})`);

        // Validate custom type requires customSvg
        if (type === 'custom' && !customSvg) {
          return createErrorResponse('Custom icon type requires customSvg parameter');
        }

        const iconPath = iconGenerator.generateIcon({
          name,
          type,
          color,
          size,
          customSvg
        });

        return createSuccessResponse({
          success: true,
          iconPath,
          message: `Icon created: ${iconPath}`,
          usage: `Use in widget: { "titleIcon": "${iconPath}", "headerTitle": "Your Title" }`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error creating icon:', error);
        return createErrorResponse(`Failed to create icon: ${errorMessage}`);
      }
    }
  );

  // ==================== LIST CUSTOM ICONS ====================
  server.tool(
    'list-custom-icons',
    `List all available custom icons in /data/WebUI/icons/.

Returns an array of icon paths that can be used in widget headers/footers.

Example usage:
Call this tool to see all available custom icons, then use the path in edit-widget:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 0},
  "titleIcon": "/data/WebUI/icons/your-icon.svg"
}`,
    {},
    async () => {
      try {
        console.log('Listing custom icons');

        const icons = iconGenerator.listCustomIcons();

        return createSuccessResponse({
          success: true,
          count: icons.length,
          icons,
          message: icons.length > 0
            ? `Found ${icons.length} custom icon(s)`
            : 'No custom icons found. Create one with create-custom-icon tool.'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error listing icons:', error);
        return createErrorResponse(`Failed to list icons: ${errorMessage}`);
      }
    }
  );

  // ==================== DELETE CUSTOM ICON ====================
  server.tool(
    'delete-custom-icon',
    `Delete a custom icon from /data/WebUI/icons/.

Parameters:
- name: Icon filename (with or without .svg extension) (required)

Example:
{
  "name": "my-icon.svg"
}`,
    {
      name: z.string().min(1, 'Icon name is required')
    },
    async (params: { name: string }) => {
      try {
        const { name } = params;

        console.log(`Deleting custom icon: ${name}`);

        const deleted = iconGenerator.deleteIcon(name);

        if (deleted) {
          return createSuccessResponse({
            success: true,
            message: `Icon deleted: ${name}`
          });
        } else {
          return createErrorResponse(`Icon not found: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error deleting icon:', error);
        return createErrorResponse(`Failed to delete icon: ${errorMessage}`);
      }
    }
  );

  // ==================== LIST SIEMENS IX ICONS ====================
  server.tool(
    'list-ix-icons',
    `Search and filter through 1,407 built-in Siemens IX icons.

This tool helps you find the correct icon names from the Siemens Industrial Experience (IX) icon library.
All icons are 24×24 pixels and can be used directly in widget titleIcon and subtitleIcon parameters.

Parameters:
- search: Optional keyword to filter icons (e.g., "trend", "chart", "warning") (optional)
- category: Optional category filter - one of: trend, chart, status, action, navigation, settings, time, device, user, file, plant, battery, network (optional)
- limit: Maximum number of results to return (default: 50, max: 200) (optional)

Icon Categories:
- trend: Trend indicators (trend-upward, trend-downward, trend-sideways, etc.)
- chart: Chart types (barchart, linechart, piechart, areachart, gaugechart, etc.)
- status: Status indicators (alarm, error, warning, success, info, etc.)
- action: User actions (pen, trashcan, download, upload, save, refresh, etc.)
- navigation: Navigation (home, search, chevron-*, arrow-*, etc.)
- settings: Configuration (cogwheel, settings, configuration, database, etc.)
- time: Time-related (clock, calendar, hourglass, stopwatch, etc.)
- device: Hardware (generic-device, plc-device, network-device, sensor, etc.)
- user: People/users (user, user-profile, user-group, add-user, etc.)
- file: Files/documents (document, folder, pdf-document, json-document, etc.)
- plant: Industrial plants (plant, building1, building2, create-plant, etc.)
- battery: Power status (battery-full, battery-low, battery-empty, etc.)
- network: Connectivity (connected, disconnected, wlan-strength*, etc.)

Example 1 - Search for trend icons:
{
  "search": "trend"
}
→ Returns: trend, trend-upward, trend-downward, trend-sideways, etc.

Example 2 - Get chart category icons:
{
  "category": "chart"
}
→ Returns: All chart icons (barchart, linechart, piechart, etc.)

Example 3 - Search within a category:
{
  "category": "status",
  "search": "warning",
  "limit": 10
}
→ Returns: warning, warning-filled, warning-rhomb, etc.

Example 4 - Browse battery icons:
{
  "category": "battery"
}
→ Returns: battery-full, battery-half, battery-low, battery-empty, etc.

Usage in widgets:
After finding an icon, use it directly in edit-widget:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 0},
  "titleIcon": "trend-upward",
  "headerTitle": "Production Trend"
}

See IX_ICONS_REFERENCE.md for complete documentation and visual examples.`,
    {
      search: z.string().optional(),
      category: z.enum([
        'trend', 'chart', 'status', 'action', 'navigation',
        'settings', 'time', 'device', 'user', 'file',
        'plant', 'battery', 'network'
      ]).optional(),
      limit: z.number().int().min(1).max(200).optional()
    },
    async (params: {
      search?: string;
      category?: string;
      limit?: number;
    }) => {
      try {
        const { search, category, limit = 50 } = params;

        console.log(`Searching IX icons - category: ${category || 'all'}, search: ${search || 'none'}, limit: ${limit}`);

        let icons: string[];

        if (category) {
          // Search within category
          icons = iconList.searchByCategory(category, search, limit);
        } else if (search) {
          // Search all icons
          icons = iconList.searchIcons(search, limit);
        } else {
          // Return random sample or first N icons
          icons = iconList.searchIcons('', limit);
        }

        const totalIcons = iconList.getTotalCount();
        const allCategories = iconList.getAllCategories();

        return createSuccessResponse({
          success: true,
          count: icons.length,
          totalAvailable: totalIcons,
          icons,
          categories: allCategories.map(cat => ({
            name: cat.name,
            description: cat.description,
            iconCount: cat.icons.length
          })),
          message: category
            ? `Found ${icons.length} icon(s) in category "${category}"`
            : search
              ? `Found ${icons.length} icon(s) matching "${search}"`
              : `Showing ${icons.length} of ${totalIcons} available icons`,
          usage: 'Use icon names directly in titleIcon or subtitleIcon parameters'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error listing IX icons:', error);
        return createErrorResponse(`Failed to list IX icons: ${errorMessage}`);
      }
    }
  );

  return 4; // Number of tools registered
}

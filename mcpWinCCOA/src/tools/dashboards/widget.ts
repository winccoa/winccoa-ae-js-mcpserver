/**
 * Widget Tools
 *
 * MCP tools for widget CRUD operations on dashboards
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';
import { DashboardManager } from '../../helpers/dashboards/DashboardManager.js';
import type { WidgetConfig } from '../../types/dashboards/widgets.js';

/**
 * Layout schema for Zod validation
 * Preprocesses string inputs by parsing JSON (Claude AI sometimes sends objects as strings)
 */
const layoutSchema = z.preprocess(
  (val) => {
    // If it's a string, try to parse it as JSON
    if (typeof val === 'string' && val.startsWith('{')) {
      try {
        return JSON.parse(val);
      } catch (e) {
        // If parsing fails, return as-is (might be a preset like "auto")
        return val;
      }
    }
    return val;
  },
  z.union([
    z.enum(['auto', 'small', 'medium', 'large', 'fullwidth']),
    z.object({
      x: z.number(),
      y: z.number(),
      cols: z.number(),
      rows: z.number()
    })
  ])
);

/**
 * Widget identifier schema
 */
const widgetIdentifierSchema = z.union([
  z.object({ id: z.string() }),
  z.object({ index: z.number() })
]);

/**
 * Range settings schema
 */
const rangeSettingsSchema = z.object({
  type: z.enum(['manual', 'oa']),
  min: z.number().optional(),
  max: z.number().optional()
});

/**
 * Trend series configuration schema
 */
const trendSeriesSchema = z.object({
  dataPoint: z.string().min(1, 'Datapoint is required'),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
  showCustomYAxis: z.boolean().optional(),
  yAxisPosition: z.enum(['left', 'right']).optional(),
  // Visual customization
  showArea: z.boolean().optional(),
  showConfidenceBand: z.boolean().optional(),
  color: z.string().optional(),
  // Data formatting
  unit: z.string().optional().describe('INTERNAL - Auto-populated from DPE config. DO NOT PROVIDE.'),
  format: z.string().optional(),
  name: z.string().optional(),
  // Custom Y-axis range
  min: z.number().optional(),
  max: z.number().optional()
});

/**
 * Progress bar alert range schema
 */
const alertRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  color: z.string()
});

/**
 * Y-axis range schema for bar chart
 */
const yAxisRangeSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable()
});

/**
 * Register widget tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context with winccoa instance
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;
  const dashboardManager = new DashboardManager(winccoa);

  // ==================== ADD WIDGET ====================
  server.tool(
    'add-widget',
    `Add a widget to a dashboard.

Creates a new widget with the specified configuration and adds it to the dashboard. Supports gauge, label, trend, pie, progressbar, and barchart widgets.

Parameters:
- dashboardId: Dashboard datapoint name (e.g., "_Dashboard_000001") (required)
- type: Widget type - "gauge", "label", "trend", "pie", "progressbar", or "barchart" (required)
- title: Widget title (required)
- dataPoint: Single datapoint path (required for gauge, label, progressbar, single-series trend)
- dataPoints: Array of datapoint paths or objects (required for pie, barchart, optional for trend)

  **SIMPLE USAGE (all series on same Y-axis):**
  dataPoints: ["DP1.element1.", "DP2.element2."]

  **ADVANCED USAGE (with second Y-axis):**
  dataPoints: [
    "DP1.element1.",  // String = default Y-axis (left)
    {
      "dataPoint": "DP1.element2.",
      "showCustomYAxis": true,
      "yAxisPosition": "right",  // optional, defaults to "right"
      "lineStyle": "solid"  // optional: "solid", "dashed", "dotted"
    }
  ]

- dataPointsDescriptions: Array of descriptions for pie slices (required for pie, must match dataPoints length)
- rangeSettings: Range configuration for gauge (optional)
  - type: "manual" or "oa" (from datapoint config)
  - min: Minimum value (for manual type)
  - max: Maximum value (for manual type)
- timeRange: Time range for trend widget (optional, default: "now/h" = current hour)
  - Last periods: "1h" (last hour), "8h" (last 8 hours), "24h" (last 24 hours)
  - Current periods: "now/h" (current hour from XX:00), "now/d" (current day), "now/w" (current week), "now/M" (current month)
  - Previous periods: "1d/d" (yesterday), "1w/w" (last week), "1M/M" (last month)
  - Absolute: "2025-10-23T14:00:00.000/2025-10-23T15:00:00.000"
  NOTE: "now/h" shows data from start of current hour and grows with time (e.g., 16:00-16:05 at 16:05) - perfect for live monitoring

🎯 DASHBOARD STRUCTURE - BEST PRACTICES 🎯
==========================================

GOLDEN RULES FOR PROFESSIONAL DASHBOARDS:
1. **USE "MEDIUM" AS MINIMUM SIZE** - Small widgets are hard to read. Use medium (8x8 for gauges, 12x8 for charts) as baseline.
2. **MAINTAIN 4-COLUMN GRID ALIGNMENT** - All widgets should align to 4-column increments (4, 8, 12, 16, 20, 24, etc.)
3. **CONSISTENT SIZING WITHIN GROUPS** - Related widgets (e.g., all sector gauges) should use same size
4. **ROW-BASED ORGANIZATION** - Arrange widgets in logical rows, not randomly scattered

LAYOUT PRESET RECOMMENDATIONS:
- Gauges: Use "medium" (8x8) - fits 6 per row with perfect alignment
- Trends: Use "medium" (24x8) - 2 side-by-side, or "fullwidth" for single trend
- Bar Charts: Use "medium" (12x8) - 4 per row with perfect alignment
- Labels: Use "medium" (8x4) - 6 per row, same width as gauges

WHY 4-COLUMN ALIGNMENT MATTERS:
- Dashboard is 50 columns wide (divisible by 2)
- 4-column grid creates: 12 slots per row (48÷4 = 12 widgets at 4 cols each)
- Widgets at 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48 columns align perfectly
- This creates the "smooth structure" you see in professional dashboards

GOOD LAYOUT EXAMPLE (Tunnel Lighting System style):
Row 1: [Gauge 8x8] [Gauge 8x8] [Trend 24x8] [Gauge 8x8]
Row 2: [Gauge 8x8] [Chart 12x8] [Chart 12x8] [Gauge 8x8]
→ Clean grid, consistent sizing, logical grouping

BAD LAYOUT EXAMPLE (avoid):
[Small 4x4] [Large 16x10] [Medium 8x8] [Small 6x6]
→ Unaligned, mixed sizes, looks unprofessional

⚠️ CRITICAL: NEVER PROVIDE yAxisUnit OR unit PARAMETERS ⚠️
================================================================

DO NOT manually specify yAxisUnit or unit parameters. The system automatically reads these from WinCC OA.

WHY UNITS MATTER:
Trend widgets without units are USELESS to users because they cannot tell if they're seeing Watts vs Kilowatts,
Celsius vs Fahrenheit, bar vs psi, etc. Units provide essential context for interpreting data.

HOW AUTO-POPULATION WORKS:
When you create a trend WITHOUT the yAxisUnit parameter, the system automatically:
1. Queries the datapoint's :_original.._unit attribute from WinCC OA configuration
2. Auto-populates yAxisUnit if a unit is found in the DPE config
3. Logs the auto-populated value (e.g., "📊 Auto-populated yAxisUnit from DPE config: kW")
4. This is MORE RELIABLE than guessing units based on datapoint names

If auto-read fails (no unit in DPE config), a console warning will appear. The system will handle this.

UNIT PARAMETERS (DO NOT PROVIDE):
- yAxisUnit: (INTERNAL - System auto-reads from DPE config. DO NOT PROVIDE.)
- yAxisName: (Optional) Name/label for primary Y-axis (e.g., "Temperature", "Power")
- For dataPoints array: "unit" property is auto-populated. DO NOT PROVIDE.

EXAMPLE - Correct (omit yAxisUnit for auto-read):
{
  "type": "trend",
  "title": "Power Consumption",
  "dataPoints": ["System1:Reactor1.power"],
  "timeRange": "now/h"
  // NO yAxisUnit specified - system will auto-read from DPE :_original.._unit
}

- layout: Widget positioning (optional, defaults to "auto")
  - Preset (RECOMMENDED): "auto", "small", "medium", "large", "fullwidth"
    → "auto" automatically finds free space and PREVENTS OVERLAPS
  - Explicit: {"x": 12, "y": 0, "cols": 12, "rows": 8}
    → Use only if you need precise positioning. Check existing widgets first to avoid overlaps!

Returns: Widget ID (UUID)

---

Example 1 - Gauge with manual range:
{
  "dashboardId": "_Dashboard_000001",
  "type": "gauge",
  "title": "Light Density Inside",
  "dataPoint": "System1:S1LGH1.actualValue.lightDensityInside",
  "rangeSettings": {"type": "manual", "min": 0, "max": 1000},
  "layout": "medium"
}

Example 2 - Simple Trend (all series on one Y-axis):
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Temperature Comparison",
  "dataPoints": ["Sensor1.temperature.", "Sensor2.temperature.", "Sensor3.temperature."],
  "timeRange": "now/h",
  "layout": "large"
}

Example 3 - Trend with SECOND Y-AXIS (COMMON: multiple elements of ONE datapoint):
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "S1LGH1 - Multi-Parameter Monitoring",
  "dataPoints": [
    "System1:S1LGH1.actualValue.actualLevel",
    {
      "dataPoint": "System1:S1LGH1.actualValue.illuminationLevel",
      "showCustomYAxis": true,
      "yAxisPosition": "right"
    },
    {
      "dataPoint": "System1:S1LGH1.actualValue.actualPower",
      "showCustomYAxis": true,
      "yAxisPosition": "right"
    }
  ],
  "timeRange": "now/h",
  "layout": "fullwidth"
}

Example 4 - Trend with SECOND Y-AXIS (multiple datapoints):
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Temperature vs Pressure",
  "dataPoints": [
    "Reactor1.temperature.",
    {
      "dataPoint": "Reactor1.pressure.",
      "showCustomYAxis": true,
      "yAxisPosition": "right",
      "lineStyle": "dashed"
    }
  ],
  "timeRange": "now/d",
  "layout": "large"
}

---

IMPORTANT LAYOUT GUIDELINES:
- **ALWAYS use "auto" layout** when creating multiple widgets to prevent overlaps
- **ALWAYS use "medium" or larger** - Small sizes harm readability
- Dashboard grid is 50 columns wide, 25 rows high
- Auto-positioning uses 4-column grid alignment (widgets snap to 0, 4, 8, 12, 16, 20, 24... columns)
- RECOMMENDED preset sizes for professional dashboards:
  * Gauge: "medium" (8x8) - 6 fit perfectly per row
  * Trend: "medium" (24x8) - 2 side-by-side OR "fullwidth"
  * Bar chart: "medium" (12x8) - 4 per row perfect alignment
  * Label: "medium" (8x4) - matches gauge width for consistency
  * Pie: "medium" (8x8) - same as gauge for uniform appearance
- Avoid mixing "small" with "medium/large" - creates uneven layouts
- Only use explicit coordinates if you have a specific layout design and verify no overlaps exist
- Example explicit layout: {"x": 25, "y": 0, "cols": 25, "rows": 13} places widget in right half`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required'),
      type: z.enum(['gauge', 'label', 'trend', 'pie', 'progressbar', 'barchart'], {
        errorMap: () => ({ message: 'Widget type must be gauge, label, trend, pie, progressbar, or barchart' })
      }),
      title: z.string().min(1, 'Widget title is required'),
      dataPoint: z.string().optional(),
      dataPoints: z.array(z.union([z.string(), trendSeriesSchema])).optional(),
      dataPointsDescriptions: z.array(z.string()).optional(),
      rangeSettings: rangeSettingsSchema.optional(),
      timeRange: z.string().optional(),
      layout: layoutSchema.optional(),
      // Appearance settings (header, footer, icons, colors) - can be set at creation time
      titleIcon: z.string().optional(),
      headerTitle: z.string().optional(),
      titleAlignment: z.enum(['left', 'center', 'right']).optional(),
      subtitleIcon: z.string().optional(),
      footerTitle: z.string().optional(),
      subtitleAlignment: z.enum(['left', 'center', 'right']).optional(),
      backgroundColor: z.string().optional(),
      borderColor: z.string().optional(),
      showFullscreenButton: z.boolean().optional(),
      linkTitle: z.string().optional(),
      linkOpenInNewTab: z.boolean().optional(),
      // Progress bar specific
      color: z.string().optional(),
      size: z.enum(['1.5em', '2.25em', '3em']).optional(),
      unit: z.string().optional().describe('INTERNAL - Auto-populated from DPE config. DO NOT PROVIDE.'),
      format: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      showRange: z.boolean().optional(),
      isAbsolute: z.boolean().optional(),
      alertRanges: z.array(alertRangeSchema).optional(),
      // Bar chart specific
      yAxisName: z.string().optional(),
      yAxisUnit: z.string().optional().describe('INTERNAL - Auto-populated from DPE config. DO NOT PROVIDE.'),
      yAxisColor: z.string().optional(),
      range: yAxisRangeSchema.optional(),
      isStacked: z.boolean().optional(),
      isHorizontal: z.boolean().optional(),
      showTooltip: z.boolean().optional(),
      showLegend: z.boolean().optional(),
      legendPosition: z.enum(['topleft', 'topright', 'bottomleft', 'bottomright']).optional()
    },
    async (params: {
      dashboardId: string;
      type: 'gauge' | 'label' | 'trend' | 'pie' | 'progressbar' | 'barchart';
      title: string;
      dataPoint?: string;
      dataPoints?: (string | { dataPoint: string; lineStyle?: 'solid' | 'dashed' | 'dotted'; showCustomYAxis?: boolean; yAxisPosition?: 'left' | 'right' })[];
      dataPointsDescriptions?: string[];
      rangeSettings?: { type: 'manual' | 'oa'; min?: number; max?: number };
      timeRange?: string;
      layout?: any;
      // Appearance settings
      titleIcon?: string;
      headerTitle?: string;
      titleAlignment?: 'left' | 'center' | 'right';
      subtitleIcon?: string;
      footerTitle?: string;
      subtitleAlignment?: 'left' | 'center' | 'right';
      backgroundColor?: string;
      borderColor?: string;
      showFullscreenButton?: boolean;
      linkTitle?: string;
      linkOpenInNewTab?: boolean;
      // Progress bar specific
      color?: string;
      size?: '1.5em' | '2.25em' | '3em';
      unit?: string;
      format?: string;
      min?: number;
      max?: number;
      showRange?: boolean;
      isAbsolute?: boolean;
      alertRanges?: Array<{ min: number; max: number; color: string }>;
      // Bar chart specific
      yAxisName?: string;
      yAxisUnit?: string;
      yAxisColor?: string;
      range?: { min: number | null; max: number | null };
      isStacked?: boolean;
      isHorizontal?: boolean;
      showTooltip?: boolean;
      showLegend?: boolean;
      legendPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
    }) => {
      try {
        const {
          dashboardId, type, title, dataPoint, dataPoints, dataPointsDescriptions,
          rangeSettings, timeRange, layout,
          // Appearance
          titleIcon, headerTitle, titleAlignment, subtitleIcon, footerTitle, subtitleAlignment,
          backgroundColor, borderColor, showFullscreenButton, linkTitle, linkOpenInNewTab,
          // Progress bar
          color, size, unit, format, min, max, showRange, isAbsolute, alertRanges,
          // Bar chart
          yAxisName, yAxisUnit, yAxisColor, range, isStacked, isHorizontal,
          showTooltip, showLegend, legendPosition
        } = params;

        // Build appearance object if any appearance settings provided
        const hasAppearance = titleIcon !== undefined || headerTitle !== undefined ||
                              titleAlignment !== undefined || subtitleIcon !== undefined ||
                              footerTitle !== undefined || subtitleAlignment !== undefined ||
                              backgroundColor !== undefined || borderColor !== undefined ||
                              showFullscreenButton !== undefined || linkTitle !== undefined ||
                              linkOpenInNewTab !== undefined;

        const appearance = hasAppearance ? {
          titleIcon,
          title: headerTitle,
          titleAlignment,
          subtitleIcon,
          subtitle: footerTitle,
          subtitleAlignment,
          backgroundColor,
          borderColor,
          showFullscreenButton,
          linkTitle,
          linkOpenInNewTab
        } : undefined;

        console.log(`Adding ${type} widget to dashboard ${dashboardId}`);

        // Build widget config based on type
        let widgetConfig: WidgetConfig;

        switch (type) {
          case 'gauge':
            if (!dataPoint) {
              return createErrorResponse('Gauge widget requires dataPoint parameter');
            }
            widgetConfig = {
              type: 'gauge',
              title,
              dataPoint,
              rangeSettings,
              layout,
              appearance
            };
            break;

          case 'label':
            if (!dataPoint) {
              return createErrorResponse('Label widget requires dataPoint parameter');
            }
            widgetConfig = {
              type: 'label',
              title,
              dataPoint,
              layout,
              appearance
            };
            break;

          case 'trend':
            if (!dataPoint && !dataPoints) {
              return createErrorResponse('Trend widget requires either dataPoint or dataPoints parameter');
            }
            widgetConfig = {
              type: 'trend',
              title,
              dataPoint,
              dataPoints,
              timeRange,
              yAxisName,
              yAxisUnit,
              yAxisColor,
              range,
              layout,
              appearance
            };
            break;

          case 'pie':
            if (!dataPoints || !dataPointsDescriptions) {
              return createErrorResponse('Pie widget requires both dataPoints and dataPointsDescriptions parameters');
            }
            // Pie charts only support string arrays, extract strings from objects if needed
            const pieDataPoints = dataPoints.map(dp => typeof dp === 'string' ? dp : dp.dataPoint);
            if (pieDataPoints.length !== dataPointsDescriptions.length) {
              return createErrorResponse('dataPoints and dataPointsDescriptions must have the same length');
            }
            widgetConfig = {
              type: 'pie',
              title,
              dataPoints: pieDataPoints,
              dataPointsDescriptions,
              layout,
              appearance
            };
            break;

          case 'progressbar':
            if (!dataPoint) {
              return createErrorResponse('Progress bar widget requires dataPoint parameter');
            }
            widgetConfig = {
              type: 'progressbar',
              title,
              dataPoint,
              color,
              size,
              unit,
              format,
              min,
              max,
              showRange,
              isAbsolute,
              alertRanges,
              layout,
              appearance
            };
            break;

          case 'barchart':
            if (!dataPoints || dataPoints.length === 0) {
              return createErrorResponse('Bar chart widget requires dataPoints parameter with at least one datapoint');
            }
            // Bar charts only support string arrays, extract strings from objects if needed
            const barDataPoints = dataPoints.map(dp => typeof dp === 'string' ? dp : dp.dataPoint);
            widgetConfig = {
              type: 'barchart',
              title,
              dataPoints: barDataPoints,
              yAxisName,
              yAxisUnit,
              yAxisColor,
              range,
              isStacked,
              isHorizontal,
              showTooltip,
              showLegend,
              legendPosition,
              layout,
              appearance
            };
            break;

          default:
            return createErrorResponse(`Unsupported widget type: ${type}`);
        }

        const widgetId = await dashboardManager.addWidget(dashboardId, widgetConfig);

        return createSuccessResponse({
          success: true,
          widgetId,
          dashboardId,
          message: `${type} widget added to dashboard`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error adding widget:', error);
        return createErrorResponse(`Failed to add widget: ${errorMessage}`);
      }
    }
  );

  // ==================== EDIT WIDGET ====================
  server.tool(
    'edit-widget',
    `Edit a widget on a dashboard.

Updates widget properties including title, layout, and appearance settings (header, footer, icons, colors).

Parameters:
- dashboardId: Dashboard datapoint name (required)
- widgetIdentifier: Widget identifier (required)
  - By ID: {"id": "550e8400-e29b-41d4-a716-446655440000"}
  - By index: {"index": 0}
- title: New widget title (optional)
- layout: New widget layout (optional)

APPEARANCE SETTINGS (optional but recommended):
Header/Footer: (recommended to be used for more clarity on the dashboard)
- titleIcon: Header icon (see ICON OPTIONS below)
- headerTitle: Header title text
- titleAlignment: Header text alignment - "left", "center", or "right"
- subtitleIcon: Footer icon (see ICON OPTIONS below)
- footerTitle: Footer text
- subtitleAlignment: Footer text alignment - "left", "center", or "right"

ICON OPTIONS:
You have two options for icons:
1. Built-in Siemens IX icons (1,407 available - use list-ix-icons tool to search)
   - Examples: "trend-upward", "info", "warning", "chart-curve-spline"
   - Use exact icon names from Siemens IX library
2. Custom SVG icons (if IX icons don't fit your needs)
   - Create with: create-custom-icon tool (types: trend, gauge, alert, simple, custom)
   - Use path: "/data/WebUI/icons/your-icon.svg"

RECOMMENDED WORKFLOW:
1. Search IX icons first: Use list-ix-icons with keyword (e.g., {"search": "trend"})
2. If no suitable icon found: Create custom icon with create-custom-icon
3. Use icon in widget: Set titleIcon or subtitleIcon parameter

Colors:
- backgroundColor: Background color (CSS variable like "var(--theme-color-ghost--selected-active)" or hex like "#ffffff")
- borderColor: Border color (CSS variable like "var(--theme-color-critical)" or hex)

Controls:
- showFullscreenButton: Show fullscreen button (true/false)

Links:
- linkTitle: Link text
- linkOpenInNewTab: Open link in new tab (true/false)

⚠️ UNITS WARNING: DO NOT manually edit 'unit' or 'yAxisUnit' parameters.
These are automatically managed by the system from WinCC OA DPE configuration.

WIDGET-SPECIFIC SETTINGS (optional):
Data Formatting:
- unit: (INTERNAL - DO NOT EDIT - Auto-managed)
- format: Value format (e.g., "%0.2f")
- name: Data name/label
- color: Primary color
- showTooltip: Show tooltip on hover (true/false)

Ranges:
- min: Minimum value
- max: Maximum value
- rangeSettings: Range configuration {"type": "manual", "min": 0, "max": 100}

Trend-Specific:
- timeRange: Time range (e.g., "now/h", "24h", "1w/w")
- showLegend: Show legend (true/false)
- dataPoints: Array of datapoints (for adding/removing series)

Bar Chart-Specific:
- yAxisName: Y-axis name
- yAxisUnit: (INTERNAL - DO NOT EDIT - Auto-managed)
- yAxisColor: Y-axis color
- range: Y-axis range {"min": 0, "max": 100}
- isStacked: Stacked bars (true/false)
- isHorizontal: Horizontal bars (true/false)
- legendPosition: "topleft", "topright", "bottomleft", "bottomright"

At least one parameter (title, layout, appearance setting, or widget-specific setting) must be provided.

Example 1 - Update title and layout:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"id": "550e8400-e29b-41d4-a716-446655440000"},
  "title": "Updated Temperature",
  "layout": "large"
}

Example 2 - Add header and footer with icons:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 0},
  "titleIcon": "trend-upward",
  "headerTitle": "Production Trend",
  "titleAlignment": "center",
  "subtitleIcon": "info",
  "subtitleAlignment": "left"
}

Example 3 - Update widget unit and format:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 0},
  "unit": "°C",
  "format": "%0.1f"
}

Example 4 - Change trend time range and show legend:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 1},
  "timeRange": "24h",
  "showLegend": true
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required'),
      widgetIdentifier: widgetIdentifierSchema,
      title: z.string().min(1).optional(),
      layout: layoutSchema.optional(),
      // Appearance settings
      titleIcon: z.string().optional(),
      headerTitle: z.string().optional(),
      titleAlignment: z.enum(['left', 'center', 'right']).optional(),
      subtitleIcon: z.string().optional(),
      footerTitle: z.string().optional(),
      subtitleAlignment: z.enum(['left', 'center', 'right']).optional(),
      backgroundColor: z.string().optional(),
      borderColor: z.string().optional(),
      showFullscreenButton: z.boolean().optional(),
      linkTitle: z.string().optional(),
      linkOpenInNewTab: z.boolean().optional(),
      // Widget-specific settings (data formatting, visualization)
      unit: z.string().optional().describe('INTERNAL - Auto-populated from DPE config. DO NOT PROVIDE.'),
      format: z.string().optional(),
      name: z.string().optional(),
      color: z.string().optional(),
      showTooltip: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      rangeSettings: rangeSettingsSchema.optional(),
      // Trend-specific
      timeRange: z.string().optional(),
      showLegend: z.boolean().optional(),
      dataPoints: z.array(z.union([z.string(), trendSeriesSchema])).optional(),
      // Bar chart specific
      yAxisName: z.string().optional(),
      yAxisUnit: z.string().optional().describe('INTERNAL - Auto-populated from DPE config. DO NOT PROVIDE.'),
      yAxisColor: z.string().optional(),
      range: yAxisRangeSchema.optional(),
      isStacked: z.boolean().optional(),
      isHorizontal: z.boolean().optional(),
      legendPosition: z.enum(['topleft', 'topright', 'bottomleft', 'bottomright']).optional()
    },
    async (params: {
      dashboardId: string;
      widgetIdentifier: { id: string } | { index: number };
      title?: string;
      layout?: any;
      // Appearance
      titleIcon?: string;
      headerTitle?: string;
      titleAlignment?: 'left' | 'center' | 'right';
      subtitleIcon?: string;
      footerTitle?: string;
      subtitleAlignment?: 'left' | 'center' | 'right';
      backgroundColor?: string;
      borderColor?: string;
      showFullscreenButton?: boolean;
      linkTitle?: string;
      linkOpenInNewTab?: boolean;
      // Widget-specific settings
      unit?: string;
      format?: string;
      name?: string;
      color?: string;
      showTooltip?: boolean;
      min?: number;
      max?: number;
      rangeSettings?: { type: 'manual' | 'oa'; min?: number; max?: number };
      // Trend-specific
      timeRange?: string;
      showLegend?: boolean;
      dataPoints?: (string | { dataPoint: string; lineStyle?: 'solid' | 'dashed' | 'dotted'; showCustomYAxis?: boolean; yAxisPosition?: 'left' | 'right' })[];
      // Bar chart specific
      yAxisName?: string;
      yAxisUnit?: string;
      yAxisColor?: string;
      range?: { min: number | null; max: number | null };
      isStacked?: boolean;
      isHorizontal?: boolean;
      legendPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
    }) => {
      try {
        let { dashboardId, widgetIdentifier, title, layout,
              titleIcon, headerTitle, titleAlignment,
              subtitleIcon, footerTitle, subtitleAlignment,
              backgroundColor, borderColor, showFullscreenButton,
              linkTitle, linkOpenInNewTab,
              // Widget-specific settings
              unit, format, name, color, showTooltip, min, max, rangeSettings,
              timeRange, showLegend, dataPoints,
              yAxisName, yAxisUnit, yAxisColor, range, isStacked, isHorizontal, legendPosition } = params;

        // Check if at least one parameter is provided
        const hasAppearanceUpdate = titleIcon !== undefined || headerTitle !== undefined ||
                                     titleAlignment !== undefined || subtitleIcon !== undefined ||
                                     footerTitle !== undefined || subtitleAlignment !== undefined ||
                                     backgroundColor !== undefined || borderColor !== undefined ||
                                     showFullscreenButton !== undefined || linkTitle !== undefined ||
                                     linkOpenInNewTab !== undefined;

        const hasWidgetUpdate = unit !== undefined || format !== undefined || name !== undefined ||
                                color !== undefined || showTooltip !== undefined || min !== undefined ||
                                max !== undefined || rangeSettings !== undefined || timeRange !== undefined ||
                                showLegend !== undefined || dataPoints !== undefined || yAxisName !== undefined ||
                                yAxisUnit !== undefined || yAxisColor !== undefined || range !== undefined ||
                                isStacked !== undefined || isHorizontal !== undefined || legendPosition !== undefined;

        if (!title && !layout && !hasAppearanceUpdate && !hasWidgetUpdate) {
          return createErrorResponse('At least one parameter (title, layout, appearance setting, or widget-specific setting) must be provided');
        }

        // Fix: Parse layout if it's a JSON string (Claude AI sometimes sends it as string)
        if (typeof layout === 'string') {
          try {
            layout = JSON.parse(layout);
          } catch (e) {
            // If parsing fails, leave it as string (might be a preset like "auto")
          }
        }

        console.log(`Editing widget on dashboard ${dashboardId}`);

        // Build appearance object if any appearance settings provided
        const appearance = hasAppearanceUpdate ? {
          titleIcon,
          title: headerTitle,
          titleAlignment,
          subtitleIcon,
          subtitle: footerTitle,
          subtitleAlignment,
          backgroundColor,
          borderColor,
          showFullscreenButton,
          linkTitle,
          linkOpenInNewTab
        } : undefined;

        await dashboardManager.editWidget(dashboardId, widgetIdentifier, {
          type: 'gauge', // Type is not changed during edit
          title: title || '',
          layout,
          appearance,
          // Widget-specific settings
          unit,
          format,
          name,
          color,
          showTooltip,
          min,
          max,
          rangeSettings,
          timeRange,
          showLegend,
          dataPoints,
          yAxisName,
          yAxisUnit,
          yAxisColor,
          range,
          isStacked,
          isHorizontal,
          legendPosition
        } as any);

        return createSuccessResponse({
          success: true,
          dashboardId,
          message: 'Widget updated'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error editing widget:', error);
        return createErrorResponse(`Failed to edit widget: ${errorMessage}`);
      }
    }
  );

  // ==================== DELETE WIDGET ====================
  server.tool(
    'delete-widget',
    `Delete a widget from a dashboard.

Removes a widget from the dashboard.

Parameters:
- dashboardId: Dashboard datapoint name (required)
- widgetIdentifier: Widget identifier (required)
  - By ID: {"id": "550e8400-e29b-41d4-a716-446655440000"}
  - By index: {"index": 0}

Example:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"index": 0}
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required'),
      widgetIdentifier: widgetIdentifierSchema
    },
    async (params: {
      dashboardId: string;
      widgetIdentifier: { id: string } | { index: number };
    }) => {
      try {
        const { dashboardId, widgetIdentifier } = params;

        console.log(`Deleting widget from dashboard ${dashboardId}`);

        await dashboardManager.deleteWidget(dashboardId, widgetIdentifier);

        return createSuccessResponse({
          success: true,
          dashboardId,
          message: 'Widget deleted'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error deleting widget:', error);
        return createErrorResponse(`Failed to delete widget: ${errorMessage}`);
      }
    }
  );

  // ==================== LIST WIDGETS ====================
  server.tool(
    'list-widgets',
    `List all widgets on a dashboard.

Returns an array of all widgets with their configurations.

Parameters:
- dashboardId: Dashboard datapoint name (required)

Returns: Array of widget instances with full configuration

Example:
{
  "dashboardId": "_Dashboard_000001"
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required')
    },
    async (params: { dashboardId: string }) => {
      try {
        const { dashboardId } = params;

        console.log(`Listing widgets on dashboard ${dashboardId}`);

        const widgets = await dashboardManager.listWidgets(dashboardId);

        return createSuccessResponse({
          success: true,
          dashboardId,
          count: widgets.length,
          widgets
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error listing widgets:', error);
        return createErrorResponse(`Failed to list widgets: ${errorMessage}`);
      }
    }
  );

  return 4; // Number of tools registered
}

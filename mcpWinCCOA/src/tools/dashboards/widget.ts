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
  unit: z.string().optional(),
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
- layout: Widget positioning (optional, defaults to "auto")
  - Preset: "auto", "small", "medium", "large", "fullwidth"
  - Explicit: {"x": 12, "y": 0, "cols": 12, "rows": 8}

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

Example 5 - Pie Chart:
{
  "dashboardId": "_Dashboard_000001",
  "type": "pie",
  "title": "Energy Distribution",
  "dataPoints": ["Motor1.power.", "Motor2.power.", "Motor3.power."],
  "dataPointsDescriptions": ["Motor 1", "Motor 2", "Motor 3"],
  "layout": "medium"
}

---
## ADVANCED FEATURES (Trend Widget)

The trend widget supports powerful visualization features for enhanced data analysis:

**Available Features:**
- showConfidenceBand: Show min/max confidence band (PERFECT for outlier detection!)
- showArea: Fill area under line
- color: Custom hex color (e.g., "#ff6b6b", "#4ecdc4")
- name: Custom series name in legend
- unit: Display unit (e.g., "°C", "bar", "kW")
- format: Number format (e.g., "%0.2f" for 2 decimals, "%.1f" for 1 decimal)
- lineStyle: "solid", "dashed", or "dotted"
- min/max: Custom Y-axis range (when showCustomYAxis: true)

Example 6 - Trend with CONFIDENCE BANDS (outlier detection):
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Temperature Monitoring with Outlier Detection",
  "dataPoints": [
    {
      "dataPoint": "Reactor1.temperature.",
      "showConfidenceBand": true,
      "color": "#ff6b6b",
      "name": "Reactor Temperature",
      "unit": "°C",
      "format": "%0.1f"
    }
  ],
  "timeRange": "24h",
  "layout": "large"
}

Example 7 - Multi-Series with CUSTOM COLORS and FORMATTING:
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Production Line Metrics",
  "dataPoints": [
    {
      "dataPoint": "Line1.speed.",
      "color": "#4ecdc4",
      "name": "Line Speed",
      "unit": "m/min",
      "format": "%0.1f",
      "lineStyle": "solid"
    },
    {
      "dataPoint": "Line1.efficiency.",
      "color": "#95e1d3",
      "name": "Efficiency",
      "unit": "%",
      "format": "%0.0f",
      "lineStyle": "dashed"
    },
    {
      "dataPoint": "Line1.quality.",
      "color": "#f38181",
      "name": "Quality Score",
      "format": "%0.2f",
      "showArea": true
    }
  ],
  "timeRange": "now/d",
  "layout": "fullwidth"
}

Example 8 - Trend with SECOND Y-AXIS + CUSTOM RANGE + FORMATTING:
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Pressure & Temperature (Different Scales)",
  "dataPoints": [
    {
      "dataPoint": "Vessel1.temperature.",
      "color": "#ff6b6b",
      "name": "Temperature",
      "unit": "°C",
      "format": "%0.1f"
    },
    {
      "dataPoint": "Vessel1.pressure.",
      "showCustomYAxis": true,
      "yAxisPosition": "right",
      "min": 0,
      "max": 100,
      "color": "#4ecdc4",
      "name": "Pressure",
      "unit": "bar",
      "format": "%0.2f",
      "lineStyle": "dashed"
    }
  ],
  "timeRange": "now/h",
  "layout": "large"
}

Example 9 - Gauge with FORMATTING and CUSTOM COLORS:
{
  "dashboardId": "_Dashboard_000001",
  "type": "gauge",
  "title": "Tank Level",
  "dataPoint": "Tank1.level.",
  "rangeSettings": {"type": "manual", "min": 0, "max": 100},
  "layout": "medium"
}

Example 10 - Label with ICON and FORMATTING:
{
  "dashboardId": "_Dashboard_000001",
  "type": "label",
  "title": "Current Power Consumption",
  "dataPoint": "Plant.totalPower.",
  "layout": "small"
}

Example 11 - Progress Bar (simple):
{
  "dashboardId": "_Dashboard_000001",
  "type": "progressbar",
  "title": "Tank Fill Level",
  "dataPoint": "Tank1.fillLevel.",
  "layout": "medium"
}

Example 12 - Progress Bar with ALERT RANGES (color-coded zones):
{
  "dashboardId": "_Dashboard_000001",
  "type": "progressbar",
  "title": "System Load",
  "dataPoint": "System1.cpuLoad.",
  "layout": "medium"
}

Example 13 - Bar Chart (comparison):
{
  "dashboardId": "_Dashboard_000001",
  "type": "barchart",
  "title": "Energy Consumption by Department",
  "dataPoints": ["Dept1.energy.", "Dept2.energy.", "Dept3.energy.", "Dept4.energy."],
  "layout": "large"
}

Example 14 - Bar Chart with STACKED BARS:
{
  "dashboardId": "_Dashboard_000001",
  "type": "barchart",
  "title": "Monthly Production by Line",
  "dataPoints": ["Line1.output.", "Line2.output.", "Line3.output."],
  "layout": "large"
}

NOTE: Dashboard grid is 50 columns wide. Explicit layout example: {"x": 25, "y": 0, "cols": 25, "rows": 13} places widget in right half.`,
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
      // Progress bar specific
      color: z.string().optional(),
      size: z.enum(['1.5em', '2.25em', '3em']).optional(),
      unit: z.string().optional(),
      format: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      showRange: z.boolean().optional(),
      isAbsolute: z.boolean().optional(),
      alertRanges: z.array(alertRangeSchema).optional(),
      // Bar chart specific
      yAxisName: z.string().optional(),
      yAxisUnit: z.string().optional(),
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
          // Progress bar
          color, size, unit, format, min, max, showRange, isAbsolute, alertRanges,
          // Bar chart
          yAxisName, yAxisUnit, yAxisColor, range, isStacked, isHorizontal,
          showTooltip, showLegend, legendPosition
        } = params;

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
              layout
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
              layout
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
              layout
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
              layout
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
              layout
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
              layout
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

Updates widget properties. Currently supports updating title and layout.

Parameters:
- dashboardId: Dashboard datapoint name (required)
- widgetIdentifier: Widget identifier (required)
  - By ID: {"id": "550e8400-e29b-41d4-a716-446655440000"}
  - By index: {"index": 0}
- title: New widget title (optional)
- layout: New widget layout (optional)

At least one of title or layout must be provided.

Example:
{
  "dashboardId": "_Dashboard_000001",
  "widgetIdentifier": {"id": "550e8400-e29b-41d4-a716-446655440000"},
  "title": "Updated Temperature",
  "layout": "large"
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required'),
      widgetIdentifier: widgetIdentifierSchema,
      title: z.string().min(1).optional(),
      layout: layoutSchema.optional()
    },
    async (params: {
      dashboardId: string;
      widgetIdentifier: { id: string } | { index: number };
      title?: string;
      layout?: any;
    }) => {
      try {
        let { dashboardId, widgetIdentifier, title, layout } = params;

        if (!title && !layout) {
          return createErrorResponse('At least one of title or layout must be provided');
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

        await dashboardManager.editWidget(dashboardId, widgetIdentifier, {
          type: 'gauge', // Type is not changed during edit
          title: title || '',
          layout
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

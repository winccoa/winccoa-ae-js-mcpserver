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
 */
const layoutSchema = z.union([
  z.enum(['auto', 'small', 'medium', 'large', 'fullwidth']),
  z.object({
    x: z.number(),
    y: z.number(),
    cols: z.number(),
    rows: z.number()
  })
]);

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

Creates a new widget with the specified configuration and adds it to the dashboard. Supports gauge, label, trend, and pie widgets.

Parameters:
- dashboardId: Dashboard datapoint name (e.g., "_Dashboard_000001") (required)
- type: Widget type - "gauge", "label", "trend", or "pie" (required)
- title: Widget title (required)
- dataPoint: Datapoint path (required for gauge, label, trend with single datapoint)
- dataPoints: Array of datapoint paths (required for pie, optional for trend)
- dataPointsDescriptions: Array of descriptions for pie slices (required for pie, must match dataPoints length)
- rangeSettings: Range configuration for gauge (optional)
  - type: "manual" or "oa" (from datapoint config)
  - min: Minimum value (for manual type)
  - max: Maximum value (for manual type)
- layout: Widget positioning (optional, defaults to "auto")
  - Preset: "auto", "small", "medium", "large", "fullwidth"
  - Explicit: {x: number, y: number, cols: number, rows: number}

Returns: Widget ID (UUID)

Example - Gauge:
{
  "dashboardId": "_Dashboard_000001",
  "type": "gauge",
  "title": "Temperature",
  "dataPoint": "Sensor1.temperature.",
  "rangeSettings": {"type": "manual", "min": 0, "max": 100},
  "layout": "medium"
}

Example - Trend (single):
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Temperature Trend",
  "dataPoint": "Sensor1.temperature.",
  "layout": "large"
}

Example - Trend (multiple):
{
  "dashboardId": "_Dashboard_000001",
  "type": "trend",
  "title": "Multi Sensor Trend",
  "dataPoints": ["Sensor1.temperature.", "Sensor2.temperature."],
  "layout": "fullwidth"
}

Example - Pie:
{
  "dashboardId": "_Dashboard_000001",
  "type": "pie",
  "title": "Energy Distribution",
  "dataPoints": ["Motor1.power.", "Motor2.power.", "Motor3.power."],
  "dataPointsDescriptions": ["Motor 1", "Motor 2", "Motor 3"],
  "layout": "medium"
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required'),
      type: z.enum(['gauge', 'label', 'trend', 'pie'], {
        errorMap: () => ({ message: 'Widget type must be gauge, label, trend, or pie' })
      }),
      title: z.string().min(1, 'Widget title is required'),
      dataPoint: z.string().optional(),
      dataPoints: z.array(z.string()).optional(),
      dataPointsDescriptions: z.array(z.string()).optional(),
      rangeSettings: rangeSettingsSchema.optional(),
      layout: layoutSchema.optional()
    },
    async (params: {
      dashboardId: string;
      type: 'gauge' | 'label' | 'trend' | 'pie';
      title: string;
      dataPoint?: string;
      dataPoints?: string[];
      dataPointsDescriptions?: string[];
      rangeSettings?: { type: 'manual' | 'oa'; min?: number; max?: number };
      layout?: any;
    }) => {
      try {
        const { dashboardId, type, title, dataPoint, dataPoints, dataPointsDescriptions, rangeSettings, layout } = params;

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
              layout
            };
            break;

          case 'pie':
            if (!dataPoints || !dataPointsDescriptions) {
              return createErrorResponse('Pie widget requires both dataPoints and dataPointsDescriptions parameters');
            }
            if (dataPoints.length !== dataPointsDescriptions.length) {
              return createErrorResponse('dataPoints and dataPointsDescriptions must have the same length');
            }
            widgetConfig = {
              type: 'pie',
              title,
              dataPoints,
              dataPointsDescriptions,
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
        const { dashboardId, widgetIdentifier, title, layout } = params;

        if (!title && !layout) {
          return createErrorResponse('At least one of title or layout must be provided');
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

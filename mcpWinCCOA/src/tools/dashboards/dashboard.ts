/**
 * Dashboard Tools
 *
 * MCP tools for dashboard CRUD operations
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';
import { DashboardManager } from '../../helpers/dashboards/DashboardManager.js';

/**
 * Register dashboard tools with the MCP server
 * @param server - MCP server instance
 * @param context - Shared context with winccoa instance
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;
  const dashboardManager = new DashboardManager(winccoa);

  // ==================== CREATE DASHBOARD ====================
  server.tool(
    'create-dashboard',
    `Create a new dashboard in WinCC OA.

Creates a dashboard with the specified name, description, and creator. The dashboard will be automatically assigned a unique ID (e.g., _Dashboard_000001).

IMPORTANT: The createdBy parameter is REQUIRED. It must be a valid username from the WinCC OA user system. Dashboards without a valid creator cannot be modified later.

Parameters:
- name: Dashboard name (required)
- description: Dashboard description (required)
- createdBy: Username of the dashboard creator (required, must exist in _Users.UserName)

Returns: Dashboard datapoint name (e.g., "_Dashboard_000001")

Example:
{
  "name": "Production Overview",
  "description": "Main production line monitoring dashboard",
  "createdBy": "admin"
}`,
    {
      name: z.string().min(1, 'Dashboard name is required'),
      description: z.string().min(1, 'Dashboard description is required'),
      createdBy: z.string().min(1, 'Creator username is required')
    },
    async ({ name, description, createdBy }: { name: string; description: string; createdBy: string }) => {
      try {
        console.log(`Creating dashboard: ${name} (creator: ${createdBy})`);

        const dashboardId = await dashboardManager.createDashboard({
          name,
          description,
          createdBy
        });

        return createSuccessResponse({
          success: true,
          dashboardId,
          message: `Dashboard created: ${dashboardId}`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error creating dashboard:', error);
        return createErrorResponse(`Failed to create dashboard: ${errorMessage}`);
      }
    }
  );

  // ==================== EDIT DASHBOARD ====================
  server.tool(
    'edit-dashboard',
    `Edit an existing dashboard's properties.

Updates the name and/or description of a dashboard.

Parameters:
- dashboardId: Dashboard datapoint name (e.g., "_Dashboard_000001") (required)
- name: New dashboard name (optional)
- description: New dashboard description (optional)

At least one of name or description must be provided.

Example:
{
  "dashboardId": "_Dashboard_000001",
  "name": "Updated Production Overview",
  "description": "Updated description"
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required'),
      name: z.string().min(1).optional(),
      description: z.string().min(1).optional()
    },
    async ({
      dashboardId,
      name,
      description
    }: {
      dashboardId: string;
      name?: string;
      description?: string;
    }) => {
      try {
        if (!name && !description) {
          return createErrorResponse('At least one of name or description must be provided');
        }

        console.log(`Editing dashboard: ${dashboardId}`);

        await dashboardManager.editDashboard(dashboardId, {
          name,
          description
        });

        return createSuccessResponse({
          success: true,
          dashboardId,
          message: `Dashboard updated: ${dashboardId}`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error editing dashboard:', error);
        return createErrorResponse(`Failed to edit dashboard: ${errorMessage}`);
      }
    }
  );

  // ==================== DELETE DASHBOARD ====================
  server.tool(
    'delete-dashboard',
    `Delete a dashboard.

Marks a dashboard as unpublished and clears all its widgets.

Parameters:
- dashboardId: Dashboard datapoint name (e.g., "_Dashboard_000001") (required)

Example:
{
  "dashboardId": "_Dashboard_000001"
}`,
    {
      dashboardId: z.string().min(1, 'Dashboard ID is required')
    },
    async ({ dashboardId }: { dashboardId: string }) => {
      try {
        console.log(`Deleting dashboard: ${dashboardId}`);

        await dashboardManager.deleteDashboard(dashboardId);

        return createSuccessResponse({
          success: true,
          dashboardId,
          message: `Dashboard deleted: ${dashboardId}`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error deleting dashboard:', error);
        return createErrorResponse(`Failed to delete dashboard: ${errorMessage}`);
      }
    }
  );

  // ==================== LIST DASHBOARDS ====================
  server.tool(
    'list-dashboards',
    `List all dashboards in the system.

Returns an array of all dashboards with their properties.

No parameters required.

Returns: Array of dashboard information objects with:
- id: Dashboard datapoint name
- dashboardNumber: Dashboard number
- name: Dashboard name
- description: Dashboard description
- widgetCount: Number of widgets on the dashboard
- isPublished: Whether the dashboard is published

Example response:
[
  {
    "id": "_Dashboard_000001",
    "dashboardNumber": 1,
    "name": "Production Overview",
    "description": "Main production line",
    "widgetCount": 5,
    "isPublished": true
  }
]`,
    {},
    async () => {
      try {
        console.log('Listing dashboards');

        const dashboards = await dashboardManager.listDashboards();

        return createSuccessResponse({
          success: true,
          count: dashboards.length,
          dashboards
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error listing dashboards:', error);
        return createErrorResponse(`Failed to list dashboards: ${errorMessage}`);
      }
    }
  );

  return 4; // Number of tools registered
}

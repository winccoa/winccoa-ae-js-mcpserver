/**
 * Tool Module Types
 *
 * Type definitions for MCP tool modules and their registration.
 */

import type { ServerContext } from '../server/context.js';

/**
 * Tool module interface
 * All tool modules must export a registerTools function
 */
export interface ToolModule {
  /**
   * Register tools with the MCP server
   * @param server - MCP server instance
   * @param context - Shared server context
   * @returns Number of tools registered
   */
  registerTools: (server: any, context: ServerContext) => Promise<number> | number;
}

/**
 * Tool registration result
 */
export interface ToolRegistrationResult {
  /** Tool category/path */
  category: string;

  /** Number of tools registered */
  count: number;

  /** Success status */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * MCP (Model Context Protocol) Response Types
 *
 * These types define the structure of responses returned by MCP tools.
 */

/**
 * Content block for MCP responses
 */
export interface McpContent {
  type: "text";
  text: string;
}

/**
 * Success response structure
 */
export interface McpSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error response structure
 */
export interface McpErrorResponse {
  error: true;
  message: string;
  code?: string;
  details?: string;
  stack?: string;
}

/**
 * Complete MCP tool response with content array
 */
export interface McpToolResponse {
  content: McpContent[];
}

/**
 * Helper type for response data (success or error)
 */
export type McpResponseData = McpSuccessResponse | McpErrorResponse;

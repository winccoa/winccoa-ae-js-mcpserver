/**
 * Utility helper functions for MCP tool responses and datapoint operations
 */

import type { WinccoaManager } from 'winccoa-manager';
import type {
  McpContent,
  McpSuccessResponse,
  McpErrorResponse,
  McpToolResponse,
  DatapointChild
} from '../types/index.js';

/**
 * Create content array for MCP responses, filtering internal types if needed
 * @param arr - Array of type names
 * @param withInternals - Whether to include internal types (starting with _)
 * @returns Content array for MCP response
 */
export function mkTypesContent(arr: string[], withInternals?: boolean): McpContent[] {
  const ret: McpContent[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (item !== undefined) {
      if (!item.startsWith('_')) {
        ret.push({ type: "text", text: item });
      } else if (withInternals) {
        ret.push({ type: "text", text: item });
      }
    }
  }
  return ret;
}

/**
 * Recursively add description and unit information to datapoint children
 * @param children - Array of child datapoint elements
 * @param parentPath - Parent datapoint path
 * @param winccoa - WinCC OA manager instance
 */
export function addDescriptionAndUnitsToChildren(
  children: DatapointChild[],
  parentPath: string,
  winccoa: WinccoaManager
): void {
  children.forEach(child => {
    const currentPath = `${parentPath}.${child.name}`;
    if (Array.isArray(child.children) && child.children.length > 0) {
      addDescriptionAndUnitsToChildren(child.children, currentPath, winccoa);
    } else {
      // Only get unit and description for leaf elements (no children)
      try {
        child.unit = winccoa.dpGetUnit(currentPath);
        child.description = winccoa.dpGetDescription(currentPath);
      } catch (error) {
        // Silently ignore errors for individual elements
      }
    }
  });
}

/**
 * Create standardized error response for MCP tools
 * @param message - Error message
 * @param codeOrDetails - Error code (string) or details object (optional)
 * @returns MCP error response
 */
export function createErrorResponse(
  message: string,
  codeOrDetails?: string | Record<string, any>
): McpToolResponse {
  const response: McpErrorResponse = {
    error: true,
    message
  };

  if (typeof codeOrDetails === 'string') {
    response.code = codeOrDetails;
  } else if (typeof codeOrDetails === 'object' && codeOrDetails !== null) {
    Object.assign(response, codeOrDetails);
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response)
    }]
  };
}

/**
 * Create standardized success response for MCP tools
 * @param result - Result data
 * @param message - Optional success message
 * @returns MCP success response
 */
export function createSuccessResponse<T = any>(
  result: T,
  message?: string
): McpToolResponse {
  const response: McpSuccessResponse<T> = {
    success: true,
    data: result
  };

  if (message) {
    response.message = message;
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify(response)
    }]
  };
}

/**
 * Validate datapoint name format
 * @param dpName - Datapoint name to validate
 * @returns True if valid
 */
export function isValidDatapointName(dpName: string): boolean {
  if (!dpName || typeof dpName !== 'string') {
    return false;
  }

  // Basic validation: should not be empty, no special chars that break WinCC OA
  return dpName.length > 0 && !dpName.includes('..') && !dpName.startsWith('.');
}

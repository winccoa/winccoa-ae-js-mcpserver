/**
 * Utility helper functions for MCP tool responses and datapoint operations
 */

import type { WinccoaManager } from 'winccoa-manager';
import type {
  McpSuccessResponse,
  McpErrorResponse,
  McpToolResponse,
  DatapointChild
} from '../types/index.js';
import * as log from './logger.js';

/**
 * Filter datapoint type names, dropping internal types (starting with _) unless requested
 * @param arr - Array of type names
 * @param withInternals - Whether to include internal types (starting with _)
 * @returns Filtered type names
 */
export function filterTypeNames(arr: ReadonlyArray<string | undefined>, withInternals?: boolean): string[] {
  return arr.filter(
    (item): item is string => typeof item === 'string' && (withInternals === true || !item.startsWith('_'))
  );
}

/** One flattened WinCC OA error (see describeWinccoaError). */
export interface WinccoaErrorDetail {
  code?: number;
  message: string;
  dpe?: string;
}

/** Flattened view of a WinCC OA error, including its nested details. */
export interface WinccoaErrorDescription {
  /** Effective code: the inner code if all inner errors agree, else the outer code */
  code?: number;
  /** Outer code as reported by the manager (e.g. 9399 "multiple errors") */
  outerCode?: number;
  /** Human-readable message: the inner messages if there are any, else the outer message */
  message: string;
  /** Inner errors, flattened */
  details: WinccoaErrorDetail[];
}

/** Read a numeric `code` from an error-like value. */
function errorCode(e: unknown): number | undefined {
  const code = (e as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string' && code.trim() !== '' && !Number.isNaN(Number(code))) return Number(code);
  return undefined;
}

/** Read a message from an error-like value. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  const message = (e as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' ? message : String(e);
}

/** Read the dpe an error refers to, if the manager attached one. */
function errorDpe(e: unknown): string | undefined {
  const err = e as { dpe?: unknown; dpName?: unknown } | null | undefined;
  if (typeof err?.dpe === 'string') return err.dpe;
  if (typeof err?.dpName === 'string') return err.dpName;
  return undefined;
}

/** Nested WinCC OA errors, if any. */
function errorDetails(e: unknown): unknown[] {
  const details = (e as { details?: unknown } | null | undefined)?.details;
  if (Array.isArray(details)) return details;
  // A single nested error instead of an array
  if (details instanceof Error || (typeof details === 'object' && details !== null && 'message' in details)) {
    return [details];
  }
  return [];
}

/**
 * Flatten a WinccoaError into code, message and inner details.
 *
 * A failing dpGet usually throws 9399 "multiple errors (N errors total)" with
 * the real cause - e.g. 71 "DP does not exist" naming the element - only in
 * `details`. Forwarding `error.message` alone hides that from the client.
 * Nested details are flattened (their own details are pulled up one level).
 *
 * @param e - Caught error
 * @param fallbackDpe - DPE the caller requested; used for inner details that carry no dpe themselves
 * @returns Flattened description
 */
export function describeWinccoaError(e: unknown, fallbackDpe?: string): WinccoaErrorDescription {
  const outerCode = errorCode(e);
  const outerMessage = errorMessage(e);

  const details: WinccoaErrorDetail[] = [];
  const push = (inner: unknown): void => {
    const detail: WinccoaErrorDetail = { message: errorMessage(inner) };
    const code = errorCode(inner);
    if (code !== undefined) detail.code = code;
    const dpe = errorDpe(inner) || fallbackDpe;
    if (dpe) detail.dpe = dpe;
    details.push(detail);
  };

  for (const inner of errorDetails(e)) {
    const nested = errorDetails(inner);
    if (nested.length > 0) {
      nested.forEach(push);
    } else {
      push(inner);
    }
  }

  if (details.length === 0) {
    return {
      ...(outerCode !== undefined ? { code: outerCode, outerCode } : {}),
      message: outerMessage,
      details
    };
  }

  const innerCodes = new Set(details.map(d => d.code));
  const commonCode = innerCodes.size === 1 ? [...innerCodes][0] : undefined;
  const code = commonCode !== undefined ? commonCode : outerCode;
  const message = [...new Set(details.map(d => d.message))].join('; ');

  return {
    ...(code !== undefined ? { code } : {}),
    ...(outerCode !== undefined ? { outerCode } : {}),
    message,
    details
  };
}

/** Codes meaning "the client asked for something that does not exist": expected, not a server fault. */
const EXPECTED_NOT_FOUND_CODES: ReadonlySet<number> = new Set([71, 57, 19]);

/**
 * Log a caught WinCC OA error as a single line.
 *
 * Expected not-found codes (71 DP does not exist, 57 DP type does not exist,
 * 19 attribute not in config) are client mistakes and go out at warn level.
 * Everything else is logged at error level; the stack is added only at
 * MCP_LOG_LEVEL=debug. The error object itself is never dumped.
 *
 * @param context - What was being attempted, e.g. "Error getting type name for X"
 * @param e - Caught error
 * @param fallbackDpe - DPE the caller requested
 */
export function logWinccoaError(context: string, e: unknown, fallbackDpe?: string): void {
  const described = describeWinccoaError(e, fallbackDpe);
  // WinccoaError messages already start with "<code>, "; do not repeat the code.
  const hasCodePrefix = described.code !== undefined && described.message.trimStart().startsWith(`${described.code},`);
  const codePrefix = described.code !== undefined && !hasCodePrefix ? `[${described.code}] ` : '';
  const line = `${context}: ${codePrefix}${described.message}`;
  if (described.code !== undefined && EXPECTED_NOT_FOUND_CODES.has(described.code)) {
    log.warn(line);
    return;
  }
  log.error(line);
  if (e instanceof Error && e.stack) log.debug(e.stack);
}

/** errorType per WinCC OA error code, for winccoaErrorResponse. */
const WINCCOA_ERROR_TYPES: Record<number, string> = {
  71: 'DP_NOT_EXIST',
  57: 'DP_TYPE_NOT_EXIST'
};

/**
 * Build the uniform error envelope for a caught WinCC OA error:
 * `{error, message, errorCode?, errorType?, details}`.
 *
 * @param prefix - Message prefix, e.g. "Failed to get type name for X"
 * @param e - Caught error
 * @param fallbackDpe - DPE the caller requested (fills empty details[].dpe)
 */
export function winccoaErrorResponse(prefix: string, e: unknown, fallbackDpe?: string): McpToolResponse {
  const described = describeWinccoaError(e, fallbackDpe);
  const errorType = described.code !== undefined ? WINCCOA_ERROR_TYPES[described.code] : undefined;
  return createErrorResponse(`${prefix}: ${described.message}`, {
    errorCode: described.code,
    ...(errorType ? { errorType } : {}),
    details: described.details
  });
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

/**
 * Validate datapoint element for dpGet operations
 * Rejects asterisk (*) wildcard to prevent large responses
 * @param dpe - Datapoint element name to validate
 * @returns True if valid for dpGet
 */
export function isValidDatapointElementForGet(dpe: string): boolean {
  if (!dpe || typeof dpe !== 'string') {
    return false;
  }

  // Reject asterisk wildcard (causes response too large)
  if (dpe.includes('*')) {
    return false;
  }

  // Basic validation
  return dpe.length > 0 && !dpe.includes('..') && !dpe.startsWith('.');
}

/**
 * Validate array of datapoint elements for dpGet operations
 * @param dpes - Array of datapoint element names
 * @returns Validation result with invalid entries if any
 */
export function validateDatapointElementsForGet(dpes: string[]): { valid: boolean; invalid: string[] } {
  const invalid: string[] = [];

  for (const dpe of dpes) {
    if (!isValidDatapointElementForGet(dpe)) {
      invalid.push(dpe);
    }
  }

  return {
    valid: invalid.length === 0,
    invalid
  };
}

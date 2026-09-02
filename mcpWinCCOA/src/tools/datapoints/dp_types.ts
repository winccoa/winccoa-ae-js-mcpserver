/**
 * Datapoint Type Management Tools
 *
 * MCP tools for retrieving datapoint type information.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpeType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Register datapoint type management tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "dp-type-get",
    `Get structure of a data point type as a tree of nodes.

dpt: Data point type name to retrieve structure for
includeSubTypes: Optional flag to include subtypes in the result (default: false)

Returns: WinccoaDpTypeNode structure representing the complete hierarchy of the data point type
including all elements, their data types, and structural relationships.`,
    {
      dpType: z.string(),
      withSubTypes: z.boolean().optional()
    },
    async ({ dpType, withSubTypes }: { dpType: string; withSubTypes?: boolean }) => {
      try {
        const result = winccoa.dpTypeGet(dpType, withSubTypes);

        // The raw result gives a numeric type and, for a scalar type, an empty
        // children array - which leaves a caller unable to tell whether the
        // element path is "myDp." or something deeper. Annotate it.
        const children = (result as any)?.children;
        const isScalar = !Array.isArray(children) || children.length === 0;
        const typeNumber = (result as any)?.type;
        const typeName = typeof typeNumber === 'number' ? DpeType[typeNumber] : undefined;

        return createSuccessResponse({
          ...(result as object),
          ...(typeName ? { typeName } : {}),
          isScalar,
          elementPathHint: isScalar
            ? `Scalar type: the datapoint element path is the datapoint name followed by a dot, e.g. "System1:myDp."`
            : `Structured type: address an element via its child name, e.g. "System1:myDp.<child>"`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error getting datapoint type ${dpType}:`, error);
        return createErrorResponse(`Failed to get datapoint type ${dpType}: ${errorMessage}`);
      }
    }
  );

  server.tool(
    "dp-type-name",
    `Returns the data point type for the given data point name.

dpName: Name of the data point (for example, 'valve.opening')

Returns: DP type as a string, or empty string if data point doesn't exist or error occurs.

Example: dpTypeName('Valve17.opening') might return 'AnalogValve'`,
    {
      dpName: z.string()
    },
    async ({ dpName }: { dpName: string }) => {
      try {
        const result = winccoa.dpTypeName(dpName);
        return createSuccessResponse({ dpName, typeName: result });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error getting type name for ${dpName}:`, error);
        return createErrorResponse(`Failed to get type name for ${dpName}: ${errorMessage}`);
      }
    }
  );

  return 2; // Number of tools registered
}

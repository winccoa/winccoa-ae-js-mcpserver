/**
 * Basic Datapoint Tools
 *
 * MCP tools for retrieving datapoint types, instances, and values.
 */

import { z } from 'zod';
import { mkTypesContent, addDescriptionAndUnitsToChildren, createSuccessResponse, createErrorResponse, validateDatapointElementsForGet } from '../../utils/helpers.js';
import type { ServerContext, McpContent } from '../../types/index.js';

/**
 * Register basic datapoint tools (get-dpTypes, get-datapoints, get-value)
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "get-dpTypes",
    `Returns all or selected data point types from the current WinCC OA project.

Pattern: Pattern for the returned DPTs. When an empty pattern is given (=default), then returns all DP types.
Wildcards are used to filter data point type name. The characters * and ? are used for the purpose, where the asterisk (*) replaces any number of characters and the question mark ? stands for just one character.
Wildcards can be used in arrays (square brackets, e.g.: [0,3,5-7] - numbers 0,3,5,6,7) or outside arrays in option lists (in curly brackets {}).

Example wildcard patterns:
- '{*.Ala.*,*.Ala*}' - Multiple patterns with alarm types
- '*{.Ala.,.Ala}*' - Alternative alarm patterns
- '*.A{la.,la}*' - Partial matching
- '*.Ala.*' - All alarm-related types
- '*.Ala*' - All types starting with Ala

systemId: Specify a different system ID to query from other systems. Default queries local system.

includeEmpty: When set to false, data point types without existing data points will be ignored.

Returns: Array of datapoint type definitions with complete structure information, element hierarchy, and type metadata including attributes, formats, and engineering units.`,
    {
      pattern: z.string().optional(),
      systemId: z.number().optional(),
      withInternals: z.boolean().optional(),
      includeEmpty: z.boolean().optional()
    },
    async ({
      pattern,
      systemId,
      withInternals,
      includeEmpty
    }: {
      pattern?: string;
      systemId?: number;
      withInternals?: boolean;
      includeEmpty?: boolean;
    }) => {
      try {
        console.log('Getting datapoint types');
        const types = winccoa.dpTypes(pattern, systemId, includeEmpty);
        console.log(`Found ${types.length} datapoint types`);
        return { content: mkTypesContent(types, withInternals) };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting datapoint types:', error);
        return createErrorResponse(`Failed to get datapoint types: ${errorMessage}`);
      }
    }
  );

  server.tool(
    "get-datapoints",
    `Search and return datapoint instances from the WinCC OA project by pattern and type.
    For each match, provides the datapoint's type, description, and complete structure including all children fields with
    their full path and engineering unit metadata.

    Supports advanced wildcard pattern matching (* and ?) and case-insensitive search.
    Can filter by specific datapoint type to narrow results.

    Pagination: Results are limited to 200 items per request. Use 'start' (default: 0) and 'limit' (default: 200, max: 200)
    parameters for pagination. Response includes metadata with total count and hasMore flag.

    Returns: Array of datapoint objects with name, type, multilingual description, and complete structure hierarchy
    including all elements with their full paths, data types, and engineering units.`,
    {
      dpNamePattern: z.string().optional(),
      dpType: z.string().optional(),
      ignoreCase: z.boolean().optional(),
      start: z.number().min(0).optional(),
      limit: z.number().min(1).max(200).optional()
    },
    async ({
      dpNamePattern,
      dpType,
      ignoreCase,
      start = 0,
      limit = 200
    }: {
      dpNamePattern?: string;
      dpType?: string;
      ignoreCase?: boolean;
      start?: number;
      limit?: number;
    }) => {
      try {
        const pattern = dpNamePattern && dpNamePattern.length > 0 ? dpNamePattern : '*';
        const dps = winccoa.dpNames(pattern, dpType, ignoreCase);

        const totalCount = dps.length;
        const effectiveLimit = Math.min(limit, 200);
        const endIndex = Math.min(start + effectiveLimit, totalCount);
        const paginatedDps = dps.slice(start, endIndex);
        const hasMore = endIndex < totalCount;

        const results: McpContent[] = [];
        for (const name of paginatedDps) {
          const dp: any = {};
          dp.name = name;
          dp.type = winccoa.dpTypeName(name);
          dp.description = winccoa.dpGetDescription(name);
          dp.structure = winccoa.dpTypeGet(dp.type);
          addDescriptionAndUnitsToChildren(dp.structure.children, name, winccoa);
          results.push({ type: "text", text: JSON.stringify(dp) });
        }

        console.log(
          `Found ${totalCount} total datapoints, returning ${results.length} (start: ${start}, limit: ${effectiveLimit})`
        );

        const response = {
          content: results,
          metadata: {
            totalCount,
            start,
            limit: effectiveLimit,
            returnedCount: results.length,
            hasMore
          }
        };

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error getting datapoints:', error);
        return createErrorResponse(`Failed to get datapoints: ${errorMessage}`);
      }
    }
  );

  server.tool(
    "get-value",
    `Get current value of datapoint element(s) from WinCC OA.

For a single datapoint: pass as string (e.g. 'System1:Pump.state')
For multiple datapoints: pass as JSON array (e.g. ['System1:Pump.state', 'System1:Valve.position'])
DO NOT use comma-separated strings.

Returns for each datapoint:
- value: Current process value
- timestamp: Server timestamp when value was last updated
- unit: Engineering unit (e.g. '°C', 'bar', 'rpm')

Supports all WinCC OA datapoint element types including state values, command values, parameters, alerts, and configuration elements.`,
    {
      dpe: z.union([z.string(), z.array(z.string())])
    },
    async ({ dpe }: { dpe: string | string[] }) => {
      try {
        const dpeArray = Array.isArray(dpe) ? dpe : [dpe];

        // Validate datapoint elements (reject asterisk wildcard)
        const validation = validateDatapointElementsForGet(dpeArray);
        if (!validation.valid) {
          return createErrorResponse(
            `Wildcard '*' not allowed in dpGet (response too large). Invalid datapoint element(s): ${validation.invalid.join(', ')}. Use get-datapoints tool with dpNamePattern for wildcard searches.`,
            {
              errorType: 'INVALID_DPE_WILDCARD',
              invalidElements: validation.invalid
            }
          );
        }

        const dpesToQuery: string[] = [];

        // Build query array with value and timestamp for each dpe
        for (const dp of dpeArray) {
          dpesToQuery.push(dp + ':_online.._value');
          dpesToQuery.push(dp + ':_original.._stime');
        }

        const values = await winccoa.dpGet(dpesToQuery);

        // Process results
        const results = [];
        for (let i = 0; i < dpeArray.length; i++) {
          const result = {
            dpe: dpeArray[i],
            value: (values as any[])[i * 2],
            timestamp: (values as any[])[i * 2 + 1],
            unit: winccoa.dpGetUnit(dpeArray[i]!)
          };
          results.push(result);
        }

        // Return single object if single dpe, array if multiple
        const finalResult = Array.isArray(dpe) ? results : results[0];

        console.log(`Got values for ${dpeArray.length} datapoint(s)`);
        return createSuccessResponse(finalResult);
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error getting values:`, error);

        // Handle WinCC OA specific errors
        if (error.code === 71) {
          return createErrorResponse(
            `Datapoint does not exist. Please check the datapoint names. Error: ${errorMessage}`,
            {
              errorCode: error.code,
              errorType: 'DP_NOT_EXIST',
              details: errorMessage
            }
          );
        }

        return createErrorResponse(`Failed to get values: ${errorMessage}`, {
          errorCode: error.code || undefined,
          details: errorMessage
        });
      }
    }
  );

  return 3; // Number of tools registered
}

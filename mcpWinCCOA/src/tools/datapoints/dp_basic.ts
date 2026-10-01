/**
 * Basic Datapoint Tools
 *
 * MCP tools for retrieving datapoint types, instances, and values.
 */

import { z } from 'zod';
import {
  filterTypeNames,
  addDescriptionAndUnitsToChildren,
  createSuccessResponse,
  createErrorResponse,
  validateDatapointElementsForGet,
  describeWinccoaError
} from '../../utils/helpers.js';
import * as log from '../../utils/logger.js';
import type { ServerContext } from '../../types/index.js';

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

withInternals: When true, internal types (names starting with _) are included. Default: false.

Returns: JSON envelope {"success": true, "data": {"types": [...type names...], "count": N, "withInternals": false}}.
Only the type NAMES are returned. Use dp-type-get to read the element structure of a type.`,
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
        const allTypes = winccoa.dpTypes(pattern, systemId, includeEmpty);
        const types = filterTypeNames(allTypes, withInternals);
        console.log(`Found ${allTypes.length} datapoint types, returning ${types.length}`);
        return createSuccessResponse({
          types,
          count: types.length,
          withInternals: withInternals === true
        });
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
    parameters for pagination.

    Returns: one JSON envelope
    {"success": true, "data": {"datapoints": [...], "totalCount": N, "start": 0, "limit": 200, "returnedCount": n, "hasMore": false}}
    Each entry of "datapoints" has name, type, multilingual description, and the complete structure hierarchy
    including all elements with their full paths, data types, and engineering units.
    No match returns the same envelope with "datapoints": [] and "returnedCount": 0.`,
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

        const datapoints: any[] = [];
        for (const name of paginatedDps) {
          const dp: any = {};
          dp.name = name;
          dp.type = winccoa.dpTypeName(name);
          dp.description = winccoa.dpGetDescription(name);
          dp.structure = winccoa.dpTypeGet(dp.type);
          addDescriptionAndUnitsToChildren(dp.structure.children, name, winccoa);
          datapoints.push(dp);
        }

        console.log(
          `Found ${totalCount} total datapoints, returning ${datapoints.length} (start: ${start}, limit: ${effectiveLimit})`
        );

        return createSuccessResponse({
          datapoints,
          totalCount,
          start,
          limit: effectiveLimit,
          returnedCount: datapoints.length,
          hasMore
        });
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

Supports all WinCC OA datapoint element types including state values, command values, parameters, alerts, and configuration elements.

Errors: {"error": true, "message": "...", "errorCode": N, "errorType"?: "...", "details": [{"code", "message"}]}.
The message and errorCode carry the inner WinCC OA error (e.g. 71 / errorType DP_NOT_EXIST for a missing datapoint),
not just the generic 9399 "multiple errors". When some elements of a multi-element read fail, the readable values are
returned with "partial": true and a "failures" list ({dpe, error, errorCode}).`,
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
      } catch (error: unknown) {
        // The outer message is often just 9399 "multiple errors (N errors total)";
        // the actual cause (e.g. 71 "DP does not exist") is in the nested details.
        const described = describeWinccoaError(error);
        const dpeArray = Array.isArray(dpe) ? dpe : [dpe];

        // A batched dpGet is atomic: one bad element fails the whole call with
        // 9399 "multiple errors" and no values at all, so a caller reading ten
        // datapoints loses the nine that were fine and is not told which one
        // broke. The nested errors do name the offender, but only inside their
        // message text.
        //
        // On a multi-element read, retry each element on its own. That yields the
        // values that are readable plus an exact per-element error, and it only
        // costs extra calls on the failure path.
        if (dpeArray.length > 1) {
          log.warn(`Batched read of ${dpeArray.length} elements failed, retrying individually: ${described.message}`);

          const values: any[] = [];
          const failures: Array<{ dpe: string; error: string; errorCode?: number }> = [];

          for (const one of dpeArray) {
            try {
              const single = await winccoa.dpGet([one + ':_online.._value', one + ':_original.._stime']);
              values.push({
                dpe: one,
                value: (single as any[])[0],
                timestamp: (single as any[])[1],
                unit: winccoa.dpGetUnit(one)
              });
            } catch (singleError: unknown) {
              const singleFailure = describeWinccoaError(singleError);
              failures.push({
                dpe: one,
                error: singleFailure.message,
                ...(singleFailure.code !== undefined ? { errorCode: singleFailure.code } : {})
              });
            }
          }

          // Every element failed - nothing partial to report.
          if (values.length === 0) {
            const codes = new Set(failures.map(f => f.errorCode));
            const sharedCode = codes.size === 1 ? [...codes][0] : undefined;
            return createErrorResponse(
              `Failed to get values for all ${dpeArray.length} datapoint element(s): ` +
                failures.map(f => `${f.dpe} (${f.error})`).join('; '),
              {
                // Surface a shared inner code at the top level, like the single-element branch.
                ...(sharedCode !== undefined
                  ? { errorCode: sharedCode, errorType: sharedCode === 71 ? 'DP_NOT_EXIST' : 'ALL_DPE_FAILED' }
                  : { errorType: 'ALL_DPE_FAILED' }),
                failures
              }
            );
          }

          log.info(
            `Got values for ${values.length} of ${dpeArray.length} datapoint(s); ` +
              `${failures.length} failed: ${failures.map(f => f.dpe).join(', ')}`
          );

          return createSuccessResponse({
            values,
            failures,
            partial: true,
            message:
              `Returned ${values.length} of ${dpeArray.length} requested element(s). ` +
              `Failed: ${failures.map(f => `${f.dpe} - ${f.error}`).join('; ')}`
          });
        }

        console.error(`Error getting values: ${described.message}`);

        // Handle WinCC OA specific errors
        if (described.code === 71) {
          return createErrorResponse(
            `Datapoint does not exist. Please check the datapoint names. Error: ${described.message}`,
            {
              errorCode: described.code,
              errorType: 'DP_NOT_EXIST',
              details: described.details
            }
          );
        }

        return createErrorResponse(`Failed to get values: ${described.message}`, {
          errorCode: described.code,
          details: described.details
        });
      }
    }
  );

  return 3; // Number of tools registered
}

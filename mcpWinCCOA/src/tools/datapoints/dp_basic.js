import { z } from 'zod';
import { mkTypesContent, addFullPathAndUnitToChildren, createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

/**
 * Register basic datapoint tools (get-dpTypes, get-datapoints, get-value)
 * @param {McpServer} server - MCP server instance
 * @param {Object} context - Server context with winccoa, configs, etc.
 * @returns {number} Number of tools registered
 */
export function registerTools(server, context) {
  const { winccoa } = context;

  server.tool("get-dpTypes", "Get datapoint types", {
    pattern: z.string().optional(),
    systemId: z.number().optional(),
    withInternals: z.boolean().optional(),
    includeEmpty: z.boolean().optional(),
  }, async ({ pattern, systemId, withInternals, includeEmpty }) => {
    try {
      console.log('Getting datapoint types');
      const types = winccoa.dpTypes(pattern, systemId, includeEmpty);
      console.log(`Found ${types.length} datapoint types`);
      return { content: mkTypesContent(types, withInternals) };
    } catch (error) {
      console.error('Error getting datapoint types:', error);
      return createErrorResponse(`Failed to get datapoint types: ${error.message}`);
    }
  });

  server.tool("get-datapoints", `Search and return datapoint names from WinCC OA by pattern and type. 
    For each match, provides the datapoint's type, description, and full structure including children fields with
     their full path and engineering unit metadata. 
    Supports wildcard pattern and case-insensitive search.`, {
    dpNamePattern: z.string().optional(),
    dpType: z.string().optional(),
    ignoreCase: z.boolean().optional(),
  }, async ({ dpNamePattern, type, ignoreCase }) => {
    try {
      const pattern = (dpNamePattern && dpNamePattern.length > 0) ? dpNamePattern : '*';
      const dps = winccoa.dpNames(pattern, type, ignoreCase);

      const results = [];
      for (const name of dps) {
        const dp = {};
        dp.name = name;
        dp.type = winccoa.dpTypeName(name);
        dp.description = winccoa.dpGetDescription(name);
        dp.structure = winccoa.dpTypeGet(dp.type);
        addFullPathAndUnitToChildren(dp.structure.children, name, winccoa);
        results.push({ type: "text", text: JSON.stringify(dp) });
      }

      console.log(`Found ${results.length} datapoints matching pattern '${pattern}'`);
      return { content: results };
    } catch (error) {
      console.error('Error getting datapoints:', error);
      return createErrorResponse(`Failed to get datapoints: ${error.message}`);
    }
  });

  server.tool("get-value", "Get value of a datapoint element", {
    dpe: z.string(),
  }, async ({ dpe }) => {
    try {
      const dpes = [dpe + ':_online.._value', dpe + ':_original.._stime'];
      const values = await winccoa.dpGet(dpes);

      const result = {
        value: values[0],
        timestamp: values[1],
        unit: winccoa.dpGetUnit(dpe)
      };

      console.log(`Got value for ${dpe}:`, result);
      return createSuccessResponse(result);
    } catch (error) {
      console.error(`Error getting value for ${dpe}:`, error);
      return createErrorResponse(`Failed to get value for ${dpe}: ${error.message}`);
    }
  });

  return 3; // Number of tools registered
}

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

/**
 * Register datapoint set tools
 * @param {McpServer} server - MCP server instance
 * @param {Object} context - Server context with winccoa, configs, etc.
 * @returns {number} Number of tools registered
 */
export function registerTools(server, context) {
  const { winccoa } = context;
  
  server.tool("dp-set", `Set value of datapoint element(s) in WinCC OA.
    
    For a single datapoint: pass as object with dpeName and value
    For multiple datapoints: pass as array of objects with dpeName and value
    
    Example single: { dpeName: 'System1:Pump.cmd.start', value: true }
    Example multiple: [{ dpeName: 'System1:Pump.cmd.start', value: true }, { dpeName: 'System1:Valve.cmd.open', value: 50 }]
    
    CAUTION: This operation directly controls real industrial equipment. Use with care in production environments.
    `, {
    datapoints: z.union([
      z.object({
        dpeName: z.string(),
        value: z.any()
      }),
      z.array(z.object({
        dpeName: z.string(),
        value: z.any()
      }))
    ]),
  }, async ({ datapoints }) => {
    try {
      const dpArray = Array.isArray(datapoints) ? datapoints : [datapoints];
      const results = {};
      
      for (const dp of dpArray) {
        try {
          console.log(`🔄 Setting ${dp.dpeName} = ${dp.value}`);
          const result = winccoa.dpSet(dp.dpeName, dp.value);
          results[dp.dpeName] = { success: true, result };
        } catch (error) {
          console.error(`❌ Error setting ${dp.dpeName}:`, error.message);
          results[dp.dpeName] = { success: false, error: error.message };
        }
      }
      
      return createSuccessResponse(results);
      
    } catch (error) {
      console.error(`Error in dp-set:`, error);
      return createErrorResponse(`Failed to set datapoints: ${error.message}`);
    }
  });

  return 1; // Number of tools registered
}
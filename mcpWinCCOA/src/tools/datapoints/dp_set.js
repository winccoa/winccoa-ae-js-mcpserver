import { z } from 'zod';
import { validateDatapointAccess, shouldLogOperation } from '../../utils/validation.js';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';

/**
 * Register datapoint set tools with field validation
 * @param {McpServer} server - MCP server instance
 * @param {Object} context - Server context with winccoa, configs, etc.
 * @returns {number} Number of tools registered
 */
export function registerTools(server, context) {
  const { winccoa } = context;
  
  server.tool("dp-set", `Set value of datapoint element. 
    This tool respects field-specific rules and validations.
    Check the active field configuration using the field://active-instructions resource.
    `, {
    dpeName: z.string(),
    value: z.any(),
  }, async ({ dpeName, value }) => {
    try {
      // Validate datapoint access against field rules
      const validation = validateDatapointAccess(dpeName, context);
      
      if (validation.error) {
        console.warn(`Access denied for ${dpeName}: ${validation.error}`);
        return createErrorResponse(validation.error, 'ACCESS_DENIED');
      }
      
      // Execute the set operation
      const result = winccoa.dpSet(dpeName, value);
      
      // Log if it's a critical operation
      if (shouldLogOperation(dpeName, context)) {
        console.log(`CRITICAL OPERATION: Set ${dpeName} = ${value} (Result: ${JSON.stringify(result)})`);
      }
      
      // Prepare response
      let responseMessage = `Successfully set ${dpeName} = ${value}`;
      if (validation.warning) {
        responseMessage = `${validation.warning}\n\nOperation completed: ${JSON.stringify(result)}`;
      }
      
      return createSuccessResponse(result, responseMessage);
      
    } catch (error) {
      console.error(`Error setting ${dpeName}:`, error);
      return createErrorResponse(`Failed to set ${dpeName}: ${error.message}`, 'SET_FAILED');
    }
  });

  return 1; // Number of tools registered
}
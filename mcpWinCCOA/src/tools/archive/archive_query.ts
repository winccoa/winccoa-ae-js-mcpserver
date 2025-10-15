/**
 * Archive Query Tool
 *
 * MCP tool for querying historical archived data from datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Archive query request
 */
interface ArchiveQueryRequest {
  /** Datapoint element(s) to query (e.g., 'System1:MyTag.' or ['System1:Tag1.', 'System1:Tag2.']) */
  dpe: string | string[];
  /** Start time of query period (ISO 8601 format: "2024-01-01T00:00:00Z") */
  startTime: string;
  /** End time of query period (ISO 8601 format: "2024-12-31T23:59:59Z") */
  endTime: string;
  /** Optional: Number of values before startTime and after endTime to include */
  count?: number;
}

/**
 * Query archived data for datapoint elements using dpGetPeriodSplit
 */
async function queryArchiveData(
  winccoa: any,
  dpe: string | string[],
  startTime: string,
  endTime: string,
  count: number = 0
): Promise<any> {
  console.log(`Querying archive data for ${Array.isArray(dpe) ? dpe.length : 1} datapoint(s)`);
  console.log(`Time range: ${startTime} to ${endTime}`);

  // Parse time strings to Date objects
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Validate dates
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start time: ${startTime}. Use ISO 8601 format (e.g., "2024-01-01T00:00:00Z")`);
  }
  if (isNaN(end.getTime())) {
    throw new Error(`Invalid end time: ${endTime}. Use ISO 8601 format (e.g., "2024-12-31T23:59:59Z")`);
  }
  if (start >= end) {
    throw new Error('Start time must be before end time');
  }

  // Convert to array for processing
  const dpeArray = Array.isArray(dpe) ? dpe : [dpe];

  // Validate that all DPEs exist
  for (const d of dpeArray) {
    if (!winccoa.dpExists(d)) {
      throw new Error(`DPE ${d} does not exist in the system`);
    }
  }

  // First call to dpGetPeriodSplit
  console.log('Starting archive query (chunked retrieval)...');
  let result = await winccoa.dpGetPeriodSplit(start, end, dpeArray, count);

  // Accumulate all data chunks
  const allData: any[] = [];

  // Add first chunk
  if (result.data && result.data.length > 0) {
    allData.push(...result.data);
  }

  console.log(`Progress: ${result.progress}%`);

  // Loop until all data is retrieved (progress reaches 100%)
  while (result.progress !== 100) {
    result = await winccoa.dpGetPeriodSplit(result.id);

    if (result.data && result.data.length > 0) {
      allData.push(...result.data);
    }

    console.log(`Progress: ${result.progress}%`);
  }

  console.log(`✓ Archive query complete. Retrieved data for ${allData.length} datapoint(s)`);

  // Format results for each DPE
  const results = allData.map((dpeData: any, index: number) => {
    const values = dpeData.values || [];
    const timestamps = dpeData.times || [];

    return {
      dpe: dpeArray[index],
      values: values,
      timestamps: timestamps.map((t: any) => t instanceof Date ? t.toISOString() : t),
      count: values.length
    };
  });

  // Calculate total values across all DPEs
  const totalValues = results.reduce((sum: number, r: any) => sum + r.count, 0);

  return {
    results: Array.isArray(dpe) ? results : results[0],
    metadata: {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      totalDatapoints: dpeArray.length,
      totalValues: totalValues
    }
  };
}

/**
 * Register archive query tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "archive-query",
    `Query historical archived data from WinCC OA datapoint elements.

    Uses chunked retrieval (dpGetPeriodSplit) to handle large datasets without timeouts.
    Returns values with timestamps for the specified time period.

    Time Format: ISO 8601 strings (e.g., "2024-01-01T00:00:00Z")
    Supports: Single DPE or multiple DPEs (array)

    Examples:

    Single datapoint query:
    {
      "dpe": "System1:Temperature.",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-01-31T23:59:59Z"
    }

    Multiple datapoints:
    {
      "dpe": ["System1:Temperature.", "System1:Pressure."],
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-01-31T23:59:59Z"
    }

    With context values (values before/after period):
    {
      "dpe": "System1:Temperature.",
      "startTime": "2024-01-01T00:00:00Z",
      "endTime": "2024-01-31T23:59:59Z",
      "count": 5
    }

    NOTE: Datapoint must have archive configuration enabled (use archive-set tool).
    Returns empty values array if no archived data exists for the period.
    `,
    {
      config: z.union([
        z.object({
          dpe: z.union([z.string(), z.array(z.string())]).describe('Datapoint element(s) to query'),
          startTime: z.string().describe('Start time (ISO 8601: "2024-01-01T00:00:00Z")'),
          endTime: z.string().describe('End time (ISO 8601: "2024-12-31T23:59:59Z")'),
          count: z.number().optional().describe('Optional: Extra values before/after period (default: 0)')
        }),
        z.string()
      ])
    },
    async ({ config }: { config: ArchiveQueryRequest | string }) => {
      try {
        // Parse string if needed
        let parsedConfig: ArchiveQueryRequest = typeof config === 'string' ? JSON.parse(config) : config;

        console.log('========================================');
        console.log('Querying Archive Data');
        console.log('========================================');
        console.log(`DPE(s): ${Array.isArray(parsedConfig.dpe) ? parsedConfig.dpe.join(', ') : parsedConfig.dpe}`);
        console.log(`Period: ${parsedConfig.startTime} to ${parsedConfig.endTime}`);

        const result = await queryArchiveData(
          winccoa,
          parsedConfig.dpe,
          parsedConfig.startTime,
          parsedConfig.endTime,
          parsedConfig.count || 0
        );

        console.log('========================================');
        console.log('✓ Archive Query Complete');
        console.log('========================================');

        return createSuccessResponse(result);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Archive Query Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to query archive data: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}

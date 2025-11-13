/**
 * Alarm Set Tool
 *
 * MCP tool for creating and updating alarm configurations on datapoint elements.
 */

import { z } from 'zod';
import { createSuccessResponse, createErrorResponse } from '../../utils/helpers.js';
import { DpConfigType, DpeType, DpAlertRangeType } from '../../types/winccoa/constants.js';
import type { ServerContext } from '../../types/index.js';

/**
 * Alarm Direction
 */
enum AlarmDirection {
  /** Ascending: Higher values trigger higher severity alarms */
  ASC = 'ASC',
  /** Descending: Lower values trigger higher severity alarms */
  DESC = 'DESC'
}

/**
 * Default alarm classes
 */
const DEFAULT_ALARM_CLASSES = {
  ASC: ['information.', 'warning.', 'alert.'],
  DESC: ['alert.', 'warning.', 'information.']
};

/**
 * Alarm configuration request
 */
interface AlarmConfigRequest {
  /** Datapoint element (e.g., 'System1:MyTag.') */
  dpe: string;
  /** Direction: ASC or DESC */
  direction: AlarmDirection;
  /** Thresholds for analog alarms (1-3 values) */
  thresholds?: number[];
  /** Custom alarm classes (optional, uses defaults if not provided) */
  alarmClasses?: string[];
  /** Force update even if alert already exists */
  force?: boolean;
}

/**
 * Get min/max values for a datapoint element type
 */
function getMinMaxForType(dpeType: number): [number, number] {
  switch (dpeType) {
    case DpeType.DPEL_CHAR:
      return [-128, 127];
    case DpeType.DPEL_INT:
      return [-32768, 32767];
    case DpeType.DPEL_UINT:
      return [0, 65535];
    case DpeType.DPEL_LONG:
      return [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]; // -9007199254740991 to 9007199254740991
    case DpeType.DPEL_ULONG:
      return [0, Number.MAX_SAFE_INTEGER]; // 0 to 9007199254740991
    case DpeType.DPEL_FLOAT:
      return [-3.4e38, 3.4e38];
    default:
      return [-3.4e38, 3.4e38];
  }
}

/**
 * Configure a binary alert (for BOOL datapoint elements)
 */
async function configureBinaryAlert(
  winccoa: any,
  dpe: string,
  direction: AlarmDirection,
  alarmClass: string = 'alert.'
): Promise<void> {
  console.log(`🔔 Configuring binary alert for ${dpe}, direction: ${direction}`);

  // ok_range: TRUE when DESC (alarm on FALSE), FALSE when ASC (alarm on TRUE)
  const okRange = direction === AlarmDirection.DESC;

  await winccoa.dpSetWait(
    [
      `${dpe}:_alert_hdl.._type`,
      `${dpe}:_alert_hdl.._class`,
      `${dpe}:_alert_hdl.._ok_range`,
      `${dpe}:_alert_hdl.._active`
    ],
    [
      DpConfigType.DPCONFIG_ALERT_BINARYSIGNAL,
      alarmClass,
      okRange,
      true
    ]
  );

  console.log(`✓ Binary alert configured for ${dpe}`);
}

/**
 * Configure an analog alert (for numeric datapoint elements)
 */
async function configureAnalogAlert(
  winccoa: any,
  dpe: string,
  thresholds: number[],
  dpeType: number,
  direction: AlarmDirection,
  alarmClasses?: string[]
): Promise<void> {
  console.log(`🔔 Configuring analog alert for ${dpe}, thresholds: ${thresholds.join(', ')}, direction: ${direction}`);

  // Validate thresholds
  if (!thresholds || thresholds.length === 0) {
    throw new Error(`No thresholds defined for ${dpe}`);
  }

  if (thresholds.length > 3) {
    throw new Error(`Maximum 3 thresholds allowed, got ${thresholds.length}`);
  }

  // Sort thresholds in ascending order
  const sortedThresholds = [...thresholds].sort((a, b) => a - b);

  // Use custom or default alarm classes
  const classes = alarmClasses || DEFAULT_ALARM_CLASSES[direction];

  // Get min/max values for the datapoint type
  const [minValue, maxValue] = getMinMaxForType(dpeType);

  // Create the alert configuration
  await winccoa.dpSetWait(
    [
      `${dpe}:_alert_hdl.._type`,
      `${dpe}:_alert_hdl.._orig_hdl`
    ],
    [
      DpConfigType.DPCONFIG_ALERT_NONBINARYSIGNAL,
      false
    ]
  );

  // Create ranges (n thresholds = n+1 ranges)
  const dpes: string[] = [];
  const values: any[] = [];

  for (let i = 1; i <= sortedThresholds.length + 1; i++) {
    // Range Type
    dpes.push(`${dpe}:_alert_hdl.${i}._type`);
    values.push(DpAlertRangeType.DPDETAIL_RANGETYPE_MINMAX);

    // Lower Limit
    dpes.push(`${dpe}:_alert_hdl.${i}._l_limit`);
    values.push(i === 1 ? minValue : sortedThresholds[i - 2]);

    // Upper Limit
    dpes.push(`${dpe}:_alert_hdl.${i}._u_limit`);
    values.push(i > sortedThresholds.length ? maxValue : sortedThresholds[i - 1]);

    // ASC Direction
    if (direction === AlarmDirection.ASC) {
      dpes.push(`${dpe}:_alert_hdl.${i}._l_incl`);
      values.push(true);

      dpes.push(`${dpe}:_alert_hdl.${i}._u_incl`);
      values.push(i <= sortedThresholds.length ? false : true);

      // Alarm class (not for first range in ASC)
      if (i > 1) {
        dpes.push(`${dpe}:_alert_hdl.${i}._class`);

        // Select the appropriate alarm class based on number of thresholds
        let classIndex: number;
        switch (sortedThresholds.length) {
          case 3:
            classIndex = i - 2; // 0, 1, 2
            break;
          case 2:
            classIndex = i - 1; // 1, 2
            break;
          case 1:
            classIndex = 2; // alert
            break;
          default:
            classIndex = 2;
        }
        values.push(classes[classIndex] || classes[classes.length - 1]);
      }
    }
    // DESC Direction
    else {
      dpes.push(`${dpe}:_alert_hdl.${i}._l_incl`);
      values.push(i === 1 ? true : false);

      dpes.push(`${dpe}:_alert_hdl.${i}._u_incl`);
      values.push(true);

      // Alarm class (not for last range in DESC)
      if (i <= sortedThresholds.length) {
        dpes.push(`${dpe}:_alert_hdl.${i}._class`);

        // Select the appropriate alarm class
        let classIndex: number;
        switch (sortedThresholds.length) {
          case 1:
            classIndex = 0; // alert
            break;
          case 2:
          case 3:
            classIndex = i - 1; // 0, 1, 2
            break;
          default:
            classIndex = 0;
        }
        values.push(classes[classIndex] || classes[0]);
      }
    }
  }

  // Set all parameters
  await winccoa.dpSetWait(dpes, values);

  // Activate the alert configuration
  await winccoa.dpSetWait(`${dpe}:_alert_hdl.._active`, true);

  console.log(`✓ Analog alert configured for ${dpe}`);
}

/**
 * Check if an alert configuration exists
 */
async function hasAlertConfig(winccoa: any, dpe: string): Promise<boolean> {
  try {
    const alertType = await winccoa.dpGet(`${dpe}:_alert_hdl.._type`);
    return alertType !== DpConfigType.DPCONFIG_NONE && alertType !== null && alertType !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Deactivate an existing alert configuration
 */
async function deactivateAlert(winccoa: any, dpe: string): Promise<void> {
  try {
    await winccoa.dpSetWait(`${dpe}:_alert_hdl.._active`, false);
  } catch (error) {
    console.error(`Error deactivating alert for ${dpe}:`, error);
  }
}

/**
 * Get the datapoint element type using the official dpElementType() API
 */
function getDpeType(winccoa: any, dpe: string): number {
  try {
    // Use dpElementType() instead of dpGet() - this returns the correct WinccoaElementType
    return winccoa.dpElementType(dpe);
  } catch (error) {
    throw new Error(`Cannot determine type of DPE ${dpe}: ${error}`);
  }
}

/**
 * Register alarm set tools
 * @param server - MCP server instance
 * @param context - Server context with winccoa, configs, etc.
 * @returns Number of tools registered
 */
export function registerTools(server: any, context: ServerContext): number {
  const { winccoa } = context;

  server.tool(
    "alarm-set",
    `Set or update alarm configuration for a datapoint element in WinCC OA.

    Supports both binary alarms (for BOOL datapoints) and analog alarms (for numeric datapoints).

    Binary alarm: Triggers when the value is TRUE (ASC) or FALSE (DESC)
    Analog alarm: Triggers based on threshold values (1-3 thresholds)

    Default alarm classes:
    - ASC (ascending): ['information.', 'warning.', 'alert.']
    - DESC (descending): ['alert.', 'warning.', 'information.']

    Custom alarm classes can be provided via the alarmClasses parameter.

    Examples:

    Binary alarm (ASC):
    {
      "dpe": "System1:MyBoolTag.",
      "direction": "ASC"
    }

    Analog alarm with 1 threshold:
    {
      "dpe": "System1:Temperature.",
      "direction": "ASC",
      "thresholds": [80]
    }

    Analog alarm with 3 thresholds:
    {
      "dpe": "System1:Pressure.",
      "direction": "ASC",
      "thresholds": [50, 75, 90]
    }

    With custom alarm classes:
    {
      "dpe": "System1:Level.",
      "direction": "DESC",
      "thresholds": [20, 10],
      "alarmClasses": ["low.", "critical.", "emergency."]
    }

    CAUTION: Alarm configurations directly affect production monitoring. Use with care.
    `,
    {
      config: z.union([
        z.object({
          dpe: z.string().describe('Datapoint element name (e.g., System1:MyTag.)'),
          direction: z.enum(['ASC', 'DESC']).describe('Alarm direction: ASC (ascending) or DESC (descending)'),
          thresholds: z.array(z.number()).optional().describe('Thresholds for analog alarms (1-3 values)'),
          alarmClasses: z.array(z.string()).optional().describe('Custom alarm classes (optional)'),
          force: z.boolean().optional().describe('Force update even if alert exists')
        }),
        z.string()
      ])
    },
    async ({ config }: { config: AlarmConfigRequest | string }) => {
      try {
        // Parse string if needed
        let parsedConfig: AlarmConfigRequest = typeof config === 'string' ? JSON.parse(config) : config;

        console.log('========================================');
        console.log('Setting Alarm Configuration');
        console.log('========================================');
        console.log(`DPE: ${parsedConfig.dpe}`);

        // Check if DPE exists
        if (!winccoa.dpExists(parsedConfig.dpe)) {
          throw new Error(`DPE ${parsedConfig.dpe} does not exist in the system`);
        }

        // Get DPE type
        const dpeType = getDpeType(winccoa, parsedConfig.dpe);
        console.log(`DPE Type: ${dpeType}`);

        // Check if alert configuration already exists
        const hasConfig = await hasAlertConfig(winccoa, parsedConfig.dpe);
        if (hasConfig && !parsedConfig.force) {
          return createErrorResponse(
            `Alert configuration already exists for ${parsedConfig.dpe}. Use force: true to overwrite.`
          );
        }

        // Deactivate existing configuration if exists
        if (hasConfig) {
          await deactivateAlert(winccoa, parsedConfig.dpe);
        }

        // Binary alarm (BOOL)
        if (dpeType === DpeType.DPEL_BOOL) {
          const alarmClass = parsedConfig.alarmClasses ? parsedConfig.alarmClasses[0] : 'alert.';
          await configureBinaryAlert(winccoa, parsedConfig.dpe, parsedConfig.direction, alarmClass);
        }
        // Analog alarm (numeric)
        else if ([
          DpeType.DPEL_CHAR,
          DpeType.DPEL_INT,
          DpeType.DPEL_UINT,
          DpeType.DPEL_LONG,
          DpeType.DPEL_ULONG,
          DpeType.DPEL_FLOAT
        ].includes(dpeType)) {
          if (!parsedConfig.thresholds || parsedConfig.thresholds.length === 0) {
            throw new Error('Thresholds are required for analog alarms');
          }
          await configureAnalogAlert(
            winccoa,
            parsedConfig.dpe,
            parsedConfig.thresholds,
            dpeType,
            parsedConfig.direction,
            parsedConfig.alarmClasses
          );
        }
        else {
          throw new Error(`Unsupported DPE type: ${dpeType}. Supported types are: BOOL (23), CHAR (19), INT (21), UINT (20), LONG (54), ULONG (58), FLOAT (22)`);
        }

        console.log('========================================');
        console.log('✓ Alarm Configuration Complete');
        console.log('========================================');

        return createSuccessResponse({
          dpe: parsedConfig.dpe,
          message: 'Alarm configuration set successfully',
          direction: parsedConfig.direction,
          thresholds: parsedConfig.thresholds || null,
          alarmClasses: parsedConfig.alarmClasses || DEFAULT_ALARM_CLASSES[parsedConfig.direction]
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('========================================');
        console.error('✗ Alarm Configuration Failed');
        console.error('========================================');
        console.error(`Error: ${errorMessage}`);

        return createErrorResponse(`Failed to set alarm configuration: ${errorMessage}`);
      }
    }
  );

  return 1; // Number of tools registered
}

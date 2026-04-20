/**
 * S7Plus Connection Manager
 *
 * Provides functionality to create, configure, and manage S7Plus connections in WinCC OA.
 * Based on WinCC OA _S7PlusConnection internal datapoint structure.
 *
 * The S7Plus driver communicates with Siemens S7-1200, S7-1500, S7-1500 Software Controller,
 * and PLCSim devices using modern symbolic addressing.
 */

import { BaseConnection } from './BaseConnection.js';
import { PmonClient } from '../pmon/PmonClient.js';
import { ManagerState } from '../../types/pmon/protocol.js';
import type {
  S7PlusConnectionConfig,
  S7PlusAddressParams,
  S7PlusBrowseNode,
  S7PlusBrowseResult
} from '../../types/index.js';
import {
  S7PlusPlcType,
  S7PlusConnType,
  S7PlusConnectionState,
  S7PlusEstablishmentMode,
  S7PlusTimeSyncMode,
  S7PlusSwitchCondition,
  S7PlusTransformation,
  S7PlusAddressDirection,
  S7PLUS_DEFAULTS
} from '../../types/index.js';
import { DpConfigType, DpAddressDirection } from '../../types/index.js';

// Re-export for convenience
export {
  S7PlusPlcType,
  S7PlusConnType,
  S7PlusConnectionState,
  S7PlusEstablishmentMode,
  S7PlusTimeSyncMode,
  S7PlusSwitchCondition,
  S7PlusTransformation,
  S7PlusAddressDirection,
  S7PLUS_DEFAULTS
} from '../../types/index.js';

/**
 * S7Plus Connection Manager Class
 *
 * Extends BaseConnection with S7Plus-specific functionality.
 */
export class S7PlusConnection extends BaseConnection {

  constructor(winccoa?: any) {
    super(winccoa);
  }

  /**
   * Browse operation timeout in milliseconds
   * Prevents indefinite hangs on problematic browse operations
   */
  private readonly BROWSE_TIMEOUT_MS = 60000; // 60 seconds

  /**
   * Maximum number of nodes to return per browse request
   * Protects against context window overflow on client side
   */
  private readonly MAX_NODE_COUNT = 800;

  /**
   * Generate a unique connection name for S7Plus
   * @returns Connection name in format _S7PlusConnection<n>
   */
  async generateConnectionName(): Promise<string> {
    return super.generateConnectionName('_S7PlusConnection');
  }

  /**
   * Get available S7Plus driver numbers from Pmon
   * @returns Array of S7Plus driver numbers, sorted ascending
   */
  async getS7PlusDriverNumbers(): Promise<number[]> {
    try {
      const pmonClient = new PmonClient();
      const managerList = await pmonClient.getManagerList();

      const driverNums: number[] = [];

      for (const mgr of managerList) {
        // Check if this is an S7Plus driver (name contains 's7plus', case insensitive)
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        if (mgrName.includes('s7plus')) {
          // Extract -num from command line options
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          const drvNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;
          driverNums.push(drvNum);
        }
      }

      // Sort ascending and return
      return driverNums.sort((a, b) => a - b);
    } catch (error) {
      console.warn('Could not get S7Plus driver numbers from Pmon:', error);
      return [];
    }
  }

  /**
   * Get all used driver numbers (S7Plus, simulation, other drivers)
   * @returns Array of used driver numbers
   */
  async getUsedDriverNumbers(): Promise<number[]> {
    try {
      const pmonClient = new PmonClient();
      const managerList = await pmonClient.getManagerList();

      const usedNums: number[] = [];

      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        // Check for any driver type (sim, drv, mqtt, s7plus, opcua, etc.)
        if (mgrName.includes('sim') || mgrName.includes('drv') ||
            mgrName.includes('mqtt') || mgrName.includes('s7plus') ||
            mgrName.includes('opcua')) {
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          // If no -num specified, driver uses 1 by default
          const drvNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;
          if (!usedNums.includes(drvNum)) {
            usedNums.push(drvNum);
          }
        }
      }

      return usedNums.sort((a, b) => a - b);
    } catch (error) {
      console.warn('Could not get used driver numbers from Pmon:', error);
      return [];
    }
  }

  /**
   * Get the lowest available S7Plus driver number (avoiding conflicts)
   * @returns Lowest available driver number for S7Plus
   */
  async getDefaultS7PlusDriverNumber(): Promise<number> {
    const s7plusNums = await this.getS7PlusDriverNumbers();

    // If S7Plus drivers exist, use the lowest one
    if (s7plusNums.length > 0) {
      return s7plusNums[0]!;
    }

    // No S7Plus driver yet - find a free number avoiding conflicts
    const usedNums = await this.getUsedDriverNumbers();

    // Start at 1, find first unused number
    let candidate = 1;
    while (usedNums.includes(candidate) && candidate < 100) {
      candidate++;
    }

    return candidate;
  }

  /**
   * Ensure an S7Plus driver is available for the specified number.
   * Prefers existing S7Plus drivers over creating new ones.
   * @param managerNumber - The preferred driver number
   * @returns Object with success status, resolved driver number, and optional warnings
   */
  async ensureS7PlusDriverRunning(managerNumber: number): Promise<{
    success: boolean;
    resolvedDriverNumber?: number;
    error?: string;
    warnings?: string[];
  }> {
    const warnings: string[] = [];
    const pmonClient = new PmonClient();

    try {
      console.log(`🔍 Checking S7Plus driver with -num ${managerNumber}...`);

      // Get current manager list
      const managerList = await pmonClient.getManagerList();
      const managerStatus = await pmonClient.getManagerStatus();

      // Collect all used driver numbers (including sim drivers)
      const usedDriverNumbers: number[] = [];
      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        if (mgrName.includes('sim') || mgrName.includes('drv') ||
            mgrName.includes('mqtt') || mgrName.includes('s7plus') ||
            mgrName.includes('opcua')) {
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          const drvNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;
          usedDriverNumbers.push(drvNum);
        }
      }

      // Check if simulation driver is using this number
      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        if (mgrName.includes('sim')) {
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          const simNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;

          if (simNum === managerNumber) {
            // Find next available number
            let suggestedNum = 2;
            while (usedDriverNumbers.includes(suggestedNum) && suggestedNum < 100) {
              suggestedNum++;
            }
            return {
              success: false,
              error: `Driver number ${managerNumber} is used by simulation driver. ` +
                     `Use managerNumber: ${suggestedNum} instead.`
            };
          }
        }
      }

      // Find if S7Plus driver with this number exists
      let driverFound = false;
      let driverIndex: number | null = null;
      let driverRunning = false;

      // Collect all existing S7Plus drivers for fallback suggestions
      const existingS7PlusDrivers: Array<{ num: number; index: number; running: boolean }> = [];

      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        if (mgrName.includes('s7plus')) {
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          const drvNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;

          const statusEntry = managerStatus.managers.find(m => m.index === mgr.index);
          const isRunning = statusEntry?.state === ManagerState.Running;

          existingS7PlusDrivers.push({ num: drvNum, index: mgr.index, running: isRunning });

          if (drvNum === managerNumber) {
            driverFound = true;
            driverIndex = mgr.index;
            driverRunning = isRunning;
            console.log(`✓ Found S7Plus driver at index ${driverIndex}, running: ${driverRunning}`);
          }
        }
      }

      // If requested driver not found, prefer using an existing S7Plus driver
      if (!driverFound) {
        if (existingS7PlusDrivers.length > 0) {
          // Use the first existing S7Plus driver instead of creating a new one
          const existing = existingS7PlusDrivers[0]!;
          console.log(`⚠️  No S7Plus driver with -num ${managerNumber} found, using existing driver -num ${existing.num} instead`);
          warnings.push(
            `No S7Plus driver with -num ${managerNumber} found. ` +
            `Using existing S7Plus driver with -num ${existing.num} instead.`
          );
          // Update managerNumber to the existing driver for the caller
          // Note: The caller (addConnection) uses the returned managerNumber from config,
          // so we update driverIndex/driverRunning to point to the existing driver
          driverFound = true;
          driverIndex = existing.index;
          driverRunning = existing.running;
          // Override managerNumber to the existing driver's number
          managerNumber = existing.num;
        } else {
          // No S7Plus driver exists at all - cannot proceed
          return {
            success: false,
            error: `No S7Plus driver is running in this project. ` +
              `Please add an S7Plus driver in the WinCC OA Console first.`
          };
        }
      }

      // Start driver if not running
      if (!driverRunning && driverIndex !== null) {
        console.log(`🔧 Starting S7Plus driver at index ${driverIndex}...`);
        const startResult = await pmonClient.startManager(driverIndex);

        if (startResult.success) {
          console.log(`✅ Successfully started S7Plus driver`);
          warnings.push(`S7Plus driver at index ${driverIndex} was automatically started.`);

          // Wait a moment for driver to initialize
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          warnings.push(`Could not start S7Plus driver: ${startResult.error}. Please start manually.`);
        }
      }

      return { success: true, resolvedDriverNumber: managerNumber, warnings: warnings.length > 0 ? warnings : undefined };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error ensuring S7Plus driver:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Add a new S7Plus connection
   *
   * @param config - S7Plus connection configuration
   * @returns Object with success status, connection name, and any errors
   */
  async addConnection(config: S7PlusConnectionConfig): Promise<{
    success: boolean;
    connectionName?: string;
    error?: string;
  }> {
    try {
      // Validate IP address
      if (!config.ipAddress || !this.validateIpAddress(config.ipAddress)) {
        return { success: false, error: 'Valid IP address is required (e.g., "192.168.1.100")' };
      }

      // Validate PLC type
      const validPlcTypes = [S7PlusPlcType.Automatic, S7PlusPlcType.RH, S7PlusPlcType.RH_Single, S7PlusPlcType.S7_1200, S7PlusPlcType.S7_1500, S7PlusPlcType.S7_1500_SoftCtrl, S7PlusPlcType.PLCSim];
      if (!validPlcTypes.includes(config.plcType)) {
        return { success: false, error: `Invalid PLC type ${config.plcType}. Valid types: 1 (Automatic), 2 (R/H), 3 (R/H Single), 16 (S7-1500), 272 (S7-1200), 528 (S7-1500 SoftCtrl), 768 (PLCSim)` };
      }

      // Validate TLS: require at least one matching CA certificate in trust list
      if (config.useTls) {
        const caResult = await this.listCaCertificates();
        if (!caResult.success || !caResult.certificates || caResult.certificates.length === 0) {
          return {
            success: false,
            error: 'TLS is enabled but no CA certificates are in the trust list. ' +
              'Add the matching CA certificate of the PLC using the ' +
              "'s7plus-manage-ca-certificates' tool with action 'add' before creating a TLS connection."
          };
        }
      }

      // Validate redundancy configuration
      if (config.connType === S7PlusConnType.ReduLan && !config.reduAddress) {
        return { success: false, error: 'Redundant IP address (reduAddress) is required for ReduLan connection type' };
      }
      if (config.reduSwitchCondition === S7PlusSwitchCondition.SwitchTag && !config.reduSwitchTag) {
        return { success: false, error: 'reduSwitchTag is required when switch condition is SwitchTag (4)' };
      }

      // Determine manager number: use provided or auto-detect
      let managerNumber: number;
      if (config.managerNumber !== undefined) {
        if (!this.validateManagerNumber(config.managerNumber)) {
          return { success: false, error: 'Manager number must be between 1 and 99' };
        }
        managerNumber = config.managerNumber;
        console.log(`Using specified manager number: ${managerNumber}`);
      } else {
        managerNumber = await this.getDefaultS7PlusDriverNumber();
        console.log(`Auto-detected S7Plus driver number: ${managerNumber}`);
      }

      // Ensure S7Plus driver is available (prefers existing drivers)
      const driverResult = await this.ensureS7PlusDriverRunning(managerNumber);
      if (!driverResult.success) {
        return { success: false, error: driverResult.error };
      }
      // Use the resolved driver number (may differ from requested if an existing driver was used)
      managerNumber = driverResult.resolvedDriverNumber ?? managerNumber;
      if (driverResult.warnings) {
        driverResult.warnings.forEach(w => console.log(`⚠️  ${w}`));
      }

      // Generate unique connection name
      const connectionName = await this.generateConnectionName();

      // Create the connection datapoint
      const dpCreated = await this.ensureConnectionDpExists(connectionName, '_S7PlusConnection');
      if (!dpCreated) {
        return { success: false, error: `Failed to create connection datapoint ${connectionName}` };
      }

      // Apply default values
      const accessPoint = config.accessPoint ?? S7PLUS_DEFAULTS.accessPoint;
      const connType = config.connType ?? S7PLUS_DEFAULTS.connType;
      const keepAlive = config.keepAliveTimeout ?? S7PLUS_DEFAULTS.keepAliveTimeout;
      const reconnect = config.reconnectTimeout ?? S7PLUS_DEFAULTS.reconnectTimeout;
      const useUtc = config.useUtc ?? S7PLUS_DEFAULTS.useUtc;
      const timezone = config.timezoneOffset ?? S7PLUS_DEFAULTS.timezoneOffset;
      const setInvalidBit = config.setInvalidBit ?? S7PLUS_DEFAULTS.setInvalidBit;
      const enableStatistics = config.enableStatistics ?? S7PLUS_DEFAULTS.enableStatistics;
      const enableDiagnostics = config.enableDiagnostics ?? S7PLUS_DEFAULTS.enableDiagnostics;
      const readOpState = config.readOpState ?? S7PLUS_DEFAULTS.readOpState;
      const acquireValues = config.acquireValuesOnConnect ?? S7PLUS_DEFAULTS.acquireValuesOnConnect;
      const timeSyncMode = config.timeSyncMode ?? S7PLUS_DEFAULTS.timeSyncMode;
      const timeSyncInterval = config.timeSyncInterval ?? S7PLUS_DEFAULTS.timeSyncInterval;
      const enableConnection = config.enableConnection ?? S7PLUS_DEFAULTS.enableConnection;
      const reduSwitchCondition = config.reduSwitchCondition ?? S7PLUS_DEFAULTS.reduSwitchCondition;
      const useTls = config.useTls ?? S7PLUS_DEFAULTS.useTls;

      // PHASE 1: Create DP with initial values
      const dpes: string[] = [
        `${connectionName}.Config.Address`,
        `${connectionName}.Config.PLCType`,
        `${connectionName}.Config.AccessPoint`,
        `${connectionName}.Config.ConnType`,
        `${connectionName}.Config.DrvNumber`,
        `${connectionName}.Config.EstablishmentMode`,
        `${connectionName}.Config.KeepAliveTimeout`,
        `${connectionName}.Config.ReconnectTimeout`,
        `${connectionName}.Config.UseUTC`,
        `${connectionName}.Config.Timezone`,
        `${connectionName}.Config.SetInvalidBit`,
        `${connectionName}.Config.EnableStatistics`,
        `${connectionName}.Config.EnableDiagnostics`,
        `${connectionName}.Config.ReadOpState`,
        `${connectionName}.Config.AcquireValuesOnConnect`,
        `${connectionName}.Config.TimeSyncMode`,
        `${connectionName}.Config.TimeSyncInterval`,
        `${connectionName}.Config.CheckConn`,
        `${connectionName}.Config.LegitimationLevel`,
        `${connectionName}.Command.Enable`,
        `${connectionName}.Command.GQ`,
        `${connectionName}.Command.IGQ`
      ];

      const values: any[] = [
        config.ipAddress,
        config.plcType,
        accessPoint,
        connType,
        managerNumber,
        0,  // EstablishmentMode: 0 initially (set to 1 in Phase 2 if enabling)
        keepAlive,
        reconnect,
        useUtc,
        timezone,
        setInvalidBit,
        enableStatistics,
        enableDiagnostics,
        readOpState,
        acquireValues,
        timeSyncMode,
        timeSyncInterval,
        false,  // CheckConn: false initially (NOT _address config!)
        useTls ? 0 : -1,  // LegitimationLevel: 0=TLS, -1=no TLS
        false,  // Command.Enable: false initially
        false,  // Command.GQ: false
        false   // Command.IGQ: false
      ];

      // Add optional fields
      if (config.stationName) {
        dpes.push(`${connectionName}.Config.StationName`);
        values.push(config.stationName);
      }

      if (config.codepage !== undefined) {
        dpes.push(`${connectionName}.Config.Codepage`);
        values.push(config.codepage);
      }

      if (config.certificate) {
        dpes.push(`${connectionName}.Config.Certificate`);
        values.push(config.certificate);
      }

      // Redundancy configuration
      if (config.reduAddress) {
        dpes.push(`${connectionName}.Config.ReduConnection.Address`);
        values.push(config.reduAddress);
      }
      if (config.reduAccessPoint) {
        dpes.push(`${connectionName}.Config.ReduConnection.AccessPoint`);
        values.push(config.reduAccessPoint);
      }
      dpes.push(`${connectionName}.Config.ReduConnection.SwitchCondition`);
      values.push(reduSwitchCondition);
      if (config.reduSwitchTag) {
        dpes.push(`${connectionName}.Config.ReduConnection.SwitchTag`);
        values.push(config.reduSwitchTag);
      }

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ Creating S7Plus Connection: ${connectionName.padEnd(34)} ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Configuration:                                                 ║`);
      console.log(`  - PLC IP: ${config.ipAddress}`);
      console.log(`  - PLC Type: ${S7PlusPlcType[config.plcType]} (${config.plcType})`);
      console.log(`  - Access Point: ${accessPoint}`);
      console.log(`  - Connection Type: ${S7PlusConnType[connType]}`);
      console.log(`  - Manager Number: ${managerNumber}`);
      console.log(`  - Keep Alive: ${keepAlive}s`);
      console.log(`  - Reconnect: ${reconnect}s`);
      console.log(`  - Use UTC: ${useUtc}`);
      console.log(`  - Enable Statistics: ${enableStatistics}`);
      console.log(`  - Enable Diagnostics: ${enableDiagnostics}`);
      console.log(`  - Read OpState: ${readOpState}`);
      console.log(`  - Time Sync: ${S7PlusTimeSyncMode[timeSyncMode]}`);
      console.log(`  - Enable Connection: ${enableConnection}`);
      if (config.reduAddress) {
        console.log(`  - Redundant IP: ${config.reduAddress}`);
        console.log(`  - Switch Condition: ${S7PlusSwitchCondition[reduSwitchCondition]}`);
      }
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Apply initial configuration (Phase 1)
      await this.winccoa.dpSetWait(dpes, values);
      console.log(`✓ Initial configuration applied`);

      // Set password if provided (separate dpSet due to blob type)
      if (config.password) {
        try {
          await this.winccoa.dpSetWait(
            [`${connectionName}.Config.Password`],
            [config.password]
          );
          console.log(`✓ Password configured`);
        } catch (e) {
          console.warn(`⚠️  Warning: Could not set password - may need manual configuration`);
        }
      }

      // PHASE 2: Always configure CheckConn _address (required for connection to work)
      // The _address config must exist regardless of whether the connection is enabled immediately.
      const checkConnSuccess = await this.setAddressAndDistribConfig(
        `${connectionName}.Config.CheckConn`,
        {
          _type: DpConfigType.DPCONFIG_PERIPH_ADDR_MAIN,
          _drv_ident: 'S7PLUS',
          _connection: connectionName,
          _reference: '__check__',
          _direction: DpAddressDirection.DPATTR_ADDR_MODE_UNDEFINED,
          _datatype: 0,
          _subindex: 0,
          _internal: true,
          _active: true
        },
        {
          _type: DpConfigType.DPCONFIG_DISTRIBUTION_INFO,
          _driver: managerNumber
        }
      );

      if (!checkConnSuccess) {
        console.warn(`⚠️  Warning: Could not configure CheckConn address`);
      } else {
        console.log(`✓ CheckConn _distrib + _address configured`);
      }

      // PHASE 3: If enableConnection, activate the connection
      if (enableConnection) {
        // Set EstablishmentMode to 1 (auto active)
        await this.winccoa.dpSetWait(
          [`${connectionName}.Config.EstablishmentMode`],
          [S7PlusEstablishmentMode.AutomaticActive]
        );

        // Enable the connection
        await this.winccoa.dpSetWait(
          [`${connectionName}.Command.Enable`],
          [true]
        );
        console.log(`✓ Connection enabled`);
      }

      console.log(`✓ Successfully created S7Plus connection: ${connectionName}`);
      return { success: true, connectionName };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error creating S7Plus connection:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update an existing S7Plus connection's configuration.
   * Only modifies the fields that are provided - all others remain unchanged.
   * Does NOT touch CheckConn _address/_distrib or recreate the DP.
   * This preserves all existing _address configurations on datapoints.
   *
   * @param connectionName - Name of the connection to update
   * @param updates - Partial configuration with only the fields to change
   * @returns Object with success status and any errors
   */
  async updateConnection(
    connectionName: string,
    updates: Partial<S7PlusConnectionConfig>
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Normalize connection name
      let dpName = connectionName;
      if (connectionName.includes(':')) {
        // System-prefixed - use as-is
      } else if (!connectionName.startsWith('_')) {
        dpName = `_${connectionName}`;
      }

      if (!this.checkDpExists(dpName)) {
        return { success: false, error: `Connection ${dpName} does not exist` };
      }

      const dpes: string[] = [];
      const values: any[] = [];

      // Map each provided field to its DPE
      if (updates.ipAddress !== undefined) {
        dpes.push(`${dpName}.Config.Address`);
        values.push(updates.ipAddress);
      }
      if (updates.plcType !== undefined) {
        dpes.push(`${dpName}.Config.PLCType`);
        values.push(updates.plcType);
      }
      if (updates.accessPoint !== undefined) {
        dpes.push(`${dpName}.Config.AccessPoint`);
        values.push(updates.accessPoint);
      }
      if (updates.connType !== undefined) {
        dpes.push(`${dpName}.Config.ConnType`);
        values.push(updates.connType);
      }
      if (updates.keepAliveTimeout !== undefined) {
        dpes.push(`${dpName}.Config.KeepAliveTimeout`);
        values.push(updates.keepAliveTimeout);
      }
      if (updates.reconnectTimeout !== undefined) {
        dpes.push(`${dpName}.Config.ReconnectTimeout`);
        values.push(updates.reconnectTimeout);
      }
      if (updates.useUtc !== undefined) {
        dpes.push(`${dpName}.Config.UseUTC`);
        values.push(updates.useUtc);
      }
      if (updates.timezoneOffset !== undefined) {
        dpes.push(`${dpName}.Config.Timezone`);
        values.push(updates.timezoneOffset);
      }
      if (updates.setInvalidBit !== undefined) {
        dpes.push(`${dpName}.Config.SetInvalidBit`);
        values.push(updates.setInvalidBit);
      }
      if (updates.enableStatistics !== undefined) {
        dpes.push(`${dpName}.Config.EnableStatistics`);
        values.push(updates.enableStatistics);
      }
      if (updates.enableDiagnostics !== undefined) {
        dpes.push(`${dpName}.Config.EnableDiagnostics`);
        values.push(updates.enableDiagnostics);
      }
      if (updates.readOpState !== undefined) {
        dpes.push(`${dpName}.Config.ReadOpState`);
        values.push(updates.readOpState);
      }
      if (updates.acquireValuesOnConnect !== undefined) {
        dpes.push(`${dpName}.Config.AcquireValuesOnConnect`);
        values.push(updates.acquireValuesOnConnect);
      }
      if (updates.timeSyncMode !== undefined) {
        dpes.push(`${dpName}.Config.TimeSyncMode`);
        values.push(updates.timeSyncMode);
      }
      if (updates.timeSyncInterval !== undefined) {
        dpes.push(`${dpName}.Config.TimeSyncInterval`);
        values.push(updates.timeSyncInterval);
      }
      if (updates.stationName !== undefined) {
        dpes.push(`${dpName}.Config.StationName`);
        values.push(updates.stationName);
      }
      if (updates.codepage !== undefined) {
        dpes.push(`${dpName}.Config.Codepage`);
        values.push(updates.codepage);
      }
      if (updates.useTls !== undefined) {
        dpes.push(`${dpName}.Config.LegitimationLevel`);
        values.push(updates.useTls ? 0 : -1);
      }
      if (updates.certificate !== undefined) {
        dpes.push(`${dpName}.Config.Certificate`);
        values.push(updates.certificate);
      }
      // Redundancy settings
      if (updates.reduAddress !== undefined) {
        dpes.push(`${dpName}.Config.ReduConnection.Address`);
        values.push(updates.reduAddress);
      }
      if (updates.reduAccessPoint !== undefined) {
        dpes.push(`${dpName}.Config.ReduConnection.AccessPoint`);
        values.push(updates.reduAccessPoint);
      }
      if (updates.reduSwitchCondition !== undefined) {
        dpes.push(`${dpName}.Config.ReduConnection.SwitchCondition`);
        values.push(updates.reduSwitchCondition);
      }
      if (updates.reduSwitchTag !== undefined) {
        dpes.push(`${dpName}.Config.ReduConnection.SwitchTag`);
        values.push(updates.reduSwitchTag);
      }
      // EstablishmentMode if explicitly enabling
      if (updates.enableConnection) {
        dpes.push(`${dpName}.Config.EstablishmentMode`);
        values.push(S7PlusEstablishmentMode.AutomaticActive);
      }

      if (dpes.length === 0) {
        return { success: false, error: 'No fields to update provided' };
      }

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ Updating S7Plus Connection: ${dpName.padEnd(34)} ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      for (let i = 0; i < dpes.length; i++) {
        console.log(`  - ${dpes[i]} = ${JSON.stringify(values[i])}`);
      }
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Disable connection before applying changes
      await this.winccoa.dpSetWait([`${dpName}.Command.Enable`], [false]);
      console.log(`✓ Connection disabled for update`);

      await this.winccoa.dpSetWait(dpes, values);

      // Set password separately (blob type)
      if (updates.password !== undefined) {
        try {
          await this.winccoa.dpSetWait(
            [`${dpName}.Config.Password`],
            [updates.password]
          );
          console.log(`✓ Password updated`);
        } catch (e) {
          console.warn(`⚠️  Warning: Could not set password`);
        }
      }

      // Re-enable connection after update (unless explicitly disabled)
      const shouldEnable = updates.enableConnection !== false;
      await this.winccoa.dpSetWait([`${dpName}.Command.Enable`], [shouldEnable]);
      console.log(`✓ Connection ${shouldEnable ? 're-enabled' : 'remains disabled'}`);

      console.log(`✓ Successfully updated S7Plus connection: ${dpName}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error updating S7Plus connection:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete an S7Plus connection
   *
   * WARNING: Deleting a connection destroys all _address configurations on datapoints
   * that reference this connection. Use updateConnection() to change settings instead.
   *
   * @param connectionName - Name of the connection to delete (with or without leading _)
   * @returns Object with success status and any errors
   */
  async deleteConnection(connectionName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Normalize connection name: handle system-prefixed names (e.g. "System1:_S7PlusConnection1")
      let dpName = connectionName;
      if (connectionName.includes(':')) {
        // System-prefixed - use as-is
      } else if (!connectionName.startsWith('_')) {
        dpName = `_${connectionName}`;
      }

      // Check if connection exists
      if (!this.checkDpExists(dpName)) {
        return { success: false, error: `Connection ${dpName} does not exist` };
      }

      // Disable the connection first
      try {
        await this.winccoa.dpSetWait(
          [`${dpName}.Command.Enable`],
          [false]
        );
        // Small delay to allow driver to disconnect
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(`Warning: Could not disable connection before deletion`);
      }

      // Delete the datapoint
      const deleted = await this.winccoa.dpDelete(dpName);

      if (!deleted) {
        return { success: false, error: `Failed to delete connection ${dpName}` };
      }

      console.log(`✓ Successfully deleted S7Plus connection: ${dpName}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error deleting S7Plus connection:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the connection state of an S7Plus connection
   *
   * @param connectionName - Name of the connection
   * @returns Connection state or error
   */
  async getConnectionState(connectionName: string): Promise<{
    success: boolean;
    state?: S7PlusConnectionState;
    stateText?: string;
    plcType?: string;
    ipAddress?: string;
    hint?: string;
    error?: string;
  }> {
    try {
      // Normalize: handle both "S7PlusConnection1" and "_S7PlusConnection1"
      // Also handle system-prefixed names like "System1:_S7PlusConnection1"
      let dpName = connectionName;
      if (connectionName.includes(':')) {
        // System-prefixed: e.g. "System1:_S7PlusConnection1" - use as-is
      } else if (!connectionName.startsWith('_')) {
        dpName = `_${connectionName}`;
      }

      if (!this.checkDpExists(dpName)) {
        return { success: false, error: `Connection ${dpName} does not exist` };
      }

      const state = await this.winccoa.dpGet(`${dpName}.State.ConnState`) as number;

      const stateTexts: { [key: number]: string } = {
        0: 'Inactive',
        1: 'Disconnected',
        2: 'Connecting',
        3: 'Connected',
        4: 'Disconnecting',
        5: 'Failure'
      };

      // Get additional info
      let plcType: string | undefined;
      let plcTypeNum: number | undefined;
      let ipAddress: string | undefined;
      try {
        plcTypeNum = await this.winccoa.dpGet(`${dpName}.Config.PLCType`) as number;
        plcType = S7PlusPlcType[plcTypeNum] ?? `Unknown (${plcTypeNum})`;
        ipAddress = await this.winccoa.dpGet(`${dpName}.Config.Address`) as string;
      } catch {
        // Non-critical, ignore
      }

      // If connection failed and PLC type is not PLCSim, hint that it might be a PLCSim
      let hint: string | undefined;
      if (state === S7PlusConnectionState.Failure || state === S7PlusConnectionState.Disconnected) {
        if (plcTypeNum !== undefined && plcTypeNum !== S7PlusPlcType.PLCSim && plcTypeNum !== S7PlusPlcType.Automatic) {
          hint = `Connection failed with PLC type '${plcType}'. ` +
            `If you are connecting to a PLCSim, the PLC type must be set to PLCSim (${S7PlusPlcType.PLCSim}). ` +
            `Other PLC types (S7-1500, S7-1200, etc.) do not work with PLCSim.`;
        }
      }

      return {
        success: true,
        state: state as S7PlusConnectionState,
        stateText: stateTexts[state] ?? 'Unknown',
        plcType,
        ipAddress,
        hint
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * List all S7Plus connections
   *
   * @returns Array of connection names and their states
   */
  async listConnections(): Promise<{
    success: boolean;
    connections?: Array<{
      name: string;
      state: S7PlusConnectionState;
      stateText: string;
      ipAddress?: string;
      plcType?: string;
    }>;
    error?: string;
  }> {
    try {
      // Get all datapoints of type _S7PlusConnection
      const dpNames = await this.winccoa.dpNames('*', '_S7PlusConnection') as string[];

      if (!dpNames || dpNames.length === 0) {
        return { success: true, connections: [] };
      }

      const connections: Array<{
        name: string;
        state: S7PlusConnectionState;
        stateText: string;
        ipAddress?: string;
        plcType?: string;
      }> = [];

      for (const dpName of dpNames) {
        // Skip redundant partner datapoints (suffixed with "_2")
        if (dpName.endsWith('_2')) continue;

        try {
          const stateResult = await this.getConnectionState(dpName);

          connections.push({
            name: dpName,
            state: stateResult.state ?? S7PlusConnectionState.Inactive,
            stateText: stateResult.stateText ?? 'Unknown',
            ipAddress: stateResult.ipAddress,
            plcType: stateResult.plcType
          });
        } catch (e) {
          // Skip connections that can't be read
          console.warn(`Warning: Could not read connection ${dpName}`);
        }
      }

      return { success: true, connections };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if an S7Plus connection is established and ready for browsing
   * @param connDp - Connection datapoint name (with _ prefix)
   * @throws Error if connection is not established
   */
  private async checkConnectionEstablished(connDp: string): Promise<void> {
    // Check if connection datapoint exists
    const exists = this.winccoa.dpExists(connDp);
    if (!exists) {
      throw new Error(
        `S7Plus connection '${connDp}' does not exist. ` +
        `Please create the connection first using the 's7plus-add-connection' tool.`
      );
    }

    // Read connection state
    const connState = await this.winccoa.dpGet(`${connDp}.State.ConnState`) as number;

    // S7Plus connection states: 0=Inactive, 1=Disconnected, 2=Connecting, 3=Connected, 4=Disconnecting, 5=Failure
    if (connState !== S7PlusConnectionState.Connected) {
      const stateTexts: Record<number, string> = {
        0: 'Inactive',
        1: 'Disconnected',
        2: 'Connecting',
        3: 'Connected',
        4: 'Disconnecting',
        5: 'Failure'
      };

      const currentStateDesc = stateTexts[connState] ?? `Unknown (${connState})`;

      throw new Error(
        `S7Plus connection '${connDp}' is not connected.\n` +
        `Connection state (State.ConnState): ${connState} (${currentStateDesc})\n\n` +
        `Please ensure:\n` +
        `- The S7Plus connection is enabled (Command.Enable = true)\n` +
        `- The PLC is reachable at the configured IP address\n` +
        `- The S7Plus driver is running\n\n` +
        `State reference:\n` +
        `- 0 = Inactive\n` +
        `- 1 = Disconnected\n` +
        `- 2 = Connecting (please wait and retry)\n` +
        `- 3 = Connected (ready to browse)\n` +
        `- 4 = Disconnecting\n` +
        `- 5 = Failure`
      );
    }

    console.log(`Connection ${connDp} is established (State.ConnState=${connState}, Connected)`);
  }

  /**
   * Generate a unique browse request ID
   * @returns Unique request ID string
   */
  private generateBrowseRequestId(): string {
    return `s7p_browse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Browse S7Plus PLC structure (data blocks, variables, tags, types).
   *
   * The method constructs the internal StartNode path from structured parameters,
   * so the caller doesn't need to know the internal pipe-delimited format.
   *
   * Path construction examples:
   *   mode="Online"                                          → "S7Plus$Online" (list stations)
   *   mode="Online", category="All"                           → "S7Plus$Online|Online" (list everything mixed)
   *   mode="Online", category="Blocks"                       → "S7Plus$Online|Online|Blocks"
   *   mode="Online", category="Blocks", nodeName="MyDB"      → "S7Plus$Online|Online|Blocks|MyDB"
   *   mode="Online", category="Blocks", nodeName="MyDB", subPath="SubStruct" → "S7Plus$Online|Online|Blocks|MyDB|SubStruct"
   *   mode="Offline", station="PLC_1"                        → "<tiaExportName>|PLC_1"
   *   mode="Offline", station="PLC_1", category="Blocks"     → "<tiaExportName>|PLC_1|Blocks"
   *   mode="AccessPoints"                                    → "S7Plus$AccessPoints"
   *   mode="Root" or undefined                               → "" (lists TIA exports)
   *
   * @param connectionName - Name of the S7Plus connection DP
   * @param options - Browse options
   * @param options.mode - "Online" (live PLC), "Offline" (TIA export), "Root" (list exports), "AccessPoints"
   * @param options.category - "All" (everything), "Blocks", "Tags", "Types", or "Alarms" (Alarms only offline)
   * @param options.nodeName - Specific node within category (e.g., "Data_block_2", "MyUDT")
   * @param options.subPath - Deeper path within node, pipe-separated (e.g., "SubStruct" or "SubStruct|Member")
   * @param options.station - Station name for offline mode (e.g., "PLC_1")
   * @param options.offset - Pagination offset (default: 0)
   * @param options.limit - Max nodes per page (default/max: MAX_NODE_COUNT)
   * @param options.hmiFilter - "1" = only HMI-visible tags, "0" = all (default: "0")
   * @param options.browseLevel - "1" = one level (default), "0" = recursive
   * @param options.optimized - "1" = optimized result format, "0" = standard (default: "0")
   * @returns Browse result with nodes and pagination metadata
   */
  async browse(
    connectionName: string,
    options: {
      mode?: 'Online' | 'Offline' | 'Root' | 'AccessPoints';
      category?: string;
      nodeName?: string;
      subPath?: string;
      station?: string;
      offset?: number;
      limit?: number;
      hmiFilter?: string;
      browseLevel?: string;
      optimized?: string;
    } = {}
  ): Promise<S7PlusBrowseResult> {
    try {
      const {
        mode,
        category,
        nodeName,
        subPath,
        station,
        offset = 0,
        limit: limitParam,
        hmiFilter = '0',
        browseLevel = '1',
        optimized = '0'
      } = options;

      // Ensure connection name has leading underscore
      const connDp = connectionName.startsWith('_') ? connectionName : `_${connectionName}`;

      // Root, AccessPoints, and Offline modes don't require an active PLC connection.
      // - Root: lists locally available TIA Portal exports in the project directory
      // - AccessPoints: lists available network access points
      // - Offline: browses local TIA Portal export files (no network connection needed)
      // These modes only need the connection DP to exist and the S7Plus driver to be running.
      if (mode === 'Root' || mode === 'AccessPoints' || mode === 'Offline') {
        const exists = this.winccoa.dpExists(connDp);
        if (!exists) {
          throw new Error(
            `S7Plus connection '${connDp}' does not exist. ` +
            `Please create the connection first using the 's7plus-add-connection' tool.`
          );
        }
      } else {
        // Online mode requires an established connection to the PLC
        await this.checkConnectionEstablished(connDp);
      }

      // Build the full StartNode path from structured parameters
      // The client provides category/nodeName/subPath — we construct the internal pipe-delimited path
      let startPath: string;
      switch (mode) {
        case 'AccessPoints':
          startPath = 'S7Plus$AccessPoints';
          break;

        case 'Online': {
          // No category → "S7Plus$Online" (list stations, JPL_PROJECT level)
          // category="All" → "S7Plus$Online|Online" (list everything mixed, JPL_STATION level)
          // category="Blocks" → "S7Plus$Online|Online|Blocks" (JPL_BLOCKS level)
          // category="Blocks" + nodeName="MyDB" → "S7Plus$Online|Online|Blocks|MyDB" (JPL_VARS level)
          if (!category) {
            startPath = 'S7Plus$Online';
          } else {
            const parts: string[] = ['S7Plus$Online', 'Online'];
            if (category !== 'All') parts.push(category);
            if (nodeName) parts.push(nodeName);
            if (subPath) parts.push(...subPath.split('|'));
            startPath = parts.join('|');
          }
          break;
        }

        case 'Offline': {
          // Offline: read tiaExportName from Config.StationName, then build path
          // The TIA export name itself is the first segment of the path.
          // e.g., tiaExportName="MyExport", station="PLC_1" -> "MyExport|PLC_1"
          const tiaExportName = await this.winccoa.dpGet(`${connDp}.Config.StationName`) as string;
          if (!tiaExportName) {
            throw new Error(
              'Cannot browse offline: Config.StationName is empty. ' +
              'Ensure the connection was created with browseMode="Offline" and a valid tiaExportName.'
            );
          }

          // If no station is provided, the path is just the export name, which lists the stations inside.
          const parts: string[] = [tiaExportName];
          if (station) {
            parts.push(station);
            // If a station is specified, we can also add category/node/subpath
            if (category && category !== 'All') parts.push(category);
            if (nodeName) parts.push(nodeName);
            if (subPath) parts.push(...subPath.split('|'));
          }
          startPath = parts.join('|');
          break;
        }

        case 'Root':
        default:
          // Root discovery: empty StartNode lists available TIA projects/exports
          startPath = '';
          break;
      }

      // Apply pagination limits
      const pageOffset = Math.max(0, offset);
      const pageLimit = limitParam ? Math.min(limitParam, this.MAX_NODE_COUNT) : this.MAX_NODE_COUNT;

      console.log(`Browsing S7Plus connection ${connDp}, path: '${startPath || '(root)'}', offset: ${pageOffset}, limit: ${pageLimit}`);

      // Generate unique request ID
      const requestId = this.generateBrowseRequestId();

      // Perform browse operation via dpConnect + dpSetWait
      const browseResult = await new Promise<S7PlusBrowseResult>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | null = null;
        let connId: number | null = null;
        let isCompleted = false;

        // Cleanup function to avoid memory leaks
        const cleanup = () => {
          if (isCompleted) return;
          isCompleted = true;

          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (connId !== null) {
            this.winccoa.dpDisconnect(connId);
            connId = null;
          }
        };

        // Setup timeout protection
        timeoutId = setTimeout(() => {
          if (isCompleted) return;

          console.error(`Browse operation timed out after ${this.BROWSE_TIMEOUT_MS}ms`);
          cleanup();
          reject(new Error(
            `Browse operation timed out after ${this.BROWSE_TIMEOUT_MS / 1000} seconds. ` +
            `This may indicate the PLC is not reachable, the TIA project is not loaded, ` +
            `or the browse path is invalid. Check connection state and try again.`
          ));
        }, this.BROWSE_TIMEOUT_MS);

        // Callback function for dpConnect
        const browseCallback = async () => {
          try {
            if (isCompleted) return;

            console.log(`S7Plus browse callback triggered`);

            // Read all browse result values at once
            const values = await this.winccoa.dpGet([
              `${connDp}.Browse.RequestId`,
              `${connDp}.Browse.NodePaths`,
              `${connDp}.Browse.NodeComments`,
              `${connDp}.Browse.SystemTypes`,
              `${connDp}.Browse.ValueTypes`,
              `${connDp}.Browse.ItemLengths`
            ]) as any[];

            const returnedRequestId = values[0] as string;
            const nodePaths = values[1] as string[];
            const nodeComments = values[2] as string[];
            const systemTypes = values[3] as string[];
            const valueTypes = values[4] as string[];
            const itemLengths = values[5] as number[];

            // For root-level browses (Root mode, Offline without station), skip requestId matching
            // (3-entry GetBranch format doesn't return a dedicated requestId).
            // For deeper browses (including Offline with station), verify requestId.
            if (!isRootLevel) {
              if (returnedRequestId !== requestId) {
                console.log(`RequestId mismatch (got '${returnedRequestId}', expected '${requestId}'), ignoring callback`);
                return; // Not our request, ignore
              }
            }

            console.log(`Processing ${nodePaths?.length ?? 0} browse nodes`);

            // Build results
            const allResults: S7PlusBrowseNode[] = [];

            if (nodePaths && nodePaths.length > 0) {
              for (let i = 0; i < nodePaths.length; i++) {
                const path = nodePaths[i];
                if (!path || path.length === 0) continue;

                const node: S7PlusBrowseNode = {
                  path: path
                };

                // Add optional fields if available
                const comment = nodeComments?.[i];
                if (comment && comment.length > 0) {
                  node.comment = comment;
                }
                if (systemTypes?.[i] !== undefined) {
                  node.systemType = systemTypes[i];
                }
                const vType = valueTypes?.[i];
                if (vType !== undefined && vType.length > 0) {
                  node.valueType = vType;
                }
                const iLen = itemLengths?.[i];
                if (iLen !== undefined) {
                  node.itemLength = iLen;
                }

                // Determine if node has children based on systemType
                // Container types that can be browsed deeper:
                const sType = systemTypes?.[i];
                if (sType) {
                  const containerTypes = ['Station', 'Block', 'ComplexTag', 'Type'];
                  node.hasChildren = containerTypes.includes(sType);
                }

                allResults.push(node);
              }
            }

            // Apply pagination
            const totalNodes = allResults.length;
            const startIndex = pageOffset;
            const endIndex = Math.min(startIndex + pageLimit, totalNodes);
            const paginatedResults = allResults.slice(startIndex, endIndex);

            const hasMore = endIndex < totalNodes;
            const nextOffset = hasMore ? endIndex : null;
            const isPartial = hasMore;

            let warning: string | undefined;
            if (isPartial) {
              warning = `Showing nodes ${startIndex + 1}-${endIndex} of ${totalNodes} total. ` +
                `Use offset=${nextOffset} to get the next page.`;
            }

            console.log(`Browse completed: ${paginatedResults.length} nodes returned (${startIndex}-${endIndex} of ${totalNodes})`);

            cleanup();
            resolve({
              nodes: paginatedResults,
              totalNodes,
              isPartial,
              warning,
              offset: startIndex,
              limit: pageLimit,
              hasMore,
              nextOffset
            });
          } catch (error) {
            console.error('Error in S7Plus browse callback:', error);
            cleanup();
            reject(error);
          }
        };

        // Subscribe to browse result DPEs
        console.log(`[Browse] Setting up dpConnect on ${connDp}.Browse.* DPEs...`);
        connId = this.winccoa.dpConnect(
          browseCallback,
          [
            `${connDp}.Browse.NodePaths`,
            `${connDp}.Browse.NodeComments`,
            `${connDp}.Browse.SystemTypes`,
            `${connDp}.Browse.ValueTypes`,
            `${connDp}.Browse.ItemLengths`,
            `${connDp}.Browse.RequestId`
          ],
          false // Don't send initial values
        );
        console.log(`[Browse] dpConnect established, connId: ${connId}`);

        // Trigger browse request
        // S7Plus Browse.GetBranch format depends on browse depth:
        //   Root-level discovery (Root mode, or Offline without station):
        //     [RequestId, StartNode, BrowseLevel] (3 entries)
        //   All deeper browsing (Online categories/nodes, Offline with station/category/node):
        //     [RequestId, StartNode, HmiFilter, BrowseLevel, Optimized] (5 entries)
        const isRootLevel = mode === 'Root' || (mode === 'Offline' && !station);
        const getBranchValue = isRootLevel
          ? [requestId, startPath, browseLevel]
          : [requestId, startPath, hmiFilter, browseLevel, optimized];

        console.log(`[Browse] Triggering dpSetWait on ${connDp}.Browse.GetBranch`);
        console.log(`[Browse] GetBranch value (${getBranchValue.length} entries): ${JSON.stringify(getBranchValue)}`);
        console.log(`[Browse] Mode: ${mode ?? 'undefined'}, startPath: '${startPath}'`);

        this.winccoa
          .dpSetWait(`${connDp}.Browse.GetBranch`, getBranchValue)
          .then(() => {
            console.log(`[Browse] dpSetWait on GetBranch completed successfully`);
          })
          .catch((error) => {
            console.error(`[Browse] dpSetWait on GetBranch FAILED:`, error);
            cleanup();
            reject(error);
          });
      });

      return browseResult;
    } catch (error) {
      console.error('Error browsing S7Plus connection:', error);
      throw error;
    }
  }

  // ============================================================================
  // TLS / Certificate Management
  // ============================================================================

  /**
   * Add CA certificates to the S7Plus driver trust list (_S7PlusConfig.CaCertificates).
   * Skips certificates that are already in the list.
   *
   * @param certFileNames - Array of certificate file names (e.g., ['myCA.pem', 'rootCA.der'])
   * @returns Object with added/skipped counts
   */
  async addCaCertificates(certFileNames: string[]): Promise<{
    success: boolean;
    added: string[];
    alreadyPresent: string[];
    error?: string;
  }> {
    try {
      const dpeName = '_S7PlusConfig.CaCertificates';

      // Read current trust list
      const current = await this.winccoa.dpGet(dpeName) as string[];
      const trustList: string[] = Array.isArray(current) ? [...current] : [];

      const added: string[] = [];
      const alreadyPresent: string[] = [];

      for (const cert of certFileNames) {
        if (trustList.includes(cert)) {
          alreadyPresent.push(cert);
          console.log(`CA certificate '${cert}' already in trust list`);
        } else {
          trustList.push(cert);
          added.push(cert);
          console.log(`Adding CA certificate '${cert}' to trust list`);
        }
      }

      if (added.length > 0) {
        await this.winccoa.dpSetWait([dpeName], [trustList]);
        console.log(`✓ Trust list updated (${trustList.length} total certificates)`);
      }

      return { success: true, added, alreadyPresent };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error adding CA certificates:', error);
      return { success: false, added: [], alreadyPresent: [], error: errorMessage };
    }
  }

  /**
   * List all CA certificates in the S7Plus driver trust list.
   * @returns Array of certificate file names
   */
  async listCaCertificates(): Promise<{
    success: boolean;
    certificates?: string[];
    error?: string;
  }> {
    try {
      const current = await this.winccoa.dpGet('_S7PlusConfig.CaCertificates') as string[];
      return { success: true, certificates: Array.isArray(current) ? current : [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Remove CA certificates from the S7Plus driver trust list.
   * @param certFileNames - Certificate file names to remove
   */
  async removeCaCertificates(certFileNames: string[]): Promise<{
    success: boolean;
    removed: string[];
    notFound: string[];
    error?: string;
  }> {
    try {
      const dpeName = '_S7PlusConfig.CaCertificates';
      const current = await this.winccoa.dpGet(dpeName) as string[];
      let trustList: string[] = Array.isArray(current) ? [...current] : [];

      const removed: string[] = [];
      const notFound: string[] = [];

      for (const cert of certFileNames) {
        if (trustList.includes(cert)) {
          trustList = trustList.filter(c => c !== cert);
          removed.push(cert);
        } else {
          notFound.push(cert);
        }
      }

      if (removed.length > 0) {
        await this.winccoa.dpSetWait([dpeName], [trustList]);
        console.log(`✓ Removed ${removed.length} certificate(s) from trust list`);
      }

      return { success: true, removed, notFound };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, removed: [], notFound: [], error: errorMessage };
    }
  }

  // ============================================================================
  // Poll Group Management
  // ============================================================================

  /**
   * Directions that require a poll group (_PollGroup DP).
   * Both polling and subscription modes need a poll group in WinCC OA.
   */
  private static readonly DIRECTIONS_NEEDING_POLL_GROUP = new Set([
    S7PlusAddressDirection.InputSpont,     // 2 - subscription
    S7PlusAddressDirection.InputPoll,      // 4 - polling
    S7PlusAddressDirection.IOSpont,        // 6 - subscription
    S7PlusAddressDirection.IOPoll,         // 7 - polling
  ]);

  /** Check if a direction requires a poll group */
  private static needsPollGroup(direction: S7PlusAddressDirection): boolean {
    return S7PlusConnection.DIRECTIONS_NEEDING_POLL_GROUP.has(direction);
  }

  /** Check if a direction is subscription-based (vs polling-based) */
  private static isSubscriptionDirection(direction: S7PlusAddressDirection): boolean {
    return direction === S7PlusAddressDirection.InputSpont ||
           direction === S7PlusAddressDirection.IOSpont;
  }

  /**
   * Get default poll group name based on direction type
   */
  private static getDefaultPollGroupName(direction: S7PlusAddressDirection): string {
    return S7PlusConnection.isSubscriptionDirection(direction)
      ? '_S7Plus_Subscr'
      : '_S7Plus_Poll_1s';
  }

  /**
   * Ensures a poll group (_PollGroup) datapoint exists and is configured.
   * Creates it if it doesn't exist yet.
   * Both polling and subscription modes use _PollGroup DPs in WinCC OA.
   *
   * @param pollGroupName - Name of the poll group (will be prefixed with _ if needed)
   * @param pollInterval - Polling interval in ms (default: 1000)
   * @returns The normalized poll group name
   */
  private async ensurePollGroupExists(
    pollGroupName: string,
    pollInterval: number = 1000
  ): Promise<string> {
    // Normalize: ensure _ prefix (WinCC OA convention for internal DPs)
    const normalized = pollGroupName.startsWith('_')
      ? pollGroupName
      : `_${pollGroupName}`;

    // Check if already exists
    if (this.checkDpExists(normalized)) {
      console.log(`Poll group ${normalized} already exists`);
      return normalized;
    }

    // Create _PollGroup DP
    console.log(`Creating poll group ${normalized} (type: _PollGroup, interval: ${pollInterval}ms)`);
    const created = await this.winccoa.dpCreate(normalized, '_PollGroup');
    if (!created) {
      throw new Error(`Failed to create poll group ${normalized}`);
    }

    // Configure: Active + PollInterval
    await this.winccoa.dpSetWait(
      [
        `${normalized}.Active`,
        `${normalized}.PollInterval`
      ],
      [
        1,               // Active = true
        pollInterval     // Interval in ms
      ]
    );

    console.log(`✓ Poll group ${normalized} created and configured`);
    return normalized;
  }

  /**
   * Registers a subscription in the S7Plus driver config.
   * Appends the poll group to _S7PlusConfig.Subscriptions DynVars:
   *   - .Names: subscription name (= poll group name)
   *   - .Pollgroups: poll group DP name (= poll group name)
   *   - .Options: onlyChanges flag (1 or 0)
   *
   * All three DynVars must always have the same number of entries.
   * Skips registration if the poll group is already registered.
   *
   * @param pollGroupName - Normalized poll group name (with _ prefix)
   * @param onlyChanges - Report only value changes (default: true → 1)
   */
  private async registerSubscription(
    pollGroupName: string,
    onlyChanges: boolean = true
  ): Promise<void> {
    const baseDp = '_S7PlusConfig.Subscriptions';

    // Read current DynVar arrays
    const [currentNames, currentPollgroups, currentOptions] = await Promise.all([
      this.winccoa.dpGet(`${baseDp}.Names`) as Promise<string[]>,
      this.winccoa.dpGet(`${baseDp}.Pollgroups`) as Promise<string[]>,
      this.winccoa.dpGet(`${baseDp}.Options`) as Promise<number[]>,
    ]);

    // Ensure arrays (may be null/undefined if empty)
    const names: string[] = Array.isArray(currentNames) ? [...currentNames] : [];
    const pollgroups: string[] = Array.isArray(currentPollgroups) ? [...currentPollgroups] : [];
    const options: number[] = Array.isArray(currentOptions) ? [...currentOptions] : [];

    // Check if already registered (avoid duplicates)
    if (names.includes(pollGroupName)) {
      console.log(`Subscription ${pollGroupName} already registered in _S7PlusConfig`);
      return;
    }

    // Append new entry to all three arrays
    names.push(pollGroupName);
    pollgroups.push(pollGroupName);
    options.push(onlyChanges ? 1 : 0);

    console.log(`Registering subscription in _S7PlusConfig.Subscriptions:`);
    console.log(`  - Name: ${pollGroupName}`);
    console.log(`  - Pollgroup: ${pollGroupName}`);
    console.log(`  - OnlyChanges: ${onlyChanges ? 1 : 0}`);
    console.log(`  - Total subscriptions: ${names.length}`);

    // Write back atomically
    await this.winccoa.dpSetWait(
      [
        `${baseDp}.Names`,
        `${baseDp}.Pollgroups`,
        `${baseDp}.Options`,
      ],
      [
        names,
        pollgroups,
        options,
      ]
    );

    console.log(`✓ Subscription ${pollGroupName} registered in _S7PlusConfig`);
  }

  // ============================================================================
  // Address Configuration
  // ============================================================================

  /**
   * Configure address settings for a datapoint (peripheral address)
   * Implementation of abstract method from BaseConnection
   *
   * S7Plus uses symbolic PLC addresses as references.
   * Unlike MQTT, S7Plus does NOT use the _connection field.
   * The driver number determines which S7Plus driver handles the address.
   *
   * For polling directions (InputPoll=4, IOPoll=7) and subscription directions
   * (InputSpont=2, IOSpont=6), a _PollGroup datapoint is required. Both polling
   * and subscription use a poll group internally in WinCC OA.
   * If no pollGroup name is provided, a default is created automatically.
   *
   * @param params - S7Plus address parameters
   * @returns true on success
   * @throws Error with detailed message on failure
   */
  async addAddressConfig(params: S7PlusAddressParams): Promise<boolean> {
    // Validate DPE exists (use full DPE path - dpExists requires it)
    if (!this.checkDpExists(params.dpeName)) {
      throw new Error(`Datapoint element ${params.dpeName} does not exist. Please create it first.`);
    }

    // Validate driver number
    if (!this.validateManagerNumber(params.driverNumber)) {
      throw new Error('Driver number must be between 1 and 99');
    }

    // Validate reference is not empty
    if (!params.reference || params.reference.trim() === '') {
      throw new Error('Symbolic PLC address reference is required (e.g., MyDB.MyVar)');
    }

    // Strip quotes from reference (e.g., "Data_block_2".myInt → Data_block_2.myInt)
    let reference = params.reference.replace(/"/g, '');
    if (params.itemLength !== undefined && params.itemLength > 0) {
      reference = `${reference}:${params.itemLength}`;
    }

    // Transformation type (default: DEFAULT = 1001)
    const datatype = params.transformation ?? S7PlusTransformation.DEFAULT;

    // Map direction
    const direction = params.direction;

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║ Configuring S7Plus Address for: ${params.dpeName.padEnd(29)} ║`);
    console.log(`╠════════════════════════════════════════════════════════════════╣`);
    console.log(`  - Reference: ${reference}`);
    console.log(`  - Direction: ${S7PlusAddressDirection[direction]} (${direction})`);
    console.log(`  - Transformation: ${S7PlusTransformation[datatype]} (${datatype})`);
    console.log(`  - Driver Number: ${params.driverNumber}`);
    if (params.itemLength !== undefined) console.log(`  - Item Length: ${params.itemLength}`);
    if (params.oldNewComparison !== undefined) console.log(`  - Old/New Comparison: ${params.oldNewComparison}`);

    // Determine if poll group is needed and ensure it exists
    // S7Plus subscription is NOT controlled by direction (6/IOSpont doesn't work).
    // Subscription = direction 7 (IOPoll) + subscription poll group + _S7PlusConfig registration.
    // Subscription is triggered by the onlyChanges parameter, not by the direction value.
    let pollGroupName: string | undefined;
    const isSubscription = params.onlyChanges !== undefined;
    if (S7PlusConnection.needsPollGroup(direction)) {
      const requestedName = params.pollGroup ?? (isSubscription ? '_S7Plus_Subscr' : '_S7Plus_Poll_1s');
      const pollInterval = params.pollInterval ?? 1000;
      const modeLabel = isSubscription ? 'Subscription' : 'Polling';
      console.log(`  - Mode: ${modeLabel} (requires poll group)`);
      console.log(`  - Poll Group: ${requestedName} (interval: ${pollInterval}ms)`);
      pollGroupName = await this.ensurePollGroupExists(requestedName, pollInterval);

      // For subscription mode, also register in _S7PlusConfig.Subscriptions
      if (isSubscription) {
        const onlyChanges = params.onlyChanges ?? true;
        console.log(`  - OnlyChanges: ${onlyChanges}`);
        await this.registerSubscription(pollGroupName, onlyChanges);
      }
    }

    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    // Use setAddressAndDistribConfig from BaseConnection (3-step: distrib → address → active)
    const success = await this.setAddressAndDistribConfig(
      params.dpeName,
      {
        _type: DpConfigType.DPCONFIG_PERIPH_ADDR_MAIN,
        _drv_ident: 'S7PLUS',
        _connection: params.connectionName,
        _reference: reference,
        _direction: direction,
        _datatype: datatype,
        _subindex: 0,
        _internal: false,
        _lowlevel: params.oldNewComparison ?? true,
        _active: true,
        ...(pollGroupName !== undefined ? { _poll_group: pollGroupName } : {})
      },
      {
        _type: DpConfigType.DPCONFIG_DISTRIBUTION_INFO,
        _driver: params.driverNumber
      }
    );

    if (!success) {
      throw new Error('Failed to set address configuration');
    }

    console.log(`✓ S7Plus address configured for ${params.dpeName}`);
    return true;
  }

  // ============================================================================
  // TIA Project Discovery
  // ============================================================================

  /**
   * Discover available TIA Portal exports and their PLCs/stations in the OA project.
   *
   * Creates a temporary connection with a dummy IP (not activated), browses for
   * TIA exports and stations, then cleans up the temp connection.
   * The caller never sees the temporary connection.
   *
   * @returns Discovery result with TIA projects and stations, or error if no driver
   */
  async discoverTiaProjects(): Promise<{
    success: boolean;
    needsDriver?: boolean;
    tiaProjects?: Array<{
      exportName: string;
      stations: string[];
    }>;
    message?: string;
    error?: string;
  }> {
    // Step 1: Find an existing running S7Plus driver
    const driverNumbers = await this.getS7PlusDriverNumbers();

    if (driverNumbers.length === 0) {
      return {
        success: false,
        needsDriver: true,
        error: 'No S7Plus driver is running. Please create and start an S7Plus driver first.'
      };
    }

    const managerNumber = driverNumbers[0]!;
    console.log(`Using existing S7Plus driver with -num ${managerNumber} for TIA discovery`);

    let tempConnectionName: string | undefined;

    try {
      // Step 2: Create temp Offline-mode connection with dummy IP and Automatic PLC type
      // StationName is initially empty — Root browse lists available TIA exports.
      // For each export, StationName is updated to browse stations inside it.
      const tempResult = await this.addConnection({
        ipAddress: '0.0.0.0',
        plcType: S7PlusPlcType.Automatic,
        managerNumber,
        stationName: '',
        enableConnection: false,
      });

      if (!tempResult.success || !tempResult.connectionName) {
        return {
          success: false,
          error: `Failed to create temporary connection for discovery: ${tempResult.error}`
        };
      }

      tempConnectionName = tempResult.connectionName;
      console.log(`[TIA Discovery] Temporary connection ${tempConnectionName} created`);
      console.log(`[TIA Discovery] Step 3: Browsing Root to list TIA exports...`);

      // Step 3: Browse Root to list available TIA exports
      const rootResult = await this.browse(tempConnectionName, { mode: 'Root' });
      console.log(`[TIA Discovery] Root browse returned ${rootResult.nodes.length} nodes`);

      if (rootResult.nodes.length === 0) {
        return {
          success: true,
          tiaProjects: [],
          message: 'No TIA Portal exports found in the OA project.'
        };
      }

      // Step 4: For each TIA export, browse for stations/PLCs
      const tiaProjects: Array<{ exportName: string; stations: string[] }> = [];

      for (const exportNode of rootResult.nodes) {
        const exportName = exportNode.path;
        // StationName requires the export name without .zip extension
        const stationName = exportName.replace(/\.zip$/i, '');
        console.log(`Discovering stations in TIA export '${exportName}' (StationName: '${stationName}')...`);

        // Set StationName to this export so browse can find stations inside
        await this.winccoa.dpSetWait(
          [`${tempConnectionName}.Config.StationName`],
          [stationName]
        );

        try {
          const stationResult = await this.browse(tempConnectionName, { mode: 'Offline' });

          const stations = stationResult.nodes
            .map(node => node.path)
            .filter(path => path && path.length > 0);

          tiaProjects.push({ exportName, stations });
        } catch (browseError) {
          console.warn(`Could not browse stations in '${exportName}':`, browseError);
          tiaProjects.push({ exportName, stations: [] });
        }
      }

      const totalStations = tiaProjects.reduce((sum, p) => sum + p.stations.length, 0);

      return {
        success: true,
        tiaProjects,
        message: `Found ${tiaProjects.length} TIA project(s) with ${totalStations} total station(s).`
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error during TIA project discovery:', error);
      return { success: false, error: errorMessage };

    } finally {
      // Step 5: Always clean up temp connection
      if (tempConnectionName) {
        try {
          await this.deleteConnection(tempConnectionName);
          console.log(`Temporary connection ${tempConnectionName} deleted`);
        } catch (cleanupError) {
          console.warn(`Could not delete temporary connection ${tempConnectionName}:`, cleanupError);
        }
      }
    }
  }
}

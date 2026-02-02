/**
 * MQTT Connection Manager
 *
 * Provides functionality to create, configure, and manage MQTT connections in WinCC OA.
 * Based on WinCC OA _MqttConnection internal datapoint structure.
 */

import { BaseConnection } from './BaseConnection.js';
import { PmonClient } from '../pmon/PmonClient.js';
import type {
  MqttConnectionConfig,
  MqttAddressParams,
  MqttAddressJson
} from '../../types/index.js';
import {
  MqttConnectionType,
  MqttConnectionState,
  MqttProtocolVersion,
  MqttSslVersion,
  MqttQoS,
  MqttAddressDirection,
  MqttTransformation,
  MQTT_DEFAULTS
} from '../../types/index.js';
import { DpConfigType, DpAddressDirection } from '../../types/index.js';

// Re-export for convenience
export {
  MqttConnectionType,
  MqttConnectionState,
  MqttProtocolVersion,
  MqttSslVersion,
  MqttQoS,
  MqttAddressDirection,
  MqttTransformation,
  MQTT_DEFAULTS
} from '../../types/index.js';

/**
 * MQTT Connection Manager Class
 *
 * Extends BaseConnection with MQTT-specific functionality.
 */
export class MqttConnection extends BaseConnection {

  /**
   * Generate a unique connection name for MQTT
   * @returns Connection name in format _MqttConnection<n>
   */
  async generateConnectionName(): Promise<string> {
    return super.generateConnectionName('_MqttConnection');
  }

  /**
   * Get available MQTT driver numbers from Pmon
   * Similar to CTRL paMqttCheckDrvNums()
   * @returns Array of MQTT driver numbers, sorted ascending
   */
  async getMqttDriverNumbers(): Promise<number[]> {
    try {
      const pmonClient = new PmonClient();
      const managerList = await pmonClient.getManagerList();

      const mqttDriverNums: number[] = [];

      for (const mgr of managerList) {
        // Check if this is an MQTT driver (name contains 'mqtt', case insensitive)
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        if (mgrName.includes('mqtt') && !mgrName.includes('pub')) {
          // Extract -num from command line options
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          const drvNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;
          mqttDriverNums.push(drvNum);
        }
      }

      // Sort ascending and return
      return mqttDriverNums.sort((a, b) => a - b);
    } catch (error) {
      console.warn('Could not get MQTT driver numbers from Pmon:', error);
      return [];
    }
  }

  /**
   * Get all used driver numbers (MQTT, simulation, other drivers)
   * @returns Array of used driver numbers
   */
  async getUsedDriverNumbers(): Promise<number[]> {
    try {
      const pmonClient = new PmonClient();
      const managerList = await pmonClient.getManagerList();

      const usedNums: number[] = [];

      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        // Check for any driver type (sim, mqtt, other drivers)
        if (mgrName.includes('sim') || mgrName.includes('drv') || mgrName.includes('mqtt')) {
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
   * Get the lowest available MQTT driver number (avoiding sim driver conflicts)
   * @returns Lowest available driver number for MQTT
   */
  async getDefaultMqttDriverNumber(): Promise<number> {
    const mqttNums = await this.getMqttDriverNumbers();

    // If MQTT drivers exist, use the lowest one
    if (mqttNums.length > 0) {
      return mqttNums[0]!;
    }

    // No MQTT driver yet - find a free number avoiding sim driver
    const usedNums = await this.getUsedDriverNumbers();

    // Start at 1, find first unused number
    let candidate = 1;
    while (usedNums.includes(candidate) && candidate < 100) {
      candidate++;
    }

    return candidate;
  }

  /**
   * Ensure MQTT driver with specified number is running
   * Creates and starts the driver if it doesn't exist
   * @param managerNumber - The driver number to ensure
   * @returns Object with success status and optional warnings
   */
  async ensureMqttDriverRunning(managerNumber: number): Promise<{
    success: boolean;
    error?: string;
    warnings?: string[];
  }> {
    const warnings: string[] = [];
    const pmonClient = new PmonClient();

    try {
      console.log(`🔍 Checking MQTT driver with -num ${managerNumber}...`);

      // Get current manager list
      const managerList = await pmonClient.getManagerList();
      const managerStatus = await pmonClient.getManagerStatus();

      // Collect all used driver numbers (including sim drivers)
      const usedDriverNumbers: number[] = [];
      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        // Check for any driver type (sim, mqtt, etc.)
        if (mgrName.includes('sim') || mgrName.includes('drv') || mgrName.includes('mqtt')) {
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          // If no -num specified, driver uses 1 by default
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

      // Find if MQTT driver with this number exists
      let driverFound = false;
      let driverIndex: number | null = null;
      let driverRunning = false;

      for (const mgr of managerList) {
        const mgrName = mgr.manager?.toLowerCase() ?? '';
        if (mgrName.includes('mqtt') && !mgrName.includes('pub')) {
          const cmdLine = mgr.commandlineOptions ?? '';
          const numMatch = cmdLine.match(/-num\s+(\d+)/);
          const drvNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 1;

          if (drvNum === managerNumber) {
            driverFound = true;
            driverIndex = mgr.index;

            // Check if running
            const statusEntry = managerStatus.managers.find(m => m.index === mgr.index);
            driverRunning = statusEntry?.state === 2; // ManagerState.Running = 2
            console.log(`✓ Found MQTT driver at index ${driverIndex}, running: ${driverRunning}`);
            break;
          }
        }
      }

      // If driver not found, create it
      if (!driverFound) {
        console.log(`⚠️  No MQTT driver with -num ${managerNumber} found, creating...`);

        // Find next available index
        const maxIndex = managerList.reduce((max, m) => Math.max(max, m.index), 0);
        const nextIndex = maxIndex + 1;

        // Try different MQTT driver names (varies by WinCC OA version)
        const mqttDriverNames = ['WCCOAmqtt', 'WCCOAmqttdrv'];
        let addSuccess = false;

        for (const driverName of mqttDriverNames) {
          console.log(`🔧 Trying to add MQTT driver '${driverName}' at index ${nextIndex}...`);

          const addResult = await pmonClient.addManager(
            nextIndex,
            driverName,
            'always',
            30,
            3,
            5,
            `-num ${managerNumber}`
          );

          if (addResult.success) {
            console.log(`✅ Successfully added MQTT driver '${driverName}'`);
            driverIndex = nextIndex;
            addSuccess = true;
            warnings.push(`MQTT driver '${driverName}' was automatically created at index ${nextIndex}.`);
            break;
          } else {
            console.log(`Could not add '${driverName}': ${addResult.error}`);
          }
        }

        if (!addSuccess) {
          return {
            success: false,
            error: `Could not create MQTT driver with -num ${managerNumber}. ` +
              `Please add the driver manually in WinCC OA Console.`
          };
        }
      }

      // Start driver if not running
      if (!driverRunning && driverIndex !== null) {
        console.log(`🔧 Starting MQTT driver at index ${driverIndex}...`);
        const startResult = await pmonClient.startManager(driverIndex);

        if (startResult.success) {
          console.log(`✅ Successfully started MQTT driver`);
          warnings.push(`MQTT driver at index ${driverIndex} was automatically started.`);

          // Wait a moment for driver to initialize
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          warnings.push(`Could not start MQTT driver: ${startResult.error}. Please start manually.`);
        }
      }

      return { success: true, warnings: warnings.length > 0 ? warnings : undefined };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error ensuring MQTT driver:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Build the JSON address string for Config.Address
   * This is the format stored in _MqttConnection.Config.Address
   * Required keys: Username, ConnectionType, ConnectionString, Certificate, Password, Identity, PSK
   */
  private buildAddressJson(config: MqttConnectionConfig): MqttAddressJson {
    // These keys must always be present (even if empty)
    const addressJson: MqttAddressJson = {
      ConnectionType: config.connectionType,
      ConnectionString: config.connectionString,
      Username: config.username ?? '',
      Password: config.password ?? '', // Must be pre-encrypted (WinCC OA blob), driver decrypts
      Certificate: config.certificate ?? '',
      Identity: config.pskIdentity ?? '',
      PSK: config.psk ?? '' // Must be pre-encrypted (WinCC OA blob), driver decrypts
    };

    // Add optional fields only if they have values
    if (config.clientId) {
      addressJson.ClientId = config.clientId;
    }
    if (config.clientCertificate) {
      addressJson.ClientCert = config.clientCertificate;
    }
    if (config.clientKey) {
      addressJson.ClientKey = config.clientKey;
    }
    if (config.clientCertPassword) {
      addressJson.ClientPass = config.clientCertPassword;
    }
    if (config.sslVersion !== undefined && config.sslVersion !== MqttSslVersion.Default) {
      addressJson.SslVersion = config.sslVersion;
    }
    if (config.protocolVersion !== undefined && config.protocolVersion !== MqttProtocolVersion.Default) {
      addressJson.ProtVersion = config.protocolVersion;
    }

    return addressJson;
  }

  /**
   * Add a new MQTT connection
   *
   * @param config - MQTT connection configuration
   * @returns Object with success status, connection name, and any errors
   */
  async addConnection(config: MqttConnectionConfig): Promise<{
    success: boolean;
    connectionName?: string;
    error?: string;
  }> {
    try {
      // Validate configuration
      if (!config.connectionString || config.connectionString.trim() === '') {
        return { success: false, error: 'Connection string (host:port) is required' };
      }

      // Determine manager number: use provided or auto-detect lowest MQTT driver
      let managerNumber: number;
      if (config.managerNumber !== undefined) {
        if (!this.validateManagerNumber(config.managerNumber)) {
          return { success: false, error: 'Manager number must be between 1 and 99' };
        }
        managerNumber = config.managerNumber;
        console.log(`Using specified manager number: ${managerNumber}`);
      } else {
        managerNumber = await this.getDefaultMqttDriverNumber();
        console.log(`Auto-detected MQTT driver number: ${managerNumber}`);
      }

      // Ensure MQTT driver is running (create if necessary)
      const driverResult = await this.ensureMqttDriverRunning(managerNumber);
      if (!driverResult.success) {
        return { success: false, error: driverResult.error };
      }
      if (driverResult.warnings) {
        driverResult.warnings.forEach(w => console.log(`⚠️  ${w}`));
      }

      // Validate connection string format (host:port)
      const connParts = config.connectionString.split(':');
      if (connParts.length !== 2 || !connParts[1]) {
        return { success: false, error: 'Connection string must be in format "host:port"' };
      }
      const port = parseInt(connParts[1] as string, 10);
      if (isNaN(port) || !this.validatePort(port)) {
        return { success: false, error: 'Port must be between 1 and 65535' };
      }

      // Generate unique connection name
      const connectionName = await this.generateConnectionName();

      // Create the connection datapoint
      const dpCreated = await this.ensureConnectionDpExists(connectionName, '_MqttConnection');
      if (!dpCreated) {
        return { success: false, error: `Failed to create connection datapoint ${connectionName}` };
      }

      // Build the address JSON for Config.Address
      const addressJson = this.buildAddressJson(config);
      const addressString = JSON.stringify(addressJson);

      // Build empty ReduAddress JSON (same structure, empty values)
      const reduAddressJson = {
        ConnectionType: config.connectionType,
        ConnectionString: '',
        Username: '',
        Password: '',
        Certificate: '',
        Identity: '',
        PSK: ''
      };
      const reduAddressString = JSON.stringify(reduAddressJson);

      // Apply default values
      const keepAlive = config.keepAliveInterval ?? MQTT_DEFAULTS.keepAliveInterval;
      const reconnect = config.reconnectInterval ?? MQTT_DEFAULTS.reconnectInterval;
      const useUtc = config.useUtc ?? MQTT_DEFAULTS.useUtc;
      const timezone = config.timezoneOffset ?? MQTT_DEFAULTS.timezoneOffset;
      const setInvalidBit = config.setInvalidBit ?? MQTT_DEFAULTS.setInvalidBit;
      const enableStatistics = config.enableStatistics ?? MQTT_DEFAULTS.enableStatistics;
      const persistentSession = config.persistentSession ?? MQTT_DEFAULTS.persistentSession;
      const enableConnection = config.enableConnection ?? MQTT_DEFAULTS.enableConnection;

      // PHASE 1: Create DP with initial values (like CTRL createNewDp)
      // All values set in one dpSet, matching CTRL code structure
      const dpes: string[] = [
        `${connectionName}.Config.Address`,
        `${connectionName}.Config.EstablishmentMode`,
        `${connectionName}.Config.SetInvalidBit`,
        `${connectionName}.Config.UseUTC`,
        `${connectionName}.Config.DrvNumber`,
        `${connectionName}.Config.CheckConn`,
        `${connectionName}.Config.EnableStatistics`,
        `${connectionName}.Config.Timezone`,
        `${connectionName}.Config.LifebeatTimeout`,
        `${connectionName}.Config.ReconnectTimeout`,
        `${connectionName}.Config.ReduAddress`,
        `${connectionName}.Config.LastWill.Topic`,
        `${connectionName}.Config.LastWill.Message`,
        `${connectionName}.Config.LastWill.QoS`,
        `${connectionName}.Config.LastWill.Retain`,
        `${connectionName}.Config.PersistentSession`,
        `${connectionName}.Command.Enable`,
        `${connectionName}.Command.IGQ`,
        `${connectionName}.Config.Sparkplug.HostId`,
        `${connectionName}.Config.AutoIGQ`
      ];

      const values: any[] = [
        addressString,
        0,  // EstablishmentMode: 0 initially (like CTRL)
        setInvalidBit,
        useUtc,
        managerNumber,
        false,  // CheckConn: false initially (NOT _address config!)
        enableStatistics,
        timezone,
        keepAlive,
        reconnect,
        reduAddressString,
        config.lastWillTopic ?? '',
        config.lastWillMessage ?? '',
        config.lastWillQoS ?? MQTT_DEFAULTS.lastWillQoS,
        config.lastWillRetain ?? MQTT_DEFAULTS.lastWillRetain,
        persistentSession,
        false,  // Command.Enable: 0 initially (like CTRL)
        false,  // Command.IGQ: 0
        '',     // Sparkplug.HostId: empty
        0       // AutoIGQ: 0
      ];

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ Creating MQTT Connection: ${connectionName.padEnd(36)} ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Configuration:                                                 ║`);
      console.log(`  - Connection Type: ${MqttConnectionType[config.connectionType]}`);
      console.log(`  - Connection String: ${config.connectionString}`);
      console.log(`  - Manager Number: ${managerNumber}`);
      console.log(`  - Username: ${config.username ?? '(none)'}`);
      console.log(`  - Keep Alive: ${keepAlive}s`);
      console.log(`  - Reconnect: ${reconnect}s`);
      console.log(`  - Use UTC: ${useUtc}`);
      console.log(`  - Enable Statistics: ${enableStatistics}`);
      console.log(`  - Persistent Session: ${persistentSession}`);
      console.log(`  - Enable Connection: ${enableConnection}`);
      console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

      // Apply initial configuration (Phase 1)
      await this.winccoa.dpSetWait(dpes, values);
      console.log(`✓ Initial configuration applied`);

      // Set JSON Profiles (empty array if not provided)
      const jsonProfiles = config.jsonProfiles ?? [];
      await this.winccoa.dpSetWait(
        [`${connectionName}.Config.JsonProfiles`],
        [jsonProfiles]
      );
      console.log(`✓ JSON Profiles set (${jsonProfiles.length} profiles)`);

      // PHASE 2: If enableConnection, set CheckConn _address and activate
      if (enableConnection) {
        // Set EstablishmentMode to 1 (auto active)
        await this.winccoa.dpSetWait(
          [`${connectionName}.Config.EstablishmentMode`],
          [1]
        );

        // Configure CheckConn address using base class method (sets _distrib + _address)
        const checkConnSuccess = await this.setAddressAndDistribConfig(
          `${connectionName}.Config.CheckConn`,
          {
            _type: DpConfigType.DPCONFIG_PERIPH_ADDR_MAIN,
            _drv_ident: 'MQTT',
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

        // Enable the connection
        await this.winccoa.dpSetWait(
          [`${connectionName}.Command.Enable`],
          [true]
        );
        console.log(`✓ Connection enabled`);
      }

      console.log(`✓ Successfully created MQTT connection: ${connectionName}`);
      return { success: true, connectionName };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error creating MQTT connection:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete an MQTT connection
   *
   * @param connectionName - Name of the connection to delete (with or without leading _)
   * @returns Object with success status and any errors
   */
  async deleteConnection(connectionName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Normalize connection name (ensure it starts with _)
      const dpName = connectionName.startsWith('_') ? connectionName : `_${connectionName}`;

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

      console.log(`✓ Successfully deleted MQTT connection: ${dpName}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error deleting MQTT connection:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the connection state of an MQTT connection
   *
   * @param connectionName - Name of the connection
   * @returns Connection state or error
   */
  async getConnectionState(connectionName: string): Promise<{
    success: boolean;
    state?: MqttConnectionState;
    stateText?: string;
    error?: string;
  }> {
    try {
      const dpName = connectionName.startsWith('_') ? connectionName : `_${connectionName}`;

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
        5: 'Failure',
        6: 'Listening'
      };

      return {
        success: true,
        state: state as MqttConnectionState,
        stateText: stateTexts[state] ?? 'Unknown'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * List all MQTT connections
   *
   * @returns Array of connection names and their states
   */
  async listConnections(): Promise<{
    success: boolean;
    connections?: Array<{
      name: string;
      state: MqttConnectionState;
      stateText: string;
      connectionString?: string;
    }>;
    error?: string;
  }> {
    try {
      // Get all datapoints of type _MqttConnection
      const dpNames = await this.winccoa.dpNames('*', '_MqttConnection') as string[];

      if (!dpNames || dpNames.length === 0) {
        return { success: true, connections: [] };
      }

      const connections: Array<{
        name: string;
        state: MqttConnectionState;
        stateText: string;
        connectionString?: string;
      }> = [];

      for (const dpName of dpNames) {
        // Skip redundant connections (ending with _2)
        if (dpName.endsWith('_2')) continue;

        try {
          const stateResult = await this.getConnectionState(dpName);
          let connectionString: string | undefined;

          try {
            const addressJson = await this.winccoa.dpGet(`${dpName}.Config.Address`) as string;
            if (addressJson) {
              const address = JSON.parse(addressJson) as MqttAddressJson;
              connectionString = address.ConnectionString;
            }
          } catch (e) {
            // Ignore parse errors
          }

          connections.push({
            name: dpName,
            state: stateResult.state ?? MqttConnectionState.Inactive,
            stateText: stateResult.stateText ?? 'Unknown',
            connectionString
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
   * Configure address settings for a datapoint (peripheral address)
   * Implementation of abstract method from BaseConnection
   *
   * @param params - MQTT address parameters
   * @returns true on success
   * @throws Error with detailed message on failure
   */
  async addAddressConfig(params: MqttAddressParams): Promise<boolean> {
    // Validate DPE exists
    const dpeParts = params.dpeName.split('.');
    const dpName = dpeParts[0];
    if (!dpName || !this.checkDpExists(dpName)) {
      throw new Error(`Datapoint ${dpName} does not exist. Please create it first.`);
    }

    // Normalize connection name (ensure it starts with _)
    const connectionName = params.connectionName.startsWith('_')
      ? params.connectionName
      : `_${params.connectionName}`;

    // Sanitize topic: remove trailing slashes
    const topic = params.topic.replace(/\/+$/, '');

    // Verify connection exists
    if (!this.checkDpExists(connectionName)) {
      throw new Error(
        `MQTT connection ${connectionName} does not exist. ` +
        `Use mqtt-add-connection to create a connection first.`
      );
    }

    // Get driver number from connection if not provided
    let driverNumber = params.driverNumber;
    if (!driverNumber) {
      try {
        driverNumber = await this.winccoa.dpGet(`${connectionName}.Config.DrvNumber`) as number;
      } catch {
        throw new Error(`Could not get driver number from connection ${connectionName}`);
      }
    }

    // Map direction: MqttAddressDirection values match DpAddressDirection
    // Publish=1 (OUTPUT), Subscribe=2 (INPUT_SPONT), Both=6 (IO_SPONT)
    const direction = params.direction;

    // Transformation type (default: PlainString = 1000)
    console.log("  DEBUG - params.transformation received:", params.transformation, "type:", typeof params.transformation);
    const datatype = params.transformation ?? MqttTransformation.PlainString;
    console.log("  DEBUG - datatype after default:", datatype);

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║ Configuring MQTT Address for: ${params.dpeName.padEnd(31)} ║`);
    console.log(`╠════════════════════════════════════════════════════════════════╣`);
    console.log(`  - Topic: ${topic}`);
    console.log(`  - Connection: ${connectionName}`);
    console.log(`  - Direction: ${MqttAddressDirection[direction]} (${direction})`);
    console.log(`  - Transformation: ${MqttTransformation[datatype]} (${datatype})`);
    console.log(`  - Driver Number: ${driverNumber}`);
    if (params.qos !== undefined) console.log(`  - QoS: ${params.qos}`);
    if (params.retain !== undefined) console.log(`  - Retain: ${params.retain}`);
    if (params.oldNewComparison !== undefined) console.log(`  - Old/New Comparison: ${params.oldNewComparison}`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    // Use setAddressAndDistribConfig from BaseConnection
    const success = await this.setAddressAndDistribConfig(
      params.dpeName,
      {
        _type: DpConfigType.DPCONFIG_PERIPH_ADDR_MAIN,
        _drv_ident: 'MQTT',
        _connection: connectionName,
        _reference: topic,
        _direction: direction,
        _datatype: datatype,
        _subindex: 0,
        _internal: false,
        _lowlevel: params.oldNewComparison ?? true,
        _active: true
      },
      {
        _type: DpConfigType.DPCONFIG_DISTRIBUTION_INFO,
        _driver: driverNumber
      }
    );

    if (!success) {
      throw new Error('Failed to set address configuration');
    }

    console.log(`✓ MQTT address configured for ${params.dpeName}`);
    return true;
  }
}

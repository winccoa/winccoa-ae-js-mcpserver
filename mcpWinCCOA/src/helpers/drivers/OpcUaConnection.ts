/**
 * OPC UA Connection Manager
 *
 * Provides functionality to create, configure, and browse OPC UA connections in WinCC OA.
 */

import { BaseConnection } from './BaseConnection.js';
import type {
  OpcUaConnectionConfig,
  SecurityPolicy,
  MessageSecurityMode,
  BrowseNode,
  BrowseEventSource,
  OPCUA_DEFAULTS,
  DpAddressConfig,
  DpDistribConfig
} from '../../types/index.js';
import { DpConfigType, OpcUaDatatype, DpAddressDirection } from '../../types/index.js';
import { PmonClient } from '../pmon/PmonClient.js';
import { ManagerState } from '../../types/pmon/protocol.js';

// Re-export enums and constants for backward compatibility
export { SecurityPolicy, MessageSecurityMode, OPCUA_DEFAULTS } from '../../types/index.js';

/**
 * Interface for driver validation results
 */
interface DriverValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * OPC UA Connection Manager Class
 *
 * Extends BaseConnection with OPC UA-specific functionality.
 */
export class OpcUaConnection extends BaseConnection {
  /**
   * Generate a unique browse request ID
   * @returns Unique request ID
   */
  private generateBrowseRequestId(): string {
    return `browse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique connection name for OPC UA
   * @returns Connection name in format _OpcUAConnection<n>
   */
  async generateConnectionName(): Promise<string> {
    return super.generateConnectionName('_OpcUAConnection');
  }

  /**
   * Ensure that the _OPCUA<managerNumber> datapoint exists
   * @param managerNumber - Manager number
   * @returns true on success
   */
  async ensureOpcUaManagerDpExists(managerNumber: number): Promise<boolean> {
    try {
      const dpName = `_OPCUA${managerNumber}`;

      if (this.checkDpExists(dpName)) {
        console.log(`Manager datapoint ${dpName} already exists`);
        return true;
      }

      console.log(`Creating manager datapoint ${dpName} of type _OPCUA`);
      const created = await this.winccoa.dpCreate(dpName, '_OPCUA');

      if (!created) {
        console.error(`Failed to create manager datapoint ${dpName}`);
        return false;
      }

      console.log(`Successfully created manager datapoint ${dpName}`);
      return true;
    } catch (error) {
      console.error(`Error ensuring manager datapoint exists:`, error);
      return false;
    }
  }

  /**
   * Validate the OPC UA connection configuration
   * @param config - Configuration to validate
   * @throws Error on invalid configuration
   */
  private validateConnectionConfig(config: OpcUaConnectionConfig): void {
    // Validate IP address
    if (!this.validateIpAddress(config.ipAddress)) {
      throw new Error(`Invalid IP address or hostname: ${config.ipAddress}`);
    }

    // Validate port
    if (!this.validatePort(config.port)) {
      throw new Error(`Invalid port number: ${config.port}. Must be between 1 and 65535`);
    }

    // Validate manager number
    if (!this.validateManagerNumber(config.managerNumber)) {
      throw new Error(`Invalid manager number: ${config.managerNumber}. Must be between 1 and 99`);
    }

    // Validate reconnect timer
    if (config.reconnectTimer !== undefined && config.reconnectTimer <= 0) {
      throw new Error('Reconnect timer must be positive');
    }
  }

  /**
   * Validate that the OPC UA driver exists, is running, and has the correct manager number configured
   * @param managerNumber - The manager number to validate (e.g., 4 for _OPCUA4)
   * @returns Validation result with status, optional error message, and optional warnings
   */
  private async validateOpcUaDriver(managerNumber: number): Promise<DriverValidationResult> {
    const warnings: string[] = [];

    try {
      console.log(`🔍 Validating OPC UA driver for manager number ${managerNumber}...`);

      // 1. Ensure the manager datapoint exists (create if necessary)
      const managerDp = `_OPCUA${managerNumber}`;
      if (!this.checkDpExists(managerDp)) {
        console.log(`⚠️  Manager datapoint ${managerDp} does not exist`);
        console.log(`🔧 Creating manager datapoint ${managerDp}...`);

        try {
          const created = await this.winccoa.dpCreate(managerDp, '_OPCUA');
          if (!created) {
            console.error(`❌ Failed to create manager datapoint ${managerDp}`);
            return {
              valid: false,
              error: `OPC UA Manager datapoint ${managerDp} does not exist and could not be created automatically. Please create it manually using dpCreate("${managerDp}", "_OPCUA").`
            };
          }
          console.log(`✅ Successfully created manager datapoint ${managerDp}`);
          warnings.push(`Manager datapoint ${managerDp} was automatically created.`);
        } catch (createError) {
          const errorMsg = createError instanceof Error ? createError.message : String(createError);
          console.error(`❌ Error creating manager datapoint: ${errorMsg}`);
          return {
            valid: false,
            error: `Failed to create manager datapoint ${managerDp}: ${errorMsg}. Please create it manually.`
          };
        }
      } else {
        console.log(`✓ Manager datapoint ${managerDp} exists`);
      }

      // 2. Connect to Pmon and get manager status
      const pmonClient = new PmonClient();
      let status;
      let managerList;

      try {
        status = await pmonClient.getManagerStatus();
        managerList = await pmonClient.getManagerList();
        console.log(`✓ Connected to Pmon, found ${status.managers.length} managers`);
      } catch (pmonError) {
        const errorMsg = pmonError instanceof Error ? pmonError.message : String(pmonError);
        console.warn(`⚠️  Could not connect to Pmon: ${errorMsg}`);
        warnings.push(
          `Could not verify driver status via Pmon: ${errorMsg}. ` +
          `Connection may fail if driver is not running. ` +
          `Please ensure the OPC UA driver with '-num ${managerNumber}' is configured and running.`
        );
        return {
          valid: true,
          warnings
        };
      }

      // 3. Search for OPC UA driver with the correct manager number
      let driverFound = false;
      let driverRunning = false;
      let driverIndex: number | null = null;
      let driverName: string = '';

      for (let i = 0; i < status.managers.length; i++) {
        const mgr = status.managers[i];
        if (!mgr) continue;

        const mgrDetails = managerList[mgr.index];
        if (!mgrDetails) continue;

        // Check if this is an OPC UA driver (look for OPCUA in the manager name)
        const isOpcUaDriver =
          mgrDetails.manager?.toLowerCase().includes('opcua') ||
          mgrDetails.manager?.toLowerCase().includes('opc-ua');

        if (isOpcUaDriver) {
          const managerNameStr = mgrDetails.manager || 'unknown';
          const commandLineStr = mgrDetails.commandlineOptions || '';
          console.log(`  Found OPC UA manager: ${managerNameStr}, options: "${commandLineStr}"`);

          // Check if the manager number matches (look for "-num X" in command line options)
          const numMatch = commandLineStr.match(/-num\s+(\d+)/);
          const configuredNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : null;

          if (configuredNum === managerNumber) {
            driverFound = true;
            driverIndex = mgr.index;
            driverName = managerNameStr;
            driverRunning = (mgr.state === ManagerState.Running);
            console.log(`✓ Found matching OPC UA driver '${driverName}' at index ${driverIndex} with -num ${managerNumber}`);
            console.log(`  Driver state: ${driverRunning ? 'RUNNING' : 'NOT RUNNING'} (state code: ${mgr.state})`);
            break;
          }
        }
      }

      // 4. Evaluate results and auto-create driver if missing
      if (!driverFound) {
        console.log(`❌ No OPC UA driver with '-num ${managerNumber}' found`);
        console.log(`🔧 Attempting to automatically create OPC UA driver...`);

        try {
          // Try different manager names for different WinCC OA versions
          const managerNames = ['WCCOAopcua', 'WCCOAopcuadrv'];
          let addedSuccessfully = false;
          let usedManagerName = '';
          let usedPosition = 0;

          for (const managerName of managerNames) {
            // Find a free position for the new manager (after existing managers)
            // Try to find the highest index and add after it
            let maxIndex = 0;
            for (const mgr of status.managers) {
              if (mgr && mgr.index > maxIndex) {
                maxIndex = mgr.index;
              }
            }
            const nextPosition = maxIndex + 1;

            console.log(`🔧 Trying to add manager '${managerName}' at position ${nextPosition}...`);

            // Add the OPC UA driver using PmonClient
            const addResult = await pmonClient.addManager(
              nextPosition,
              managerName,
              'always',
              30,
              3,
              5,
              `-num ${managerNumber}`
            );

            if (addResult.success) {
              console.log(`✅ Successfully added OPC UA driver '${managerName}' at position ${nextPosition}`);
              addedSuccessfully = true;
              usedManagerName = managerName;
              usedPosition = nextPosition;
              break;
            } else {
              console.warn(`⚠️  Failed to add manager '${managerName}': ${addResult.error}`);
              // Try next manager name
            }
          }

          if (!addedSuccessfully) {
            console.error(`❌ Failed to add OPC UA driver with any manager name`);
            return {
              valid: false,
              error:
                `No OPC UA driver with '-num ${managerNumber}' found and automatic creation failed.\n\n` +
                `Tried manager names: ${managerNames.join(', ')}\n\n` +
                `Please add the driver manually via WinCC OA Console:\n` +
                `  1. Open Console and go to Para -> Distributed Systems -> Managers\n` +
                `  2. Add new manager: ${managerNames[0]}\n` +
                `  3. Options: -num ${managerNumber}\n` +
                `  4. Start mode: always\n` +
                `  5. Apply and start the manager`
            };
          }

          console.log(`✅ Manager '${usedManagerName}' added to Pmon at position ${usedPosition}`);

          // Wait a moment for Pmon to process
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Verify the manager was actually added by refreshing the status
          console.log(`🔍 Verifying manager was added to Pmon...`);
          const verifyStatus = await pmonClient.getManagerStatus();
          const verifyList = await pmonClient.getManagerList();

          let verified = false;
          for (let i = 0; i < verifyStatus.managers.length; i++) {
            const mgr = verifyStatus.managers[i];
            if (!mgr) continue;

            const mgrDetails = verifyList[mgr.index];
            if (!mgrDetails) continue;

            if (mgrDetails.manager === usedManagerName &&
                mgrDetails.commandlineOptions?.includes(`-num ${managerNumber}`)) {
              verified = true;
              usedPosition = mgr.index;
              console.log(`✅ Verified: Manager '${usedManagerName}' is in Pmon at index ${usedPosition}`);
              break;
            }
          }

          if (!verified) {
            console.error(`❌ Manager was reported as added but cannot be found in Pmon`);
            warnings.push(
              `OPC UA driver '${usedManagerName}' was added to Pmon configuration but verification failed. ` +
              `Please check WinCC OA Console to verify the manager exists and start it manually if needed.`
            );
            return {
              valid: true,
              warnings
            };
          }

          // Try to start the newly created driver
          console.log(`🔧 Attempting to start the OPC UA driver at index ${usedPosition}...`);
          const startResult = await pmonClient.startManager(usedPosition);

          if (startResult.success) {
            console.log(`✅ Successfully started OPC UA driver '${usedManagerName}' at index ${usedPosition}`);
            warnings.push(
              `OPC UA driver '${usedManagerName}' was automatically created and started at position ${usedPosition}. ` +
              `The driver is now running and ready for connections.`
            );
          } else {
            console.warn(`⚠️  Driver created but failed to start: ${startResult.error}`);
            warnings.push(
              `OPC UA driver '${usedManagerName}' was automatically created at position ${usedPosition} but could not be started. ` +
              `Error: ${startResult.error}. ` +
              `Please start it manually using WinCC OA Console. ` +
              `The connection will work after starting the driver.`
            );
          }

          // Driver was created, continue with success
          return {
            valid: true,
            warnings: warnings.length > 0 ? warnings : undefined
          };

        } catch (createError) {
          const createErrorMsg = createError instanceof Error ? createError.message : String(createError);
          console.error(`❌ Error creating OPC UA driver:`, createErrorMsg);
          return {
            valid: false,
            error:
              `No OPC UA driver with '-num ${managerNumber}' found and automatic creation failed.\n\n` +
              `Error: ${createErrorMsg}\n\n` +
              `Please add the driver manually:\n` +
              `  1. Open WinCC OA Console -> Para -> Distributed Systems -> Managers\n` +
              `  2. Add manager: WCCOAopcua (or WCCOAopcuadrv)\n` +
              `  3. Options: -num ${managerNumber}\n` +
              `  4. Start mode: always\n` +
              `  5. Apply and start the driver`
          };
        }
      }

      if (!driverRunning) {
        console.log(`⚠️  Driver found but not running (index ${driverIndex})`);
        console.log(`🔧 Attempting to start the OPC UA driver...`);

        try {
          const startResult = await pmonClient.startManager(driverIndex!);

          if (startResult.success) {
            console.log(`✅ Successfully started OPC UA driver '${driverName}' at index ${driverIndex}`);
            warnings.push(
              `OPC UA driver '${driverName}' (index ${driverIndex}) was not running and has been automatically started. ` +
              `The driver is now ready for connections.`
            );
          } else {
            console.warn(`⚠️  Failed to start driver: ${startResult.error}`);
            warnings.push(
              `OPC UA driver '${driverName}' (index ${driverIndex}) exists with '-num ${managerNumber}' ` +
              `but is not running and could not be started automatically. ` +
              `Error: ${startResult.error}. ` +
              `Please start it manually using WinCC OA Console. ` +
              `The connection will work after starting the driver.`
            );
          }
        } catch (startError) {
          const startErrorMsg = startError instanceof Error ? startError.message : String(startError);
          console.error(`❌ Error starting driver:`, startErrorMsg);
          warnings.push(
            `OPC UA driver '${driverName}' (index ${driverIndex}) exists but is not running. ` +
            `Automatic start failed: ${startErrorMsg}. ` +
            `Please start it manually using WinCC OA Console.`
          );
        }
      }

      console.log(`✓ OPC UA driver validation completed successfully`);
      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error during driver validation:`, errorMessage);

      // If validation fails due to unexpected error, warn but don't block
      warnings.push(
        `Driver validation encountered an error: ${errorMessage}. ` +
        `Proceeding with connection creation, but please verify the driver configuration manually.`
      );

      return {
        valid: true,
        warnings
      };
    }
  }

  /**
   * Add server to running OPC UA driver using AddServer command
   * This allows the connection to be available immediately without driver restart
   * @param managerNumber - Manager number
   * @param connectionName - Connection name (WITHOUT leading underscore)
   * @returns true on success, false on failure (but logs warning only)
   */
  private async addServerToRunningDriver(
    managerNumber: number,
    connectionName: string
  ): Promise<boolean> {
    try {
      const managerDpName = `_OPCUA${managerNumber}`;
      const cmdAddServer = `${managerDpName}.Command.AddServer`;

      // Connection name without leading underscore
      const nameWithoutUnderscore = connectionName.startsWith('_')
        ? connectionName.substring(1)
        : connectionName;

      // Check if the Command.AddServer datapoint element exists
      if (!this.checkDpExists(managerDpName)) {
        console.warn(`Manager datapoint ${managerDpName} does not exist, skipping AddServer command`);
        return false;
      }

      console.log(`Triggering AddServer command for connection ${nameWithoutUnderscore} on running driver ${managerDpName}`);
      
      // Trigger AddServer command with connection name
      // This command adds the server to the running driver without restart
      await this.winccoa.dpSetWait(cmdAddServer, nameWithoutUnderscore);

      console.log(`✓ Successfully triggered AddServer command for ${nameWithoutUnderscore}`);
      return true;
    } catch (error) {
      // Don't fail the entire operation if AddServer command fails
      // The connection is already registered in Config.Servers, so it will work after driver restart
      console.warn(`Warning: Could not trigger AddServer command (driver may not be running or command not available):`, error);
      console.warn(`Connection will be available after driver restart`);
      return false;
    }
  }

  /**
   * Register the connection with the OPC UA manager
   * @param managerNumber - Manager number
   * @param connectionName - Connection name (WITHOUT leading underscore)
   * @returns true on success
   */
  private async registerConnectionWithManager(
    managerNumber: number,
    connectionName: string
  ): Promise<boolean> {
    try {
      const managerDpName = `_OPCUA${managerNumber}`;

      // Connection name without leading underscore
      const nameWithoutUnderscore = connectionName.startsWith('_')
        ? connectionName.substring(1)
        : connectionName;

      // Get current server list
      const currentServersRaw = await this.winccoa.dpGet(`${managerDpName}.Config.Servers`);
      const currentServers: string[] = Array.isArray(currentServersRaw) ? currentServersRaw : [];

      // Check if connection is already registered
      if (currentServers.includes(nameWithoutUnderscore)) {
        console.log(`Connection ${nameWithoutUnderscore} already registered with manager ${managerNumber}`);
        return true;
      }

      // Add connection to the list
      currentServers.push(nameWithoutUnderscore);

      console.log(`Registering connection ${nameWithoutUnderscore} with manager ${managerNumber}`);
      await this.winccoa.dpSetWait(`${managerDpName}.Config.Servers`, currentServers);

      console.log(`Successfully registered connection ${nameWithoutUnderscore}`);
      
      // Trigger AddServer command to add server to running driver (if available)
      // This eliminates the need for driver restart
      await this.addServerToRunningDriver(managerNumber, nameWithoutUnderscore);

      return true;
    } catch (error) {
      console.error(`Error registering connection with manager:`, error);
      return false;
    }
  }

  /**
   * Configure the OPC UA connection
   * @param config - Connection configuration
   * @param connectionName - Connection name
   * @returns true on success
   */
  private async configureConnection(
    config: OpcUaConnectionConfig,
    connectionName: string
  ): Promise<boolean> {
    try {
      const serverUrl = `opc.tcp://${config.ipAddress}:${config.port}`;

      // Get defaults from imported constant
      const defaults = await import('../../types/index.js').then(m => m.OPCUA_DEFAULTS);

      // Basic configuration
      const dpes = [
        `${connectionName}.Config.ConnInfo`,
        `${connectionName}.Config.AccessInfo`,
        `${connectionName}.Config.Password`,
        `${connectionName}.Config.Security.Policy`,
        `${connectionName}.Config.Security.MessageMode`,
        `${connectionName}.Config.Security.Certificate`,
        `${connectionName}.Config.Active`,
        `${connectionName}.Config.ReconnectTimer`,
        `${connectionName}.Config.Separator`,
        `${connectionName}.Config.Flags`,
        `${connectionName}.Redu.Config.ConnInfo`,
        `${connectionName}.Redu.Config.Active`
      ];

      const values = [
        serverUrl,                                                     // ConnInfo
        config.username || '',                                         // AccessInfo (Username)
        config.password ? Buffer.from(config.password, 'utf-8') : Buffer.alloc(0), // Password (blob type)
        config.securityPolicy ?? defaults.securityPolicy,              // Security Policy
        config.messageSecurityMode ?? defaults.messageSecurityMode,    // Message Mode
        config.clientCertificate || '',                                // Client Certificate
        (config.enableConnection ?? defaults.enableConnection) ? 1 : 0, // Active
        config.reconnectTimer ?? defaults.reconnectTimer,              // ReconnectTimer
        config.separator ?? defaults.separator,                        // Separator
        0,                                                             // Flags (default)
        'opc.tcp://',                                                  // Redu.ConnInfo (empty)
        0                                                              // Redu.Active (inactive)
      ];

      console.log(`Configuring connection ${connectionName}:`);
      console.log(`- Server URL: ${serverUrl}`);
      console.log(`- Authentication: ${config.username ? 'Username/Password' : 'Anonymous'}`);
      console.log(`- Reconnect Timer: ${config.reconnectTimer ?? defaults.reconnectTimer} seconds`);

      // Set the configuration
      await this.winccoa.dpSetWait(dpes, values);

      console.log(`Successfully configured connection ${connectionName}`);
      return true;
    } catch (error) {
      console.error(`Error configuring connection:`, error);
      return false;
    }
  }

  /**
   * Browse the OPC UA address space
   *
   * @param connectionName - Name of the connection (e.g., '_OpcUAConnection1')
   * @param parentNodeId - Node ID of the parent node (optional, default: "ns=0;i=85" for Root)
   * @param eventSource - 0=Value (default), 1=Event, 2=Alarm&Condition
   * @returns Promise with array of browse nodes
   */
  async browse(
    connectionName: string,
    parentNodeId?: string,
    eventSource: BrowseEventSource = 0
  ): Promise<BrowseNode[]> {
    try {
      // Ensure connection name has leading underscore
      const connDp = connectionName.startsWith('_') ? connectionName : `_${connectionName}`;

      // Default to Objects folder if no parent specified
      const startNode = parentNodeId || 'ns=0;i=85';
      const level = 1; // Only direct children

      // Generate unique request ID
      const requestId = this.generateBrowseRequestId();

      console.log(`Starting browse on ${connDp}, node: ${startNode}, eventSource: ${eventSource}`);

      // Create promise to wait for browse result
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Browse timeout after 30 seconds for connection ${connDp}`));
        }, 30000);

        // Callback function for dpConnect
        const browseCallback = async (dpes: string[]) => {
          try {
            console.log(`Browse callback triggered!`);

            // Read all values at once with a single dpGet call
            const values = await this.winccoa.dpGet([
              `${connDp}.Browse.RequestId`,
              `${connDp}.Browse.DisplayNames`,
              `${connDp}.Browse.BrowsePaths`,
              `${connDp}.Browse.NodeIds`,
              `${connDp}.Browse.DataTypes`,
              `${connDp}.Browse.ValueRanks`,
              `${connDp}.Browse.NodeClasses`
            ]) as any[];

            const returnedRequestId = values[0] as string;
            const displayNames = values[1] as string[];
            const browsePaths = values[2] as string[];
            const nodeIds = values[3] as string[];
            const dataTypes = values[4] as string[];
            const valueRanks = values[5] as string[] | undefined;
            const nodeClasses = values[6] as string[] | undefined;

            console.log(`Returned RequestId: ${returnedRequestId}, Expected: ${requestId}`);

            // Check if this is our request
            if (returnedRequestId !== requestId) {
              console.log(`RequestId mismatch, ignoring callback`);
              return; // Not our request, ignore
            }

            console.log(`RequestId matches, processing ${displayNames.length} nodes`);
            clearTimeout(timeout);

            // Build result array
            const results: BrowseNode[] = [];

            for (let i = 0; i < displayNames.length; i++) {
              const displayName = displayNames[i];
              if (displayName && displayName.length > 0) {
                results.push({
                  displayName: displayName,
                  browsePath: browsePaths[i] || '',
                  nodeId: nodeIds[i] || '',
                  dataType: dataTypes[i] || '',
                  valueRank: valueRanks?.[i],
                  nodeClass: nodeClasses?.[i]
                });
              }
            }

            console.log(`Browse completed: found ${results.length} nodes`);

            // Disconnect callback
            this.winccoa.dpDisconnect(connId);

            resolve(results);
          } catch (error) {
            console.error(`Error in browse callback:`, error);
            this.winccoa.dpDisconnect(connId);
            reject(error);
          }
        };

        // Connect callback to browse datapoints
        const connId = this.winccoa.dpConnect(
          browseCallback,
          [
            `${connDp}.Browse.DisplayNames`,
            `${connDp}.Browse.BrowsePaths`,
            `${connDp}.Browse.NodeIds`,
            `${connDp}.Browse.DataTypes`,
            `${connDp}.Browse.ValueRanks`,
            `${connDp}.Browse.NodeClasses`,
            `${connDp}.Browse.RequestId`
          ],
          false // Don't send initial values
        );

        // Trigger browse request
        this.winccoa
          .dpSetWait(`${connDp}.Browse.GetBranch:_original.._value`, [requestId, startNode, level, eventSource])
          .catch(reject);
      });
    } catch (error) {
      console.error(`Error browsing OPC UA connection:`, error);
      throw error;
    }
  }

  /**
   * Get manager number for a given OPC UA connection
   * Searches for which _OPCUA{num} manager has this connection registered
   *
   * @param connectionName - Connection name (normalized with _ prefix)
   * @returns Manager number (1-255)
   * @throws Error if no manager found
   */
  private async getManagerNumberForConnection(connectionName: string): Promise<number> {
    try {
      // Normalize connection name (remove leading underscore for search)
      const normalizedName = connectionName.startsWith('_')
        ? connectionName.substring(1)
        : connectionName;

      console.log(`Auto-detecting manager for connection: ${normalizedName}`);

      // 1. Try to find which _OPCUA{num} has this connection registered
      // Get all _OPCUA{num} datapoints
      const opcuaManagers = this.winccoa.dpNames('_OPCUA*', '_OPCUA');

      for (const managerDp of opcuaManagers) {
        try {
          const servers = await this.winccoa.dpGet(`${managerDp}.Config.Servers`) as string[];
          if (Array.isArray(servers) && servers.includes(normalizedName)) {
            // Extract number from "_OPCUA{num}"
            const match = managerDp.match(/_OPCUA(\d+)/);
            if (match && match[1]) {
              const managerNum = parseInt(match[1]);
              console.log(`Found connection registered with ${managerDp}`);
              return managerNum;
            }
          }
        } catch (error) {
          // Skip managers that don't have Config.Servers or are not accessible
          continue;
        }
      }

      // 2. Fallback: Find first running OPCUA driver by checking _Driver* datapoints
      const drivers = this.winccoa.dpNames('_Driver*', '_DriverCommon');

      for (const driverDp of drivers) {
        try {
          const driverType = await this.winccoa.dpGet(`${driverDp}.DT`) as string;
          if (driverType === "OPCUAC") { // OPC UA Client driver type
            const match = driverDp.match(/_Driver(\d+)/);
            if (match && match[1]) {
              const driverNum = parseInt(match[1]);
              console.log(`Found running OPC UA driver with number ${driverNum}`);
              return driverNum;
            }
          }
        } catch (error) {
          continue;
        }
      }

      throw new Error(
        `No OPC UA manager found for connection ${connectionName}. ` +
        `Please ensure: 1) Connection is registered with a manager (_OPCUA{num}.Config.Servers), ` +
        `or 2) An OPC UA driver is running.`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to detect manager number: ${errorMessage}`);
    }
  }

  /**
   * Validate manager number and check if connection is registered with it
   *
   * @param managerNumber - Manager number to validate
   * @param connectionName - Connection name (normalized with _ prefix)
   * @throws Error if validation fails
   */
  private async validateManagerNumberForConnection(
    managerNumber: number,
    connectionName: string
  ): Promise<void> {
    // 1. Validate range
    if (managerNumber < 1 || managerNumber > 255) {
      throw new Error(
        `Manager number ${managerNumber} out of valid range (1-255)`
      );
    }

    // 2. Check if manager datapoint exists
    const managerDp = `_OPCUA${managerNumber}`;
    if (!this.checkDpExists(managerDp)) {
      throw new Error(
        `OPC UA Manager ${managerDp} does not exist. ` +
        `Please create it first or check your manager number.`
      );
    }

    // 3. Check if connection is registered with this manager
    const normalizedName = connectionName.startsWith('_')
      ? connectionName.substring(1)
      : connectionName;

    try {
      const servers = await this.winccoa.dpGet(`${managerDp}.Config.Servers`) as string[];

      if (!Array.isArray(servers) || !servers.includes(normalizedName)) {
        throw new Error(
          `Connection ${connectionName} is not registered with manager ${managerDp}. ` +
          `Registered connections: ${servers && servers.length > 0 ? servers.join(', ') : 'none'}`
        );
      }

      console.log(`Validated: Connection ${connectionName} is registered with ${managerDp}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to validate manager registration: ${errorMessage}`);
    }
  }

  /**
   * Ensure that a poll group exists for polling or spontaneous mode
   *
   * Based on reference implementation IT_OT_BL.ctl lines 1014-1041:
   * - Uses _PollGroup type (not _OPCUASubscription)
   * - For polling mode: Uses PollInterval to control how often data is queried
   * - For spontaneous mode: Just needs a name in _poll_group attribute
   * - Poll group can be shared across multiple datapoints
   *
   * @param subscriptionName - Poll group/subscription name (e.g., '_DefaultSubscription' or 'DefaultSubscription')
   * @param connectionName - Connection name (normalized with _ prefix)
   * @returns Poll group name with _ prefix
   * @throws Error if poll group cannot be created
   */
  private async ensureSubscriptionExists(
    subscriptionName: string,
    connectionName: string
  ): Promise<string> {
    try {
      // Normalize subscription name (ensure _ prefix)
      const normalizedSub = subscriptionName.startsWith('_')
        ? subscriptionName
        : `_${subscriptionName}`;

      // Check if subscription/poll group already exists
      const subscriptionExists = this.checkDpExists(normalizedSub);

      if (subscriptionExists) {
        console.log(`Poll group/subscription ${normalizedSub} already exists`);
        return normalizedSub;
      }

      // Create as _PollGroup (used for both polling and spontaneous)
      // For polling mode: PollInterval controls how often data is queried
      // For spontaneous mode: Just needs a name reference in _poll_group attribute
      console.log(`Creating poll group ${normalizedSub} of type _PollGroup`);

      const created = await this.winccoa.dpCreate(normalizedSub, '_PollGroup');
      if (!created) {
        throw new Error(`Failed to create poll group ${normalizedSub}`);
      }

      // Configure poll group settings
      // Active: Enable the poll group
      // PollInterval: Controls polling frequency (1000ms = 1 second)
      console.log(`Configuring poll group ${normalizedSub}:`);
      console.log(`  - Active: true`);
      console.log(`  - PollInterval: 1000ms`);

      await this.winccoa.dpSetWait(
        [
          `${normalizedSub}.Active`,
          `${normalizedSub}.PollInterval`
        ],
        [
          1,     // Active = true
          1000   // Poll interval in ms (1 second)
        ]
      );

      console.log(`✓ Successfully created and configured poll group ${normalizedSub}`);
      return normalizedSub;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to ensure subscription exists: ${errorMessage}`);
    }
  }

  /**
   * Build OPC UA reference string
   * Format: ConnectionName$$1$1$NodeId (note the DOUBLE $$)
   *
   * IMPORTANT: Based on reference implementation IT_OT_BL.ctl line 1048:
   * - Use DOUBLE dollar signs $$ between connection and mode
   * - Do NOT include subscription name in reference string
   * - Subscription is specified separately in _poll_group attribute
   *
   * @param connectionName - Connection name (with _ prefix, e.g., '_OpcUAConnection1')
   * @param nodeId - OPC UA Node ID (e.g., 'ns=2;s=MyVariable')
   * @returns Formatted reference string
   */
  private buildReferenceString(
    connectionName: string,
    nodeId: string
  ): string {
    // Remove leading underscore for reference string
    const conn = connectionName.startsWith('_')
      ? connectionName.substring(1)
      : connectionName;

    // Format: Connection$$Variant$Mode$NodeId
    // Note: DOUBLE $$ is critical!
    // Variant: 1 = NodeId (not browse path)
    // Mode: 1 = NodeId format
    return `${conn}$$1$1$${nodeId}`;
  }

  /**
   * Configure address and distribution settings for an OPC UA datapoint element
   * Sets both _address and _distrib configs with OPC UA-specific parameters
   *
   * @param dpName - Full datapoint element name (e.g., 'MyDatapoint.Value')
   * @param connectionName - OPC UA connection name (with or without _ prefix)
   * @param reference - OPC UA NodeId reference (e.g., 'ns=2;s=MyVariable')
   * @param datatype - OPC UA transformation type (750-768, default: 750=DEFAULT)
   * @param direction - Address direction mode (0-15, default: 4=INPUT_POLL)
   * @param active - Activate address immediately (default: true)
   * @param managerNumber - Optional manager number (1-255). If not specified, auto-detected.
   * @param subscription - Optional poll group name. If not specified, uses '_DefaultPollingFast'.
   * @returns true on success
   * @throws Error with detailed message on failure
   */
  async addAddressConfig(
    dpName: string,
    connectionName: string,
    reference: string,
    datatype: number = OpcUaDatatype.DEFAULT,
    direction: number = DpAddressDirection.DPATTR_ADDR_MODE_INPUT_POLL,
    active: boolean = true,
    managerNumber?: number,
    subscription: string = 'DefaultPollingFast'
  ): Promise<boolean> {
    try {
      console.log(`Configuring OPC UA address for ${dpName}`);

      // 1. Validate datapoint exists
      const dpBaseName = dpName.split('.')[0];
      if (!dpBaseName || !this.checkDpExists(dpBaseName)) {
        throw new Error(
          `Datapoint ${dpName} does not exist. Please create it first.`
        );
      }

      // 2. Normalize connectionName (ensure _ prefix)
      const normalizedConnection = connectionName.startsWith('_')
        ? connectionName
        : `_${connectionName}`;

      // 3. Validate connection exists
      if (!this.checkDpExists(normalizedConnection)) {
        throw new Error(
          `OPC UA connection ${normalizedConnection} does not exist. ` +
          `Available connections: ${this.winccoa.dpNames('_OpcUAConnection*', '_OPCUAServer').join(', ')}`
        );
      }

      // 4. Get manager number: explicit or auto-detect
      let finalManagerNumber: number;

      if (managerNumber !== undefined) {
        await this.validateManagerNumberForConnection(managerNumber, normalizedConnection);
        finalManagerNumber = managerNumber;
        console.log(`Using explicitly specified manager number: ${finalManagerNumber}`);
      } else {
        finalManagerNumber = await this.getManagerNumberForConnection(normalizedConnection);
        console.log(`Auto-detected manager number: ${finalManagerNumber}`);
      }

      // 5. Validate datatype (750-768 for OPC UA)
      if (datatype < 750 || datatype > 768) {
        throw new Error(
          `Invalid OPC UA datatype ${datatype}. Must be between 750 and 768.\n` +
          `Common values:\n` +
          `  750 = DEFAULT (automatic detection)\n` +
          `  751 = BOOLEAN\n` +
          `  756 = INT32\n` +
          `  760 = FLOAT\n` +
          `  762 = STRING\n` +
          `See OpcUaDatatype enum for full list.`
        );
      }

      // 6. Validate direction (0-15)
      if (direction < 0 || direction > 15) {
        throw new Error(
          `Invalid address direction ${direction}. Must be between 0 and 15.\n` +
          `Common values:\n` +
          `  4 = INPUT_POLL (polled input, default)\n` +
          `  2 = INPUT_SPONT (spontaneous input)\n` +
          `  1 = OUTPUT (output)\n` +
          `See DpAddressDirection enum for full list.`
        );
      }

      // 7. Ensure subscription exists (create if necessary)
      const normalizedSubscription = await this.ensureSubscriptionExists(
        subscription,
        normalizedConnection
      );

      // 8. Build proper reference string (NO subscription in reference!)
      //    Subscription is specified in _poll_group attribute
      const fullReference = this.buildReferenceString(
        normalizedConnection,
        reference
      );

      // 9. Build DpAddressConfig with ALL required fields
      const addressConfig: DpAddressConfig = {
        _type: DpConfigType.DPCONFIG_PERIPH_ADDR_MAIN,
        _drv_ident: "OPCUA",
        // NOTE: _connection is intentionally NOT set for OPC UA (based on working config)
        _reference: fullReference,  // Full reference (single $ separators)
        _direction: direction,
        _datatype: datatype,        // CRITICAL: Transformation type
        _subindex: 0,               // Always 0 for OPC UA
        _internal: false,
        _lowlevel: true,
        _offset: 0,                 // No offset by default
        _poll_group: normalizedSubscription,  // Poll group name (used for both polling and spontaneous modes)
        _active: active             // Set active in the initial config
      };

      // 10. Build DpDistribConfig
      const distribConfig: DpDistribConfig = {
        _type: DpConfigType.DPCONFIG_DISTRIBUTION_INFO,
        _driver: finalManagerNumber
      };

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ OPC UA Address Configuration for: ${dpName.padEnd(30)} ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`  Connection: ${normalizedConnection}`);
      console.log(`  Poll Group: ${normalizedSubscription}`);
      console.log(`  Full Reference: ${fullReference}`);
      console.log(`  Original NodeId: ${reference}`);
      console.log(`  Datatype: ${datatype} (CRITICAL FIELD)`);
      console.log(`  Direction: ${direction}`);
      console.log(`  Manager: ${finalManagerNumber}`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Complete addressConfig object:                                 ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(JSON.stringify(addressConfig, null, 2));
      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ Complete distribConfig object:                                 ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      console.log(JSON.stringify(distribConfig, null, 2));
      console.log();

      // 11. Set BOTH _address and _distrib configs in a SINGLE ATOMIC operation
      //     CRITICAL: WinCC OA requires these to be set together!
      const configSuccess = await this.setAddressAndDistribConfig(dpName, addressConfig, distribConfig);
      if (!configSuccess) {
        throw new Error('Failed to set _address and _distrib configuration atomically');
      }

      console.log(`✓ Successfully configured OPC UA address for ${dpName}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error configuring OPC UA address for ${dpName}:`, errorMessage);
      throw error; // Re-throw for detailed error in MCP Tool
    }
  }

  /**
   * Create and configure an OPC UA client connection
   *
   * @param config - Configuration of the OPC UA connection
   * @returns Connection name on success, throws Error on failure
   */
  async addConnection(config: OpcUaConnectionConfig): Promise<string> {
    try {
      console.log('========================================');
      console.log('Starting OPC UA Connection Setup');
      console.log('========================================');

      // Validate configuration
      this.validateConnectionConfig(config);
      console.log('✓ Configuration validated');

      // Validate OPC UA driver existence and status
      const driverValidation = await this.validateOpcUaDriver(config.managerNumber);

      if (!driverValidation.valid) {
        throw new Error(driverValidation.error);
      }

      if (driverValidation.warnings && driverValidation.warnings.length > 0) {
        console.log('========================================');
        console.log('⚠️  Driver Validation Warnings:');
        console.log('========================================');
        driverValidation.warnings.forEach(warning => {
          console.warn(`⚠️  ${warning}`);
        });
        console.log('========================================');
      }

      console.log('✓ OPC UA driver validated');

      // Generate connection name if not specified
      const connectionName = config.connectionName || (await this.generateConnectionName());
      console.log(`✓ Connection name: ${connectionName}`);

      // Ensure that _OPCUA<managerNumber> exists
      const managerDpCreated = await this.ensureOpcUaManagerDpExists(config.managerNumber);
      if (!managerDpCreated) {
        throw new Error('Failed to ensure manager datapoint exists');
      }
      console.log(`✓ Manager datapoint _OPCUA${config.managerNumber} ready`);

      // Create connection datapoint
      const connectionDpCreated = await this.ensureConnectionDpExists(connectionName, '_OPCUAServer');
      if (!connectionDpCreated) {
        throw new Error('Failed to create connection datapoint');
      }
      console.log(`✓ Connection datapoint ${connectionName} ready`);

      // Configure connection
      const configured = await this.configureConnection(config, connectionName);
      if (!configured) {
        throw new Error('Failed to configure connection');
      }
      console.log(`✓ Connection configured`);

      // Register connection with manager
      const registered = await this.registerConnectionWithManager(config.managerNumber, connectionName);
      if (!registered) {
        throw new Error('Failed to register connection with manager');
      }
      console.log(`✓ Connection registered with _OPCUA${config.managerNumber}`);

      console.log('========================================');
      console.log('✓ OPC UA Connection Setup Complete');
      console.log(`  Connection: ${connectionName}`);
      console.log(`  Server: opc.tcp://${config.ipAddress}:${config.port}`);
      console.log(`  Manager: _OPCUA${config.managerNumber}`);
      console.log('========================================');

      return connectionName;
    } catch (error) {
      console.error('========================================');
      console.error('✗ OPC UA Connection Setup Failed');
      console.error('========================================');
      console.error(`Error: ${error}`);
      throw error;
    }
  }
}

// Default export
export default OpcUaConnection;

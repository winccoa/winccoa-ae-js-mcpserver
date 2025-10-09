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
  OPCUA_DEFAULTS
} from '../../types/index.js';

// Re-export enums and constants for backward compatibility
export { SecurityPolicy, MessageSecurityMode, OPCUA_DEFAULTS } from '../../types/index.js';

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

    // Validate connection name format - must start with underscore for OPC-UA
    if (config.connectionName !== undefined && !config.connectionName.startsWith('_')) {
      throw new Error(`Invalid connection name: '${config.connectionName}'. OPC-UA connection names must start with underscore (e.g., '_TestConnection')`);
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

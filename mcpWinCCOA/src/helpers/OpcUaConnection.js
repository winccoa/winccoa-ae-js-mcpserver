import { WinccoaManager } from 'winccoa-manager';
const winccoa = new WinccoaManager();

/**
 * Security Policy for OPC UA Connections
 * @enum {number}
 */
export const SecurityPolicy = {
  None: 0,
  Basic128Rsa15: 2,
  Basic256: 3,
  Basic256Sha256: 4,
  Aes128Sha256RsaOaep: 5,
  Aes256Sha256RsaPss: 6
};

/**
 * Message Security Mode for OPC UA Connections
 * @enum {number}
 */
export const MessageSecurityMode = {
  None: 0,
  Sign: 1,
  SignAndEncrypt: 2
};

/**
 * Default values for OPC UA Connection
 */
const OPCUA_DEFAULTS = {
  reconnectTimer: 10,
  securityPolicy: SecurityPolicy.None,
  messageSecurityMode: MessageSecurityMode.None,
  separator: '.',
  enableConnection: true
};

/**
 * Check if a datapoint exists
 * @param {string} dpName - Name of the datapoint
 * @returns {boolean} true if DP exists
 */
function checkDpExists(dpName) {
  try {
    return winccoa.dpExists(dpName);
  } catch (error) {
    console.error(`Error checking if datapoint ${dpName} exists:`, error);
    return false;
  }
}

/**
 * Generate a unique connection name
 * @returns {Promise<string>} Connection name in format _OpcUA<n>
 */
async function generateConnectionName() {
  let counter = 1;
  let dpName = `_OpcUAConnection${counter}`;

  // Find the next free number
  while (checkDpExists(dpName)) {
    counter++;
    dpName = `_OpcUAConnection${counter}`;
  }

  console.log(`Generated connection name: ${dpName}`);
  return dpName;
}

/**
 * Ensure that the _OPCUA<managerNumber> datapoint exists
 * @param {number} managerNumber - Manager number
 * @returns {Promise<boolean>} true on success
 */
async function ensureOpcUaManagerDpExists(managerNumber) {
  try {
    const dpName = `_OPCUA${managerNumber}`;

    if (checkDpExists(dpName)) {
      console.log(`Manager datapoint ${dpName} already exists`);
      return true;
    }

    console.log(`Creating manager datapoint ${dpName} of type _OPCUA`);
    const created = await winccoa.dpCreate(dpName, '_OPCUA');

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
 * Create the connection datapoint if it doesn't exist
 * @param {string} connectionName - Name of the connection
 * @returns {Promise<boolean>} true on success
 */
async function ensureConnectionDpExists(connectionName) {
  try {
    if (checkDpExists(connectionName)) {
      console.log(`Connection datapoint ${connectionName} already exists`);
      return true;
    }

    console.log(`Creating connection datapoint ${connectionName} of type _OPCUAServer`);
    const created = await winccoa.dpCreate(connectionName, '_OPCUAServer');

    if (!created) {
      console.error(`Failed to create connection datapoint ${connectionName}`);
      return false;
    }

    console.log(`Successfully created connection datapoint ${connectionName}`);
    return true;

  } catch (error) {
    console.error(`Error creating connection datapoint:`, error);
    return false;
  }
}

/**
 * Validate the OPC UA connection configuration
 * @param {Object} config - Configuration to validate
 * @throws {Error} on invalid configuration
 */
function validateConnectionConfig(config) {
  // Validate IP address
  if (!config.ipAddress || config.ipAddress.trim() === '') {
    throw new Error('IP address is required');
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;

  if (!ipRegex.test(config.ipAddress) && !hostnameRegex.test(config.ipAddress)) {
    throw new Error(`Invalid IP address or hostname: ${config.ipAddress}`);
  }

  // Validate port
  if (!config.port || config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port number: ${config.port}. Must be between 1 and 65535`);
  }

  // Validate manager number
  if (!config.managerNumber || config.managerNumber < 1 || config.managerNumber > 99) {
    throw new Error(`Invalid manager number: ${config.managerNumber}. Must be between 1 and 99`);
  }

  // Validate reconnect timer
  if (config.reconnectTimer !== undefined && config.reconnectTimer <= 0) {
    throw new Error('Reconnect timer must be positive');
  }

  // Validate security policy
  if (config.securityPolicy !== undefined && !Object.values(SecurityPolicy).includes(config.securityPolicy)) {
    throw new Error(`Invalid security policy: ${config.securityPolicy}`);
  }

  // Validate message security mode
  if (config.messageSecurityMode !== undefined && !Object.values(MessageSecurityMode).includes(config.messageSecurityMode)) {
    throw new Error(`Invalid message security mode: ${config.messageSecurityMode}`);
  }
}

/**
 * Register the connection with the OPC UA manager
 * @param {number} managerNumber - Manager number
 * @param {string} connectionName - Connection name (WITHOUT leading underscore)
 * @returns {Promise<boolean>} true on success
 */
async function registerConnectionWithManager(managerNumber, connectionName) {
  try {
    const managerDpName = `_OPCUA${managerNumber}`;

    // Connection name without leading underscore
    const nameWithoutUnderscore = connectionName.startsWith('_') ? connectionName.substring(1) : connectionName;

    // Get current server list
    const currentServersRaw = await winccoa.dpGet(`${managerDpName}.Config.Servers`);
    const currentServers = Array.isArray(currentServersRaw) ? currentServersRaw : [];

    // Check if connection is already registered
    if (currentServers.includes(nameWithoutUnderscore)) {
      console.log(`Connection ${nameWithoutUnderscore} already registered with manager ${managerNumber}`);
      return true;
    }

    // Add connection to the list
    currentServers.push(nameWithoutUnderscore);

    console.log(`Registering connection ${nameWithoutUnderscore} with manager ${managerNumber}`);
    await winccoa.dpSetWait(`${managerDpName}.Config.Servers`, currentServers);

    console.log(`Successfully registered connection ${nameWithoutUnderscore}`);
    return true;

  } catch (error) {
    console.error(`Error registering connection with manager:`, error);
    return false;
  }
}

/**
 * Configure the OPC UA connection
 * @param {Object} config - Connection configuration
 * @param {string} connectionName - Connection name
 * @returns {Promise<boolean>} true on success
 */
async function configureConnection(config, connectionName) {
  try {
    const serverUrl = `opc.tcp://${config.ipAddress}:${config.port}`;

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
      serverUrl,                                                    // ConnInfo
      config.username || '',                                        // AccessInfo (Username)
      config.password ? Buffer.from(config.password, 'utf-8') : Buffer.alloc(0), // Password (blob type)
      config.securityPolicy ?? OPCUA_DEFAULTS.securityPolicy,      // Security Policy
      config.messageSecurityMode ?? OPCUA_DEFAULTS.messageSecurityMode, // Message Mode
      config.clientCertificate || '',                               // Client Certificate
      config.enableConnection ?? OPCUA_DEFAULTS.enableConnection ? 1 : 0, // Active
      config.reconnectTimer ?? OPCUA_DEFAULTS.reconnectTimer,      // ReconnectTimer
      config.separator ?? OPCUA_DEFAULTS.separator,                // Separator
      0,                                                            // Flags (default)
      'opc.tcp://',                                                 // Redu.ConnInfo (empty)
      0                                                             // Redu.Active (inactive)
    ];

    const securityPolicyName = Object.keys(SecurityPolicy).find(key => SecurityPolicy[key] === (config.securityPolicy ?? OPCUA_DEFAULTS.securityPolicy)) || 'None';
    const messageModeName = Object.keys(MessageSecurityMode).find(key => MessageSecurityMode[key] === (config.messageSecurityMode ?? OPCUA_DEFAULTS.messageSecurityMode)) || 'None';

    console.log(`Configuring connection ${connectionName}:`);
    console.log(`- Server URL: ${serverUrl}`);
    console.log(`- Security Policy: ${securityPolicyName}`);
    console.log(`- Message Mode: ${messageModeName}`);
    console.log(`- Authentication: ${config.username ? 'Username/Password' : 'Anonymous'}`);
    console.log(`- Reconnect Timer: ${config.reconnectTimer ?? OPCUA_DEFAULTS.reconnectTimer} seconds`);

    // Set the configuration
    await winccoa.dpSetWait(dpes, values);

    console.log(`Successfully configured connection ${connectionName}`);
    return true;

  } catch (error) {
    console.error(`Error configuring connection:`, error);
    return false;
  }
}

/**
 * OPC UA Connection Manager Class
 */
class OpcUaConnection {
  constructor() {
    this.winccoa = new WinccoaManager();
  }

  /**
   * Generate a unique browse request ID
   * @returns {string} Unique request ID
   */
  generateBrowseRequestId() {
    return `browse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Browse the OPC UA address space
   *
   * @param {string} connectionName - Name of the connection (e.g., '_OpcUAConnection1')
   * @param {string} [parentNodeId] - Node ID of the parent node (optional, default: "ns=0;i=85" for Root)
   * @param {0|1|2} [eventSource=0] - 0=Value (default), 1=Event, 2=Alarm&Condition
   * @returns {Promise<Array>} Promise with array of browse nodes
   */
  async browse(connectionName, parentNodeId, eventSource = 0) {
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
        // dpConnect callback receives DPE names as strings, not values!
        // We need to fetch the actual values using dpGet
        const browseCallback = async (dpes) => {
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
            ]);

            const returnedRequestId = values[0];
            const displayNames = values[1];
            const browsePaths = values[2];
            const nodeIds = values[3];
            const dataTypes = values[4];
            const valueRanks = values[5];
            const nodeClasses = values[6];

            console.log(`Returned RequestId: ${returnedRequestId}, Expected: ${requestId}`);

            // Check if this is our request
            if (returnedRequestId !== requestId) {
              console.log(`RequestId mismatch, ignoring callback`);
              return; // Not our request, ignore
            }

            console.log(`RequestId matches, processing ${displayNames.length} nodes`);
            clearTimeout(timeout);

            // Build result array
            const results = [];

            for (let i = 0; i < displayNames.length; i++) {
              if (displayNames[i] && displayNames[i].length > 0) {
                results.push({
                  displayName: displayNames[i] || '',
                  browsePath: browsePaths[i] || '',
                  nodeId: nodeIds[i] || '',
                  dataType: dataTypes[i] || '',
                  valueRank: valueRanks && valueRanks[i] ? valueRanks[i] : undefined,
                  nodeClass: nodeClasses && nodeClasses[i] ? nodeClasses[i] : undefined
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
          false  // Don't send initial values
        );

        // Trigger browse request
        this.winccoa.dpSetWait(
          `${connDp}.Browse.GetBranch:_original.._value`,
          [requestId, startNode, level, eventSource]
        ).catch(reject);
      });

    } catch (error) {
      console.error(`Error browsing OPC UA connection:`, error);
      throw error;
    }
  }

  /**
   * Create and configure an OPC UA client connection
   *
   * @param {Object} config - Configuration of the OPC UA connection
   * @param {string} config.ipAddress - IP address of the OPC UA server
   * @param {number} config.port - Port of the OPC UA server
   * @param {number} config.managerNumber - Manager number of the OPC UA client (e.g., 4 for _OPCUA4)
   * @param {string} [config.connectionName] - Name of the connection (optional)
   * @param {number} [config.reconnectTimer] - Reconnect timer in seconds (optional, default: 10)
   * @param {number} [config.securityPolicy] - Security policy (optional, default: None)
   * @param {number} [config.messageSecurityMode] - Message security mode (optional, default: None)
   * @param {string} [config.username] - Username for authentication (optional)
   * @param {string} [config.password] - Password for authentication (optional)
   * @param {string} [config.clientCertificate] - Client certificate name (optional)
   * @param {string} [config.separator] - Separator for display names (optional, default: ".")
   * @param {boolean} [config.enableConnection] - Enable connection immediately (optional, default: true)
   * @returns {Promise<string>} Connection name on success, throws Error on failure
   *
   * @example
   * // Simple connection with auto-generated name
   * const connName = await opcua.addConnection({
   *   ipAddress: '10.2.42.117',
   *   port: 4725,
   *   managerNumber: 4
   * });
   *
   * @example
   * // Connection with custom name
   * const connName = await opcua.addConnection({
   *   ipAddress: '10.2.42.117',
   *   port: 4725,
   *   managerNumber: 4,
   *   connectionName: '_TunnelDigitalization'
   * });
   *
   * @example
   * // Connection with authentication
   * const connName = await opcua.addConnection({
   *   ipAddress: '192.168.1.100',
   *   port: 4840,
   *   managerNumber: 1,
   *   username: 'admin',
   *   password: 'secret',
   *   securityPolicy: SecurityPolicy.Basic256Sha256,
   *   messageSecurityMode: MessageSecurityMode.SignAndEncrypt
   * });
   */
  async addConnection(config) {
    try {
      console.log('========================================');
      console.log('Starting OPC UA Connection Setup');
      console.log('========================================');

      // Validate configuration
      validateConnectionConfig(config);
      console.log('✓ Configuration validated');

      // Generate connection name if not specified
      const connectionName = config.connectionName || await generateConnectionName();
      console.log(`✓ Connection name: ${connectionName}`);

      // Ensure that _OPCUA<managerNumber> exists
      const managerDpCreated = await ensureOpcUaManagerDpExists(config.managerNumber);
      if (!managerDpCreated) {
        throw new Error('Failed to ensure manager datapoint exists');
      }
      console.log(`✓ Manager datapoint _OPCUA${config.managerNumber} ready`);

      // Create connection datapoint
      const connectionDpCreated = await ensureConnectionDpExists(connectionName);
      if (!connectionDpCreated) {
        throw new Error('Failed to create connection datapoint');
      }
      console.log(`✓ Connection datapoint ${connectionName} ready`);

      // Configure connection
      const configured = await configureConnection(config, connectionName);
      if (!configured) {
        throw new Error('Failed to configure connection');
      }
      console.log(`✓ Connection configured`);

      // Register connection with manager
      const registered = await registerConnectionWithManager(config.managerNumber, connectionName);
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

// Exports
export {
  // Main class
  OpcUaConnection,

  // Helper functions (for advanced usage)
  generateConnectionName,
  ensureOpcUaManagerDpExists,
  ensureConnectionDpExists,
  validateConnectionConfig,
  registerConnectionWithManager,
  configureConnection
};

// Default export
export default OpcUaConnection;

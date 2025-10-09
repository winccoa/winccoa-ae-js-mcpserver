/**
 * Base Connection Class
 *
 * Abstract base class for all driver connections (OPC UA, S7Plus, BACnet, etc.).
 * Provides shared functionality and enforces common patterns.
 */

import { WinccoaManager } from 'winccoa-manager';

/**
 * Abstract base class for driver connections
 *
 * All driver-specific connection classes must extend this class.
 * Provides common helper methods for datapoint management and validation.
 *
 * Future extension: Will include abstract addAddressConfig() method
 */
export abstract class BaseConnection {
  /** WinCC OA manager instance */
  protected winccoa: WinccoaManager;

  constructor() {
    this.winccoa = new WinccoaManager();
  }

  /**
   * Check if a datapoint exists
   * @param dpName - Name of the datapoint
   * @returns true if datapoint exists
   */
  protected checkDpExists(dpName: string): boolean {
    try {
      return this.winccoa.dpExists(dpName);
    } catch (error) {
      console.error(`Error checking if datapoint ${dpName} exists:`, error);
      return false;
    }
  }

  /**
   * Ensure that a connection datapoint exists, create if necessary
   * @param dpName - Name of the datapoint
   * @param dpType - Type of the datapoint (e.g., '_OPCUAServer', '_S7PlusConnection')
   * @returns true if datapoint exists or was created successfully
   */
  protected async ensureConnectionDpExists(dpName: string, dpType: string): Promise<boolean> {
    try {
      if (this.checkDpExists(dpName)) {
        console.log(`Connection datapoint ${dpName} already exists`);
        return true;
      }

      console.log(`Creating connection datapoint ${dpName} of type ${dpType}`);
      const created = await this.winccoa.dpCreate(dpName, dpType);

      if (!created) {
        console.error(`Failed to create connection datapoint ${dpName}`);
        return false;
      }

      console.log(`Successfully created connection datapoint ${dpName}`);
      return true;
    } catch (error) {
      console.error(`Error creating connection datapoint ${dpName}:`, error);
      return false;
    }
  }

  /**
   * Validate IP address or hostname
   * @param ipAddress - IP address or hostname to validate
   * @returns true if valid
   */
  protected validateIpAddress(ipAddress: string): boolean {
    if (!ipAddress || ipAddress.trim() === '') {
      return false;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;

    return ipRegex.test(ipAddress) || hostnameRegex.test(ipAddress);
  }

  /**
   * Validate port number
   * @param port - Port number to validate
   * @returns true if valid (1-65535)
   */
  protected validatePort(port: number): boolean {
    return port >= 1 && port <= 65535;
  }

  /**
   * Validate manager/driver number
   * @param num - Manager number to validate
   * @returns true if valid (1-99)
   */
  protected validateManagerNumber(num: number): boolean {
    return num >= 1 && num <= 99;
  }

  /**
   * Generate a unique connection name with a given prefix
   * @param prefix - Prefix for the connection name (e.g., '_OpcUAConnection', '_S7Connection')
   * @returns Unique connection name
   */
  protected async generateConnectionName(prefix: string): Promise<string> {
    let counter = 1;
    let dpName = `${prefix}${counter}`;

    // Find the next free number
    while (this.checkDpExists(dpName)) {
      counter++;
      dpName = `${prefix}${counter}`;
    }

    console.log(`Generated connection name: ${dpName}`);
    return dpName;
  }
}

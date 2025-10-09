/**
 * Base Connection Class
 *
 * Abstract base class for all driver connections (OPC UA, S7Plus, BACnet, etc.).
 * Provides shared functionality and enforces common patterns.
 */

import { WinccoaManager } from 'winccoa-manager';
import type { DpAddressConfig, DpDistribConfig } from '../../types/index.js';

/**
 * Abstract base class for driver connections
 *
 * All driver-specific connection classes must extend this class.
 * Provides common helper methods for datapoint management and validation.
 */
export abstract class BaseConnection {
  /** WinCC OA manager instance */
  protected winccoa: WinccoaManager;

  constructor() {
    this.winccoa = new WinccoaManager();
  }

  /**
   * Protected method to set address configuration (common implementation)
   * Sets all address fields
   *
   * @param dpName - Full datapoint element name (e.g., 'MyDP.Value')
   * @param config - Address configuration
   * @returns true on success, false on failure
   */
  protected async setAddressConfig(dpName: string, config: DpAddressConfig): Promise<boolean> {
    try {
      // Build the address configuration datapoints
      const dpes = [
        `${dpName}:_address.._type`,
        `${dpName}:_address.._drv_ident`,
        `${dpName}:_address.._connection`,
        `${dpName}:_address.._reference`,
        `${dpName}:_address.._internal`,
        `${dpName}:_address.._direction`
      ];

      const values = [
        config._type,
        config._drv_ident,
        config._connection,
        config._reference,
        config._internal,
        config._direction
      ];

      // Add optional _active if provided
      if (config._active !== undefined) {
        dpes.push(`${dpName}:_address.._active`);
        values.push(config._active);
      }

      console.log(`Setting address config for ${dpName}:`);
      console.log(`- Type: ${config._type}`);
      console.log(`- Driver: ${config._drv_ident}`);
      console.log(`- Connection: ${config._connection}`);
      console.log(`- Reference: ${config._reference}`);

      // Apply configuration using dpSetWait for synchronous execution
      await this.winccoa.dpSetWait(dpes, values);

      console.log(`Successfully configured address for ${dpName}`);
      return true;
    } catch (error) {
      console.error(`Error configuring address for ${dpName}:`, error);
      return false;
    }
  }

  /**
   * Protected method to set distribution config (manager allocation)
   * This is a separate config parallel to _address
   *
   * @param dpName - Full datapoint element name (e.g., 'MyDP.Value')
   * @param config - Distribution configuration
   * @returns true on success, false on failure
   */
  protected async setDistribConfig(dpName: string, config: DpDistribConfig): Promise<boolean> {
    try {
      const dpes = [
        `${dpName}:_distrib.._type`,
        `${dpName}:_distrib.._driver`
      ];

      const values = [
        config._type,
        config._driver
      ];

      console.log(`Setting distrib config for ${dpName}:`);
      console.log(`- Type: ${config._type}`);
      console.log(`- Driver: ${config._driver}`);

      // Apply configuration using dpSetWait for synchronous execution
      await this.winccoa.dpSetWait(dpes, values);

      console.log(`Successfully configured distrib for ${dpName}`);
      return true;
    } catch (error) {
      console.error(`Error configuring distrib for ${dpName}:`, error);
      return false;
    }
  }

  /**
   * Configure address settings for a datapoint
   * Must be implemented by each driver-specific class with driver-specific parameters
   *
   * Note: Each driver implements this with its own signature based on driver requirements.
   * This method should handle validation and call setAddressConfig() and setDistribConfig().
   */
  abstract addAddressConfig(...args: any[]): Promise<boolean>;

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

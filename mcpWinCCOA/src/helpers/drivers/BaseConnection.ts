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
        `${dpName}:_address.._direction`,
        `${dpName}:_address.._datatype`,
        `${dpName}:_address.._subindex`
      ];

      const values: any[] = [
        config._type,
        config._drv_ident,
        config._connection,
        config._reference,
        config._internal,
        config._direction,
        config._datatype,
        config._subindex
      ];

      // Add optional fields if provided
      if (config._lowlevel !== undefined) {
        dpes.push(`${dpName}:_address.._lowlevel`);
        values.push(config._lowlevel);
      }

      if (config._offset !== undefined) {
        dpes.push(`${dpName}:_address.._offset`);
        values.push(config._offset);
      }

      if (config._poll_group !== undefined) {
        dpes.push(`${dpName}:_address.._poll_group`);
        values.push(config._poll_group);
      }

      // Note: _active is typically set separately via dpSet after address config
      if (config._active !== undefined) {
        dpes.push(`${dpName}:_address.._active`);
        values.push(config._active);
      }

      console.log(`\n========================================`);
      console.log(`Setting address config for ${dpName}:`);
      console.log(`========================================`);
      console.log(`- Type: ${config._type}`);
      console.log(`- Driver: ${config._drv_ident}`);
      console.log(`- Connection: ${config._connection}`);
      console.log(`- Reference: ${config._reference}`);
      console.log(`- Datatype: ${config._datatype} (CRITICAL FIELD!)`);
      console.log(`- Direction: ${config._direction}`);
      console.log(`- Subindex: ${config._subindex}`);
      console.log(`- Internal: ${config._internal}`);
      if (config._lowlevel !== undefined) {
        console.log(`- Lowlevel: ${config._lowlevel}`);
      }
      if (config._offset !== undefined) {
        console.log(`- Offset: ${config._offset}`);
      }
      if (config._poll_group !== undefined) {
        console.log(`- Poll Group: ${config._poll_group}`);
      }
      if (config._active !== undefined) {
        console.log(`- Active: ${config._active}`);
      }

      console.log(`\nExecuting dpSetWait with ${dpes.length} attributes:`);
      for (let i = 0; i < dpes.length; i++) {
        console.log(`  [${i}] ${dpes[i]} = ${JSON.stringify(values[i])}`);
      }
      console.log(`========================================\n`);

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
   * Protected method to set BOTH address and distribution configs in a single atomic operation
   * CRITICAL: WinCC OA requires _address and _distrib to be set together atomically!
   *
   * @param dpName - Full datapoint element name (e.g., 'MyDP.Value')
   * @param addressConfig - Address configuration
   * @param distribConfig - Distribution configuration
   * @returns true on success, false on failure
   */
  protected async setAddressAndDistribConfig(
    dpName: string,
    addressConfig: DpAddressConfig,
    distribConfig: DpDistribConfig
  ): Promise<boolean> {
    try {
      // Build COMBINED datapoint list for BOTH _distrib AND _address
      // CRITICAL: Must set _distrib first, then _address (as per reference implementation)
      const dpes: string[] = [
        // _distrib config first
        `${dpName}:_distrib.._type`,
        `${dpName}:_distrib.._driver`,
        // _address config
        `${dpName}:_address.._type`,
        `${dpName}:_address.._drv_ident`,
        `${dpName}:_address.._reference`,
        `${dpName}:_address.._direction`,
        `${dpName}:_address.._datatype`,
        `${dpName}:_address.._subindex`,
        `${dpName}:_address.._internal`
      ];

      const values: any[] = [
        // _distrib values
        distribConfig._type,
        distribConfig._driver,
        // _address values
        addressConfig._type,
        addressConfig._drv_ident,
        addressConfig._reference,
        addressConfig._direction,
        addressConfig._datatype,
        addressConfig._subindex,
        addressConfig._internal
      ];

      // Add optional address fields if provided
      if (addressConfig._connection !== undefined) {
        dpes.push(`${dpName}:_address.._connection`);
        values.push(addressConfig._connection);
      }

      if (addressConfig._lowlevel !== undefined) {
        dpes.push(`${dpName}:_address.._lowlevel`);
        values.push(addressConfig._lowlevel);
      }

      if (addressConfig._offset !== undefined) {
        dpes.push(`${dpName}:_address.._offset`);
        values.push(addressConfig._offset);
      }

      if (addressConfig._poll_group !== undefined) {
        dpes.push(`${dpName}:_address.._poll_group`);
        values.push(addressConfig._poll_group);
      }

      if (addressConfig._active !== undefined) {
        dpes.push(`${dpName}:_address.._active`);
        values.push(addressConfig._active);
      }

      console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
      console.log(`║ ATOMIC CONFIG: Setting _distrib + _address for ${dpName.padEnd(17)} ║`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ _distrib config:                                               ║`);
      console.log(`  - Type: ${distribConfig._type}`);
      console.log(`  - Driver: ${distribConfig._driver}`);
      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ _address config:                                               ║`);
      console.log(`  - Type: ${addressConfig._type}`);
      console.log(`  - Driver: ${addressConfig._drv_ident}`);
      if (addressConfig._connection !== undefined) {
        console.log(`  - Connection: ${addressConfig._connection}`);
      }
      console.log(`  - Reference: ${addressConfig._reference}`);
      console.log(`  - Datatype: ${addressConfig._datatype} ⚠️  CRITICAL FIELD!`);
      console.log(`  - Direction: ${addressConfig._direction}`);
      console.log(`  - Subindex: ${addressConfig._subindex}`);
      console.log(`  - Internal: ${addressConfig._internal}`);
      if (addressConfig._lowlevel !== undefined) {
        console.log(`  - Lowlevel: ${addressConfig._lowlevel}`);
      }
      if (addressConfig._offset !== undefined) {
        console.log(`  - Offset: ${addressConfig._offset}`);
      }
      if (addressConfig._poll_group !== undefined) {
        console.log(`  - Poll Group: ${addressConfig._poll_group}`);
      }
      if (addressConfig._active !== undefined) {
        console.log(`  - Active: ${addressConfig._active}`);
      }

      console.log(`╠════════════════════════════════════════════════════════════════╣`);
      console.log(`║ Executing SINGLE ATOMIC dpSetWait with ${dpes.length} attributes:        ║`);
      console.log(`╚════════════════════════════════════════════════════════════════╝`);
      for (let i = 0; i < dpes.length; i++) {
        console.log(`  [${i.toString().padStart(2)}] ${dpes[i]} = ${JSON.stringify(values[i])}`);
      }
      console.log(`════════════════════════════════════════════════════════════════\n`);

      // Apply BOTH configurations using a SINGLE dpSetWait call (ATOMIC OPERATION)
      await this.winccoa.dpSetWait(dpes, values);

      console.log(`✓ Successfully configured _distrib + _address atomically for ${dpName}\n`);
      return true;
    } catch (error) {
      console.error(`✗ Error configuring _distrib + _address for ${dpName}:`, error);
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

      console.log(`\n========================================`);
      console.log(`Setting distrib config for ${dpName}:`);
      console.log(`========================================`);
      console.log(`- Type: ${config._type}`);
      console.log(`- Driver: ${config._driver}`);

      console.log(`\nExecuting dpSetWait with ${dpes.length} attributes:`);
      for (let i = 0; i < dpes.length; i++) {
        console.log(`  [${i}] ${dpes[i]} = ${JSON.stringify(values[i])}`);
      }
      console.log(`========================================\n`);

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

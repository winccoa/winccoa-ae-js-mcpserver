/**
 * Pmon TCP Client
 *
 * Client for communicating with WinCC OA Process Monitor (Pmon) via TCP protocol.
 * Supports all Pmon commands for manager administration.
 */

import * as net from 'net';
import type {
  PmonConfig,
  PmonResponse,
  PmonStatus,
  PmonManager,
  ManagerProperties,
  ManagerListEntry,
  ManagerState,
  ManagerStartMode
} from '../../types/pmon/protocol.js';

export class PmonClient {
  private host: string;
  private port: number;
  private user: string;
  private password: string;
  private timeout: number;

  constructor(config: PmonConfig = {}) {
    this.host = config.host || process.env.WINCCOA_PMON_HOST || 'localhost';
    this.port = config.port || parseInt(process.env.WINCCOA_PMON_PORT || '4999', 10);
    this.user = config.user || process.env.WINCCOA_PMON_USER || '';
    this.password = config.password || process.env.WINCCOA_PMON_PASSWORD || '';
    this.timeout = config.timeout || 5000;
  }

  /**
   * Send a command to Pmon via TCP
   * @param command - The Pmon protocol command to send
   * @returns Promise with the raw response string
   */
  private async sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let response = '';
      let dataReceived = false;

      // Build authentication prefix
      // According to docs: user#cleartextPassword#<command>
      // If no user/password, use ##<command>
      const authPrefix = (this.user || this.password)
        ? `${this.user}#${this.password}#`
        : '##';

      const fullCommand = authPrefix + command;

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        client.destroy();

        // If we received data, return it instead of timing out
        if (dataReceived && response.length > 0) {
          resolve(response);
        } else {
          reject(new Error(`Connection timeout after ${this.timeout}ms`));
        }
      }, this.timeout);

      // Connect to Pmon
      client.connect(this.port, this.host, () => {
        client.write(fullCommand + '\n');
      });

      // Receive data
      client.on('data', (data) => {
        dataReceived = true;
        response += data.toString();

        // Check if response looks complete (ends with semicolon on its own line for LIST commands)
        // or if it's a simple response that's complete
        if (response.includes('\n;') || response.endsWith(';')) {
          clearTimeout(timeoutHandle);
          client.end();
          resolve(response);
        }
      });

      // Connection closed by server
      client.on('end', () => {
        clearTimeout(timeoutHandle);
        if (dataReceived) {
          resolve(response);
        }
      });

      // Handle errors
      client.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Pmon connection error: ${err.message}`));
      });
    });
  }

  /**
   * Get list of all managers with their status
   * @returns Promise with parsed manager status
   */
  async getManagerStatus(): Promise<PmonStatus> {
    try {
      const response = await this.sendCommand('MGRLIST:STATI');
      return this.parseManagerStatus(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get manager status: ${errorMessage}`);
    }
  }

  /**
   * Get list of all managers with their configuration
   * @returns Promise with manager list
   */
  async getManagerList(): Promise<ManagerListEntry[]> {
    try {
      const response = await this.sendCommand('MGRLIST:LIST');
      return this.parseManagerList(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get manager list: ${errorMessage}`);
    }
  }

  /**
   * Add a new manager to the Pmon configuration
   * @param index - Position where to insert (1-based, 0 is Pmon itself)
   * @param manager - Manager name (without .exe extension)
   * @param startMode - Start mode: manual, once, or always
   * @param secKill - Seconds to wait before SIGKILL (default: 30)
   * @param restartCount - Number of restart attempts (default: 3)
   * @param resetMin - Minutes to reset restart counter (default: 5)
   * @param options - Command line options (default: '')
   * @returns Promise with operation result
   */
  async addManager(
    index: number,
    manager: string,
    startMode: 'manual' | 'once' | 'always' = 'always',
    secKill: number = 30,
    restartCount: number = 3,
    resetMin: number = 5,
    options: string = ''
  ): Promise<PmonResponse> {
    try {
      // Validate inputs
      if (index < 1 || index > 100) {
        throw new Error('Manager index must be between 1 and 100');
      }
      if (!manager || manager.trim() === '') {
        throw new Error('Manager name is required');
      }

      const command = `SINGLE_MGR:INS ${index} ${manager} ${startMode} ${secKill} ${restartCount} ${resetMin} ${options}`;
      const response = await this.sendCommand(command);

      return {
        success: true,
        data: response.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Remove a manager from the Pmon configuration
   * @param index - Manager index to remove (1-based)
   * @returns Promise with operation result
   */
  async removeManager(index: number): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1 (cannot remove Pmon itself)');
      }

      const command = `SINGLE_MGR:DEL ${index}`;
      const response = await this.sendCommand(command);

      return {
        success: true,
        data: response.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Start a manager
   * @param index - Manager index to start (1-based)
   * @returns Promise with operation result
   */
  async startManager(index: number): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      const command = `SINGLE_MGR:START ${index}`;
      const response = await this.sendCommand(command);

      return {
        success: true,
        data: response.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Stop a manager (sends SIGTERM)
   * @param index - Manager index to stop (1-based)
   * @returns Promise with operation result
   */
  async stopManager(index: number): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      const command = `SINGLE_MGR:STOP ${index}`;
      const response = await this.sendCommand(command);

      return {
        success: true,
        data: response.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Kill a manager (sends SIGKILL)
   * @param index - Manager index to kill (1-based)
   * @returns Promise with operation result
   */
  async killManager(index: number): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      const command = `SINGLE_MGR:KILL ${index}`;
      const response = await this.sendCommand(command);

      return {
        success: true,
        data: response.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get manager properties
   * @param index - Manager index (1-based)
   * @returns Promise with manager properties
   */
  async getManagerProperties(index: number): Promise<ManagerProperties> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      const command = `SINGLE_MGR:PROP_GET ${index}`;
      const response = await this.sendCommand(command);

      return this.parseManagerProperties(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get manager properties: ${errorMessage}`);
    }
  }

  /**
   * Update manager properties
   * @param index - Manager index (1-based)
   * @param startMode - Start mode: manual, once, or always
   * @param secKill - Seconds to wait before SIGKILL
   * @param restartCount - Number of restart attempts
   * @param resetMin - Minutes to reset restart counter
   * @param options - Command line options
   * @returns Promise with operation result
   */
  async updateManagerProperties(
    index: number,
    startMode: 'manual' | 'once' | 'always',
    secKill: number,
    restartCount: number,
    resetMin: number,
    options: string = ''
  ): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      const command = `SINGLE_MGR:PROP_PUT ${index} ${startMode} ${secKill} ${restartCount} ${resetMin} ${options}`;
      const response = await this.sendCommand(command);

      return {
        success: true,
        data: response.trim()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Parse MGRLIST:STATI response into structured data
   * @param response - Raw response from Pmon
   * @returns Parsed manager status
   */
  private parseManagerStatus(response: string): PmonStatus {
    const lines = response.trim().split('\n');
    const managers: PmonManager[] = [];

    // First line should be "LIST:<count>"
    if (!lines[0] || !lines[0].startsWith('LIST:')) {
      throw new Error(`Invalid MGRLIST:STATI response format. First line: ${JSON.stringify(lines[0])}`);
    }

    const count = parseInt(lines[0].substring(5), 10);

    // Parse manager lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();

      // Skip empty lines
      if (!line) continue;

      // Check for status line (ends with ;)
      if (line.endsWith(';')) {
        // This is the final status line
        const parts = line.slice(0, -1).trim().split(/\s+/);
        return {
          managers,
          modeNumeric: parseInt(parts[0] || '0', 10),
          modeString: parts[1] || 'UNKNOWN',
          emergencyActive: parseInt(parts[2] || '0', 10),
          demoModeActive: parseInt(parts[3] || '0', 10)
        };
      }

      // Parse manager line: <state>;<PID>;<startMode>;<startTime>;<manNum>
      const parts = line.split(';');
      if (parts.length >= 5) {
        managers.push({
          index: i - 1, // Index in the list
          state: parseInt(parts[0] || '0', 10) as ManagerState,
          pid: parseInt(parts[1] || '0', 10),
          startMode: parseInt(parts[2] || '0', 10) as ManagerStartMode,
          startTime: parts[3] || '',
          manNum: parseInt(parts[4] || '0', 10)
        });
      }
    }

    // Default return if parsing didn't complete normally
    return {
      managers,
      modeNumeric: 0,
      modeString: 'UNKNOWN',
      emergencyActive: 0,
      demoModeActive: 0
    };
  }

  /**
   * Parse MGRLIST:LIST response into structured data
   * @param response - Raw response from Pmon
   * @returns Parsed manager list
   */
  private parseManagerList(response: string): ManagerListEntry[] {
    const lines = response.trim().split('\n');
    const managers: ManagerListEntry[] = [];

    // First line should be "LIST:<count>"
    if (!lines[0] || !lines[0].startsWith('LIST:')) {
      throw new Error('Invalid MGRLIST:LIST response format');
    }

    // Parse manager lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();

      // Skip empty lines and terminator
      if (!line || line === ';') continue;

      // Parse manager line: <manager>;<startMode>;<secKill>;<restartCount>;<resetMin>;<CommandlineOptions>
      const parts = line.split(';');
      if (parts.length >= 5) {
        managers.push({
          index: i - 1,
          manager: parts[0] || '',
          startMode: parts[1] || '',
          secKill: parseInt(parts[2] || '0', 10),
          restartCount: parseInt(parts[3] || '0', 10),
          resetMin: parseInt(parts[4] || '0', 10),
          commandlineOptions: parts.slice(5).join(';') // Rejoin in case options contain semicolons
        });
      }
    }

    return managers;
  }

  /**
   * Parse SINGLE_MGR:PROP_GET response into structured data
   * @param response - Raw response from Pmon
   * @returns Parsed manager properties
   */
  private parseManagerProperties(response: string): ManagerProperties {
    const parts = response.trim().split(/\s+/);

    if (parts.length < 4) {
      throw new Error('Invalid PROP_GET response format');
    }

    return {
      startMode: parts[0] || '',
      secKill: parseInt(parts[1] || '0', 10),
      restartCount: parseInt(parts[2] || '0', 10),
      resetMin: parseInt(parts[3] || '0', 10),
      commandlineOptions: parts.slice(4).join(' ')
    };
  }
}

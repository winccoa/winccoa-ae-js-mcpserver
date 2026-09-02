/**
 * Pmon TCP Client
 *
 * Client for communicating with WinCC OA Process Monitor (Pmon) via TCP protocol.
 * Supports all Pmon commands for manager administration.
 */

import * as log from '../../utils/logger.js';
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
   * @param ownManagerNumber - Optional: Own manager number to prevent self-stop
   * @returns Promise with operation result
   */
  async stopManager(index: number, ownManagerNumber?: number | null): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      // Safety check: prevent stopping own manager
      if (ownManagerNumber !== undefined && ownManagerNumber !== null) {
        try {
          console.log(`🔒 [DEBUG] stopManager: Safety check - ownManagerNumber=${ownManagerNumber}, targetIndex=${index}`);
          const managerStatus = await this.getManagerStatus();

          // Find the manager by its index field, not array position
          const targetManager = managerStatus.managers.find(m => m.index === index);
          console.log(`🔒 [DEBUG] stopManager: Target manager found:`, targetManager ? `index=${targetManager.index}, manNum=${targetManager.manNum}, pid=${targetManager.pid}` : 'NOT FOUND');

          if (targetManager && targetManager.manNum === ownManagerNumber) {
            console.log(`🚫 [DEBUG] stopManager: BLOCKED! Attempt to stop own manager detected!`);
            return {
              success: false,
              error: `Cannot stop own manager (index ${index}, manager number ${ownManagerNumber}). This would terminate the MCP server and prevent any response.`
            };
          }
          console.log(`✅ [DEBUG] stopManager: Safety check passed, different manager`);
        } catch (checkError) {
          // If we can't verify, log warning but continue (better safe than sorry approach)
          console.warn('Could not verify manager identity for safety check:', checkError);
        }
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
   * @param ownManagerNumber - Optional: Own manager number to prevent self-kill
   * @returns Promise with operation result
   */
  async killManager(index: number, ownManagerNumber?: number | null): Promise<PmonResponse> {
    try {
      if (index < 1) {
        throw new Error('Manager index must be at least 1');
      }

      // Safety check: prevent killing own manager
      if (ownManagerNumber !== undefined && ownManagerNumber !== null) {
        try {
          console.log(`🔒 [DEBUG] killManager: Safety check - ownManagerNumber=${ownManagerNumber}, targetIndex=${index}`);
          const managerStatus = await this.getManagerStatus();

          // Find the manager by its index field, not array position
          const targetManager = managerStatus.managers.find(m => m.index === index);
          console.log(`🔒 [DEBUG] killManager: Target manager found:`, targetManager ? `index=${targetManager.index}, manNum=${targetManager.manNum}, pid=${targetManager.pid}` : 'NOT FOUND');

          if (targetManager && targetManager.manNum === ownManagerNumber) {
            console.log(`🚫 [DEBUG] killManager: BLOCKED! Attempt to kill own manager detected!`);
            return {
              success: false,
              error: `Cannot kill own manager (index ${index}, manager number ${ownManagerNumber}). This would terminate the MCP server and prevent any response.`
            };
          }
          console.log(`✅ [DEBUG] killManager: Safety check passed, different manager`);
        } catch (checkError) {
          // If we can't verify, log warning but continue (better safe than sorry approach)
          console.warn('Could not verify manager identity for safety check:', checkError);
        }
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
    // Two attempts at fixing the always-UNKNOWN project mode have now been wrong,
    // both made without seeing the actual payload. Log it verbatim so the format
    // can be read rather than inferred: set MCP_LOG_LEVEL=debug and call
    // list-managers once.
    log.debug(`Pmon MGRLIST:STATI raw response: ${JSON.stringify(response)}`);

    const lines = response.trim().split('\n');
    const managers: PmonManager[] = [];

    // First line should be "LIST:<count>"
    if (!lines[0] || !lines[0].startsWith('LIST:')) {
      throw new Error(`Invalid MGRLIST:STATI response format. First line: ${JSON.stringify(lines[0])}`);
    }

    const count = parseInt(lines[0].substring(5), 10);

    // Parse the response. Real payload for a 13-manager project:
    //
    //   LIST:13
    //   2;13240;0;2026.09.02 09:04:34.264;  1     <- manager, semicolon-separated
    //   ... 13 of these ...
    //   2 MONITOR_MODE 0 0                        <- project status, WHITESPACE-separated
    //   ;                                         <- bare terminator
    //
    // The status line carries no semicolons, so an earlier version failed the
    // ">= 5 semicolon fields" manager test and skipped it, then mistook the bare
    // ';' terminator for the status line - giving an empty body and a permanent
    // mode of UNKNOWN/0 while Pmon was answering normally.
    let status: Pick<PmonStatus, 'modeNumeric' | 'modeString' | 'emergencyActive' | 'demoModeActive'> | null = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();

      // Skip blank lines and the bare ';' terminator.
      if (!line || line === ';') continue;

      // Manager line: <state>;<PID>;<startMode>;<startTime>;<manNum>
      const fields = line.split(';');
      if (fields.length >= 5) {
        managers.push({
          index: managers.length,
          state: parseInt(fields[0] || '0', 10) as ManagerState,
          pid: parseInt(fields[1] || '0', 10),
          startMode: parseInt(fields[2] || '0', 10) as ManagerStartMode,
          startTime: (fields[3] || '').trim(),
          manNum: parseInt(fields[4] || '0', 10)
        });
        continue;
      }

      // Otherwise: the project status line, e.g. "2 MONITOR_MODE 0 0".
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        status = {
          modeNumeric: parseInt(parts[0] || '0', 10),
          modeString: (parts[1] || '').trim() || 'UNKNOWN',
          emergencyActive: parseInt(parts[2] || '0', 10),
          demoModeActive: parseInt(parts[3] || '0', 10)
        };
        log.debug(`Pmon project status: ${JSON.stringify(status)} (from ${JSON.stringify(line)})`);
        continue;
      }

      log.debug(`Pmon MGRLIST:STATI: unrecognised line skipped: ${JSON.stringify(line)}`);
    }

    if (managers.length !== count) {
      log.warn(`Pmon announced ${count} manager(s) but ${managers.length} were parsed`);
    }

    if (!status) {
      log.warn(
        'Pmon MGRLIST:STATI: no project status line found, reporting UNKNOWN. ' +
          'Run with MCP_LOG_LEVEL=debug to see the raw response.'
      );
    }

    return {
      managers,
      modeNumeric: status?.modeNumeric ?? 0,
      modeString: status?.modeString ?? 'UNKNOWN',
      emergencyActive: status?.emergencyActive ?? 0,
      demoModeActive: status?.demoModeActive ?? 0
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

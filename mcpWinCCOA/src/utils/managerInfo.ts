/**
 * Manager Information Utilities
 *
 * Utilities for retrieving information about the current JavaScript manager instance.
 * Uses process PID and PMON status to identify the own manager.
 */

import { PmonClient } from '../helpers/pmon/PmonClient.js';

/**
 * Get the manager number by matching process PID with PMON status.
 *
 * This function retrieves the current process PID and matches it against
 * the running managers in PMON to find the manager number.
 *
 * @returns Promise with the manager number if found, null otherwise
 */
export async function getOwnManagerNumber(): Promise<number | null> {
  try {
    // Get current process PID
    const currentPid = process.pid;

    // Get manager status from PMON
    const pmonClient = new PmonClient();
    const managerStatus = await pmonClient.getManagerStatus();

    // Find manager with matching PID
    for (const manager of managerStatus.managers) {
      if (manager.pid === currentPid) {
        return manager.manNum;
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get own manager number:', error);
    return null;
  }
}

/**
 * Cached manager number to avoid repeated PMON calls
 */
let cachedManagerNumber: number | null | undefined = undefined;

/**
 * Get the manager number with caching.
 * First call matches PID with PMON, subsequent calls return cached value.
 *
 * @returns Promise with the manager number if found, null otherwise
 */
export async function getOwnManagerNumberCached(): Promise<number | null> {
  if (cachedManagerNumber === undefined) {
    cachedManagerNumber = await getOwnManagerNumber();
  }
  return cachedManagerNumber;
}

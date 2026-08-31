/**
 * Mock WinccoaManager for unit tests
 *
 * This fixture provides a mock implementation of the winccoa-manager package
 * so that tests can run in CI environments without WinCC OA installed.
 * The vitest.config.ts aliases 'winccoa-manager' to this file.
 */

import { vi } from 'vitest';

/**
 * Construction bookkeeping.
 *
 * The real WinccoaManager is a SCADA handle with no close()/dispose(), so
 * exactly one may exist per process. Tests assert on `constructions` to prove
 * the per-request server refactor did not turn it into a per-request handle.
 *
 * `failNextConstruction` makes the next `new WinccoaManager()` throw, so the
 * memoisation-must-not-cache-failures path can be exercised.
 */
export const managerStats = {
  constructions: 0,
  failNextConstruction: false,
  reset(): void {
    this.constructions = 0;
    this.failNextConstruction = false;
  }
};

export class WinccoaManager {
  constructor() {
    if (managerStats.failNextConstruction) {
      managerStats.failNextConstruction = false;
      throw new Error('mock WinccoaManager: construction failed on purpose');
    }
    managerStats.constructions++;
  }

  dpExists = vi.fn().mockReturnValue(false);
  dpCreate = vi.fn().mockResolvedValue(true);
  dpDelete = vi.fn().mockResolvedValue(true);
  dpGet = vi.fn().mockResolvedValue(null);
  dpSet = vi.fn().mockReturnValue(true);
  dpSetWait = vi.fn().mockResolvedValue(undefined);
  dpConnect = vi.fn().mockReturnValue(1);
  dpDisconnect = vi.fn();
  dpNames = vi.fn().mockReturnValue([]);
  dpTypes = vi.fn().mockReturnValue([]);
  dpTypeGet = vi.fn().mockReturnValue(null);
  dpTypeName = vi.fn().mockReturnValue('');
  dpTypeCreate = vi.fn().mockResolvedValue(true);
  dpGetUnit = vi.fn().mockReturnValue('');
  dpGetDescription = vi.fn().mockReturnValue('');
}

export class WinccoaDpTypeNode {
  constructor(
    public name: string,
    public type: number,
    public refName: string,
    public children: WinccoaDpTypeNode[]
  ) {}
}

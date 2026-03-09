/**
 * Mock WinccoaManager for unit tests
 *
 * This fixture provides a mock implementation of the winccoa-manager package
 * so that tests can run in CI environments without WinCC OA installed.
 * The vitest.config.ts aliases 'winccoa-manager' to this file.
 */

import { vi } from 'vitest';

export class WinccoaManager {
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

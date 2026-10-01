/**
 * WinCC OA project path resolution.
 *
 * Tools that write into the project (custom dashboard icons under
 * <proj>/data/WebUI/icons) need the project directory. It used to be derived by
 * walking a fixed number of directories up from the compiled module, which is
 * only right for one layout: a git clone inside <proj>/javascript/. It is wrong
 * for the flat npm/zip layout (<proj>/javascript/mcpWinCCOA/...), for older zip
 * layouts, and for symlinked development checkouts (Node resolves ESM modules
 * through their real path), and it then pointed somewhere outside the project.
 *
 * The WinCC OA JavaScript manager knows the project path, so ask it first.
 */

import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

/** Where a resolved project path came from, for logging. */
export type ProjectPathSource =
  | 'WINCCOA_PROJ_PATH'
  | 'winccoa.getPaths()'
  | 'PVSS_II'
  | 'directory search'
  | 'none';

export interface ProjectPathResolution {
  /** Absolute project directory, or undefined if none could be determined. */
  path: string | undefined;
  /** Which strategy produced the path. */
  source: ProjectPathSource;
}

/** Upper bound for the upward directory search. */
const MAX_SEARCH_LEVELS = 10;

/**
 * Directory search fallback: a WinCC OA project is the directory that contains
 * config/config. Walk upward from `startDir`.
 *
 * @param startDir - Directory to start in
 * @returns The project directory, or undefined if no marker is found
 */
export function findProjectDirUpward(startDir: string): string | undefined {
  let current = resolve(startDir);
  for (let i = 0; i <= MAX_SEARCH_LEVELS; i++) {
    if (existsSync(join(current, 'config', 'config'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}

/**
 * Resolve the WinCC OA project path and report where it came from.
 *
 * Order:
 * 1. WINCCOA_PROJ_PATH environment variable (explicit override)
 * 2. winccoa.getPaths()[0] - the manager API; the project path is always first
 * 3. PVSS_II environment variable (<proj>/config/config), set in the manager process
 * 4. Upward search from this module for a directory containing config/config
 *
 * Never throws.
 *
 * @param winccoa - WinCC OA manager instance (optional)
 * @param startDir - Start directory for the upward search (defaults to this module's directory)
 */
export function resolveProjectPathWithSource(
  winccoa?: unknown,
  startDir?: string
): ProjectPathResolution {
  const fromEnv = process.env.WINCCOA_PROJ_PATH?.trim();
  if (fromEnv) {
    return { path: fromEnv, source: 'WINCCOA_PROJ_PATH' };
  }

  const getPaths = (winccoa as { getPaths?: unknown } | null | undefined)?.getPaths;
  if (typeof getPaths === 'function') {
    try {
      const paths = getPaths.call(winccoa) as ReadonlyArray<unknown> | undefined;
      const first = paths?.[0];
      if (typeof first === 'string' && first.trim().length > 0) {
        return { path: first.trim(), source: 'winccoa.getPaths()' };
      }
    } catch {
      // Fall through to the next strategy.
    }
  }

  const pvssII = process.env.PVSS_II?.trim();
  if (pvssII) {
    return { path: dirname(dirname(pvssII)), source: 'PVSS_II' };
  }

  let searchStart = startDir;
  if (!searchStart) {
    try {
      searchStart = dirname(fileURLToPath(import.meta.url));
    } catch {
      searchStart = undefined;
    }
  }
  if (searchStart) {
    const found = findProjectDirUpward(searchStart);
    if (found) {
      return { path: found, source: 'directory search' };
    }
  }

  return { path: undefined, source: 'none' };
}

/**
 * Resolve the WinCC OA project path (see resolveProjectPathWithSource for the order).
 *
 * @param winccoa - WinCC OA manager instance (optional)
 * @returns Absolute project directory, or undefined
 */
export function resolveProjectPath(winccoa?: unknown): string | undefined {
  return resolveProjectPathWithSource(winccoa).path;
}

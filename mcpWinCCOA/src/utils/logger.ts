/**
 * Minimal level-based logger.
 *
 * The HTTP server previously logged a running commentary on every request,
 * including request headers and the first 8 characters of both the presented and
 * the expected API token. Anything reaching a WinCC OA manager log is readable by
 * anyone with log access, so token material must never be written there, and the
 * per-request commentary belongs behind a level.
 *
 * Controlled by MCP_LOG_LEVEL: debug | info | warn | error (default: info).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function resolveLevel(): number {
  const raw = (process.env.MCP_LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[raw as LogLevel] ?? LEVELS.info;
}

/** Re-read on every call so tests and operators can change it without a restart. */
function enabled(level: LogLevel): boolean {
  return LEVELS[level] >= resolveLevel();
}

/** Verbose per-request tracing. Off unless MCP_LOG_LEVEL=debug. */
export function debug(...args: unknown[]): void {
  if (enabled('debug')) console.log(...args);
}

/** Normal operational messages: startup, listening, tool registration. */
export function info(...args: unknown[]): void {
  if (enabled('info')) console.log(...args);
}

export function warn(...args: unknown[]): void {
  if (enabled('warn')) console.warn(...args);
}

export function error(...args: unknown[]): void {
  if (enabled('error')) console.error(...args);
}

/**
 * Describe a secret without disclosing any of it.
 *
 * Use this instead of `token.substring(0, 8)`: a prefix is still secret material,
 * and for a short or low-entropy token it can be most of it.
 *
 * @param secret - The value to describe
 * @returns "set (N chars)" or "not set"
 */
export function describeSecret(secret: string | undefined | null): string {
  return secret ? `set (${secret.length} chars)` : 'not set';
}

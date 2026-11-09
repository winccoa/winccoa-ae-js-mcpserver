/**
 * Request size limits (GHSA-46jr-4wx8-v453).
 *
 * Two independent caps protect the server from a single oversized request:
 *
 * - MCP_MAX_TOOL_INPUT_ELEMENTS: handed to McpServer as `maxToolInputElements`.
 *   It counts every array element and object key in a tool call's arguments
 *   (nested, summed) and rejects the call before schema validation runs.
 * - MCP_MAX_REQUEST_BODY: the byte limit of the express JSON body parser (HTTP
 *   mode only). It bounds everything the element cap does not, such as long
 *   strings, and JSON that tools accept as a string.
 *
 * Read lazily from the environment (not snapshotted at import) because the
 * stdio entry point imports the server before dotenv has run.
 */

/** Default element cap. Fits a 300-datapoint dpSet (about 900 elements); see CONFIGURATION.md. */
export const DEFAULT_MAX_TOOL_INPUT_ELEMENTS = 1_000;

/** Default body cap in bytes: 1 MiB. */
export const DEFAULT_MAX_REQUEST_BODY_BYTES = 1024 * 1024;

export interface RequestLimits {
  maxToolInputElements: number;
  maxRequestBodyBytes: number;
  /** One message per invalid variable; empty when everything parsed. */
  errors: string[];
}

/** Parse a positive integer, e.g. "1000". Returns undefined if invalid. */
export function parseElementLimit(raw: string): number | undefined {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

/** Parse a byte size: "524288", "512kb" or "2mb" (binary multiples). */
export function parseByteSize(raw: string): number | undefined {
  const m = /^(\d+)\s*(kb|mb)?$/i.exec(raw.trim());
  if (!m) return undefined;
  const unit = (m[2] ?? '').toLowerCase();
  const factor = unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1;
  const n = Number(m[1]) * factor;
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

/**
 * Resolve both limits from the environment. Invalid values fall back to the
 * default AND are reported in `errors`; a limit is never silently disabled.
 */
export function resolveRequestLimits(
  env: NodeJS.ProcessEnv = process.env
): RequestLimits {
  const errors: string[] = [];
  let maxToolInputElements = DEFAULT_MAX_TOOL_INPUT_ELEMENTS;
  let maxRequestBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES;

  const rawElements = env.MCP_MAX_TOOL_INPUT_ELEMENTS;
  if (rawElements !== undefined && rawElements.trim() !== '') {
    const parsed = parseElementLimit(rawElements);
    if (parsed === undefined) {
      errors.push(
        `MCP_MAX_TOOL_INPUT_ELEMENTS is set to "${rawElements}" but must be a positive integer ` +
          `(default ${DEFAULT_MAX_TOOL_INPUT_ELEMENTS}).`
      );
    } else {
      maxToolInputElements = parsed;
    }
  }

  const rawBody = env.MCP_MAX_REQUEST_BODY;
  if (rawBody !== undefined && rawBody.trim() !== '') {
    const parsed = parseByteSize(rawBody);
    if (parsed === undefined) {
      errors.push(
        `MCP_MAX_REQUEST_BODY is set to "${rawBody}" but must be a positive size in bytes, ` +
          `or with a kb/mb suffix, e.g. 1mb (default 1mb).`
      );
    } else {
      maxRequestBodyBytes = parsed;
    }
  }

  return { maxToolInputElements, maxRequestBodyBytes, errors };
}

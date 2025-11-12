/**
 * Server Context Types
 *
 * Shared context object passed to all MCP tools.
 */

import type { WinccoaManager } from '../winccoa/manager.js';

/**
 * Server context object
 * Contains shared state and instances for all tools
 */
export interface ServerContext {
  /** WinCC OA manager instance */
  winccoa: WinccoaManager;

  /** Field-specific configuration content */
  fieldContent: string;

  /** Active field name */
  activeFieldName: string;

  /** Project-specific configuration content (optional) */
  projectContent: string | null;

  /** System-level prompt content (optional) */
  systemPrompt: string | null;
}

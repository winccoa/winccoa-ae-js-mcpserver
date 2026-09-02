/**
 * MCP Server Initialization
 *
 * Initializes the MCP server with WinCC OA manager, resources, and tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WinccoaManager } from "winccoa-manager";
import { loadAllTools } from "./tool_loader.js";
import { readFileSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ServerContext } from "./types/index.js";

/**
 * Memoised process-wide context.
 *
 * The WinccoaManager is a SCADA handle with no close()/dispose(), and it hands
 * out dpConnect subscriptions, so exactly one may exist per process. Everything
 * expensive lives here and is built once; the per-request McpServer is cheap.
 */
let contextPromise: Promise<ServerContext> | null = null;

/**
 * Load system prompt from systemprompt.md file
 * @returns System prompt content or null if file doesn't exist
 */
function loadSystemPrompt(): string | null {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const systemPromptPath = join(__dirname, "systemprompt.md");

    console.log("🔄 Loading system prompt from:", systemPromptPath);
    const content = readFileSync(systemPromptPath, "utf8");
    console.log("✅ System prompt loaded successfully");
    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("⚠️ Could not load system prompt:", errorMessage);
    return null;
  }
}

/**
 * Load field content for the active field
 * @param fieldName - Name of the field to load
 * @returns Field content
 */
async function loadFieldContent(fieldName: string): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const fieldPath = path.join(__dirname, "fields", `${fieldName}.md`);

  try {
    // Read the field file
    const content = await fs.readFile(fieldPath, "utf8");
    console.log(`Loaded field content: ${fieldName}`);
    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error loading field ${fieldName}:`, errorMessage);
    // Return default content if field not found
    return "# Default Configuration\n\nNo specific field instructions available.";
  }
}

/**
 * Load project-specific content if available
 * @returns Project content or null
 */
async function loadProjectContent(): Promise<string | null> {
  const projectPath = process.env.WINCCOA_PROJECT_INSTRUCTIONS;

  if (!projectPath) {
    console.log(
      "No project configuration specified (WINCCOA_PROJECT_INSTRUCTIONS not set)",
    );
    return null;
  }

  try {
    // Resolve the path (could be absolute or relative)
    const resolvedPath = path.resolve(projectPath);

    // Read the project file
    const content = await fs.readFile(resolvedPath, "utf8");

    console.log(`Loaded project content from: ${resolvedPath}`);
    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Error loading project configuration from ${projectPath}:`,
      errorMessage,
    );
    return null;
  }
}

/**
 * Resolve the server version from package.json.
 *
 * Tries the development layout (build/../package.json) and then the installed
 * layout, where postinstall copies both the build output and package.json into
 * the WinCC OA project directory.
 */
function loadVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "..", "package.json"),
    join(here, "package.json"),
  ]) {
    try {
      return JSON.parse(readFileSync(candidate, "utf8")).version as string;
    } catch {
      // try the next candidate
    }
  }
  console.warn("⚠️ Could not resolve version from package.json");
  return "0.0.0-unknown";
}

/**
 * Build the process-wide context: the WinCC OA manager plus the instruction
 * content. Memoised, so repeated calls are free and only one WinccoaManager is
 * ever constructed.
 *
 * A failure is not cached - the next call retries - so a transient file read
 * error cannot poison the process.
 *
 * @returns The shared server context
 */
export function initContext(): Promise<ServerContext> {
  if (!contextPromise) {
    contextPromise = (async (): Promise<ServerContext> => {
      console.log("🔄 Initializing WinCC OA manager...");
      const winccoa = new WinccoaManager();
      console.log("✅ WinCC OA manager initialized");

      const activeFieldName = process.env.WINCCOA_FIELD || "default";
      console.log("✅ Active field:", activeFieldName);

      const [fieldContent, projectContent] = await Promise.all([
        loadFieldContent(activeFieldName),
        loadProjectContent(),
      ]);
      console.log("✅ Project content loaded:", projectContent ? "YES" : "NO");

      const systemPrompt = loadSystemPrompt();
      console.log("✅ System prompt loaded:", systemPrompt ? "SUCCESS" : "NONE");

      if (projectContent) {
        console.log(
          `✅ Project configuration loaded from: ${process.env.WINCCOA_PROJECT_INSTRUCTIONS}`,
        );
      }

      return {
        winccoa,
        fieldContent: fieldContent || "",
        activeFieldName,
        projectContent,
        systemPrompt,
      };
    })().catch((error: unknown) => {
      contextPromise = null; // do not cache a failure
      throw error;
    });
  }

  return contextPromise;
}

/**
 * Register the four instruction resources on a server instance.
 *
 * Note the argument order: the SDK signature is
 * `resource(name, uriOrTemplate, readCallback)`. Passing the URI first - as
 * this code previously did - registers the resource under a name of
 * "instructions://system" and a *URI* of "System-level prompt and
 * instructions", so every read failed with -32602.
 *
 * All callbacks close over the `context` argument, never module state, so a
 * per-request server cannot observe another request's data.
 */
function registerInstructionResources(
  server: McpServer,
  context: ServerContext,
): void {
  const { systemPrompt, fieldContent, projectContent, activeFieldName } =
    context;

  if (systemPrompt) {
    server.resource(
      "System-level prompt and instructions",
      "instructions://system",
      async () => ({
        contents: [
          {
            uri: "instructions://system",
            mimeType: "text/markdown",
            text: systemPrompt,
          },
        ],
      }),
    );
  }

  server.resource(
    "Field-specific instructions",
    "instructions://field",
    async () => ({
      contents: [
        {
          uri: "instructions://field",
          mimeType: "text/markdown",
          text: fieldContent,
        },
      ],
    }),
  );

  if (projectContent) {
    server.resource(
      "Project-specific instructions",
      "instructions://project",
      async () => ({
        contents: [
          {
            uri: "instructions://project",
            mimeType: "text/markdown",
            text: projectContent,
          },
        ],
      }),
    );
  }

  server.resource(
    "All instructions combined (system + field + project)",
    "instructions://combined",
    async () => {
      let combined = "";

      if (systemPrompt) {
        combined += "# System Instructions\n\n" + systemPrompt + "\n\n---\n\n";
      }

      combined +=
        "# Field Instructions (" + activeFieldName + ")\n\n" + fieldContent;

      if (projectContent) {
        combined += "\n\n---\n\n# Project Instructions\n\n" + projectContent;
        combined +=
          "\n\n---\n\n## Note\nProject instructions take precedence over field instructions.";
      }

      return {
        contents: [
          {
            uri: "instructions://combined",
            mimeType: "text/markdown",
            text: combined,
          },
        ],
      };
    },
  );
}

/**
 * Create a fresh, disposable McpServer bound to the given context.
 *
 * The HTTP transport must call this once per request. The MCP SDK's Protocol
 * supports a single transport per instance, and sharing one instance across
 * clients is the subject of a HIGH advisory against @modelcontextprotocol/sdk
 * ("cross-client data leak via shared server/transport instance reuse", the
 * same defect as GitHub issue #33). This is cheap - a few milliseconds - since
 * tool modules are import-cached and the zod-to-JSON-Schema conversion happens
 * per tools/list call regardless.
 *
 * @param context - Shared process-wide context from initContext()
 * @returns A new MCP server with resources and tools registered
 */
export async function createServer(
  context: ServerContext,
): Promise<McpServer> {
  const server = new McpServer({
    name: "WinCC OA Extended with CNS/UNS",
    version: loadVersion(),
  });

  registerInstructionResources(server, context);
  await loadAllTools(server, context);

  return server;
}

/**
 * Initialize context and create a server in one step.
 *
 * Retained for the stdio transport, which is single-client and long-lived, so
 * one server instance for the process lifetime is correct there.
 *
 * @returns Configured MCP server
 */
export async function initializeServer(): Promise<McpServer> {
  console.log("🔄 Starting MCP server initialization...");
  try {
    const context = await initContext();
    const server = await createServer(context);
    console.log(
      `✅ MCP Server initialized successfully. Active field: ${context.activeFieldName}`,
    );
    return server;
  } catch (error) {
    console.error("❌ Error during MCP server initialization:", error);
    if (error instanceof Error) {
      console.error("❌ Initialization error stack:", error.stack);
    }
    throw error;
  }
}

/**
 * Get the shared context (for testing or debugging).
 *
 * Now async: it previously returned `winccoa!`, which was a hard null until
 * initializeServer() had run.
 *
 * @returns Current server context
 */
export function getContext(): Promise<ServerContext> {
  return initContext();
}

/*******************************************************/
/*                                                     */
/*   This file was initially creates by Martin Kumhera */
/*   and extended by AI with CNS (UNS) functions!     */
/*                                                     */
/*******************************************************/


import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeServer } from './server.js';

// Try to load dotenv if available
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (error) {
  // dotenv not available, continue without it
  console.log('dotenv not available, using environment variables directly');
}


async function main() {
  const server = await initializeServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

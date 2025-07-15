/*******************************************************/
/*                                                     */
/*   This file was initially creates by Martin Kumhera */
/*   and extended by AI with CNS (UNS) functions!     */
/*                                                     */
/*******************************************************/


import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { init_tools } from './tools/tool_oa.js';


async function main() {
  const server = init_tools();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

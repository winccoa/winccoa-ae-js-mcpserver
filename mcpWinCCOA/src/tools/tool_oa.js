import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import State from "./stateManager.js";
import { mkTypesContent, addDescAndUnits, validateAgainstRules } from "./helpers.js";
import { z } from 'zod';

let server = null;



function addTools(winccoa, server) {
  server.tool("get-dpTypes", "Get datapoint types", {
    pattern: z.string().optional(),
    systemId: z.number().optional(),
    withInternals: z.boolean().optional(),
    includeEmpty: z.boolean().optional(),
  }, async ({ pattern, systemId, withInternals, includeEmpty }) => {
    console.log('attempt to get dpTypes');
    const types = winccoa.dpTypes(pattern, systemId, includeEmpty);
    console.log(`dpTypes: ${JSON.stringify(types)}`);
    return { content: mkTypesContent(types, withInternals) };
  });

  server.tool("get-datapoints", `Search and return datapoint names from WinCC OA by pattern and type. 
    For each match, provides the datapoint's type, description, and full structure including children fields with their full path and engineering unit metadata. 
    Supports wildcard pattern and case-insensitive search.`, {
    dpNamePattern: z.string().optional(),
    dpType: z.string().optional(),
    ignoreCase: z.boolean().optional(),
  }, async ({ dpNamePattern, type, ignoreCase }) => {
    const p = (dpNamePattern && dpNamePattern.length > 0) ? dpNamePattern : '*';
    const dps = winccoa.dpNames(p, type, ignoreCase);
    const ret = [];
    for (const nm of dps) {
      const dp = {};
      dp.name = nm;
      dp.type = winccoa.dpTypeName(nm);
      dp.description = winccoa.dpGetDescription(nm);
      dp.structure = winccoa.dpTypeGet(dp.type);
      addDescAndUnits(dp.structure.children, nm, winccoa);
      ret.push({ type: "text", text: JSON.stringify(dp) });
    }
    return { content: ret };
  });

  server.tool("get-value", "Get value of a datapoint element", {
    dpe: z.string(),
  }, async ({ dpe }) => {
    const dpes = [dpe + ':_online.._value', dpe + ':_original.._stime'];
    const val = await winccoa.dpGet(dpes);
    const result = { "value": val[0], "timestamp": val[1], unit: winccoa.dpGetUnit(dpe) };
    console.log('dpGet:', dpe, val, result);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool("dp-set", `Set value of datapoint element`, {
    dpeName: z.string(),
    value: z.any(),
  }, async ({ dpeName, value }) => {
    const instance = await new State().init(winccoa);
    const rules = instance.getState().rules;
    if (!validateAgainstRules(dpeName, rules)) {
      return { content: [{ type: "text", text: `Only ${rules.allowed_patterns.join(', ')} allowed to be set`}] }
    }
    const result = winccoa.dpSet(dpeName, value);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  server.tool("get-plantOverview", "Get plant overview", {}, async () => {
    const instance = await new State().init(winccoa);
    return { content: [{ type: "text", text: JSON.stringify(instance.getState().tree) }] };
  })

  server.tool("get-mainInstructions", "Get main instructions", {}, async () => {
    const instance = await new State().init(winccoa);
    return { content: [{ type: "text", text: instance.getState().mainInstructions }] }
  })

  server.tool("get-plantSpecificInstructions", "Get plant specific instructions", {}, async () => {
    const instance = await new State().init(winccoa);
    return { content: [{ type: "text", text: instance.getState().specificInstructions }] }
  })
}

export function init_tools(winccoa) {
  server = new McpServer({
    name: "WinCC OA Extended with CNS/UNS",
    version: "3.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  addTools(winccoa, server);
  return server;
}

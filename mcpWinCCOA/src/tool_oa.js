import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { z } from 'zod';
import { WinccoaManager } from 'winccoa-manager'; 

let winccoa=null, server=null;

function mkTypesContent(arr, withInternals) {
  const ret = [];
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].startsWith('_')) {
      ret.push({ type: "text", text: arr[i] });  
    } else if (withInternals) {
      ret.push({ type: "text", text: arr[i]});
    }
  }
  return ret;
}

function addFullPathAndUnitToChildren(children, parentPath, winccoa) {
  children.forEach(child => {
    const currentPath = `${parentPath}.${child.name}`;
    if (Array.isArray(child.children) && child.children.length > 0) {
      addFullPathAndUnitToChildren(child.children, currentPath, winccoa);
    } else {
      if (winccoa.dpElementType !== 1)
      {
        child.unit = winccoa.dpGetUnit(currentPath);
        child.description = winccoa.dpGetDescription(currentPath);
      }
    }
  });
}

function init_dp(winccoa, server) {
    // ==================== DATAPOINT TOOLS ====================

  server.tool("get-dpTypes", "Get datapoint types", {
    pattern: z.string().optional(),
    systemId: z.number().optional(),
    withInternals: z.boolean().optional(),
    includeEmpty: z.boolean().optional(),
  }, async ({ pattern, systemId, withInternals, includeEmpty }) => {
    console.log('attempt to get dpTypes');
    const types = winccoa.dpTypes(pattern, systemId, includeEmpty);
    console.log(`dpTypes: ${JSON.stringify(types)}`);
    return {content: mkTypesContent(types, withInternals)};
  });
  
  server.tool("get-datapoints", `Search and return datapoint names from WinCC OA by pattern and type. 
    For each match, provides the datapoint's type, description, and full structure including children fields with their full path and engineering unit metadata. 
    Supports wildcard pattern and case-insensitive search.`, {
    dpNamePattern: z.string().optional(),
    dpType: z.string().optional(),
    ignoreCase: z.boolean().optional(),
  }, async ({ dpNamePattern, type, ignoreCase }) => {
    const p=(dpNamePattern && dpNamePattern.length > 0) ? dpNamePattern : '*';
    const dps = winccoa.dpNames(p, type, ignoreCase);
    const ret = [];
    for (const nm of dps) {
      const dp = {};
      dp.name = nm;
      dp.type = winccoa.dpTypeName(nm);
      dp.description = winccoa.dpGetDescription(nm);
      dp.structure = winccoa.dpTypeGet(dp.type);
      addFullPathAndUnitToChildren(dp.structure.children, nm, winccoa);
      ret.push({type: "text", text: JSON.stringify(dp)});
    }
    return {content: ret};
  });
  
  server.tool("get-value", "Get value of a datapoint element", {
    dpe: z.string(),
  }, async ({ dpe }) => {
    const dpes = [dpe + ':_online.._value', dpe + ':_original.._stime'];
    const val = await winccoa.dpGet(dpes);
    const result = {"value": val[0], "timestamp": val[1], unit: winccoa.dpGetUnit(dpe)};
    console.log('dpGet:', dpe, val, result);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("dp-set", `Set value of datapoint element. 
    Only '*_AI_Assistant' datapoints can beused for manipulation.
    'Intecity' and 'recipe' setpoints MUST not be used for volume control.
    'Intecity' and 'recipe' setpoints MUST contain exact values from recipe.
    DO NOT USE OTHER DATAPIOINTS.

    CRITICAL: After setting any production setpoints, ALWAYS verify actual material consumption using:
    - Production time
    - Flow rates  
    - Valve positions from applied setpoints

    IMPORTANT RECIPE INTERPRETATION:
    - Recipe percentages (Cyan: 30%, Magenta: 25%, etc.) are VALVE INTENSITY SETPOINTS
    - They are NOT percentages of the target volume
    - Material consumption = (setpoint_percentage/100) × flow_rate × production_time

  NEVER calculate material requirements as (percentage/100) × target_volume
  ALWAYS use the production time and flow rate formula for verification
    `, {
    dpeName: z.string(),
    value: z.any(),
  }, async ({ dpeName, value }) => {
    if (!dpeName.includes('_AI_Assistant'))
    {
      return {content: [{type: "text", text: "Only '*_AI_Assistant' datapoints can beused for manipulation. DO NOT USE OTHER DATAPIOINTS."}]}
    }
    const result = winccoa.dpSet(dpeName, value);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  /*server.tool("dp-set", `Set value of datapoint element(s). 
    Only '*_AI_Assistant' datapoints can beused for manipulation.
    DO NOT USE OTHER DATAPIOINTS.
    `, {
    dpeNames: z.union([z.string(), z.array(z.string())]),
    values: z.union([z.any(), z.array(z.any())]),
  }, async ({ dpeNames, values }) => {

    console.log(`Setting values for ${JSON.stringify(dpeNames)}`);
    const result = winccoa.dpSet(dpeNames, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });*/
  
  /*server.tool("dp-set-wait", "Set value of datapoint element(s) and wait for confirmation", {
    dpeNames: z.union([z.string(), z.array(z.string())]),
    values: z.union([z.any(), z.array(z.any())]),
  }, async ({ dpeNames, values }) => {
    console.log(`Setting values (with wait) for ${JSON.stringify(dpeNames)}`);
    const result = await winccoa.dpSetWait(dpeNames, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-max-age", "Get value from driver if older than specified age", {
    age: z.number(),
    dpeNames: z.union([z.string(), z.array(z.string())]),
  }, async ({ age, dpeNames }) => {
    console.log(`Getting max age values for ${JSON.stringify(dpeNames)}, age: ${age}`);
    const result = await winccoa.dpGetMaxAge(age, dpeNames);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-exists", "Check if datapoint identifier exists", {
    dpId: z.string(),
  }, async ({ dpId }) => {
    const result = winccoa.dpExists(dpId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-element-type", "Get datapoint element type", {
    dpeName: z.string(),
  }, async ({ dpeName }) => {
    const result = winccoa.dpElementType(dpeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-alias", "Get alias for datapoint", {
    dpeName: z.string(),
  }, async ({ dpeName }) => {
    const result = winccoa.dpGetAlias(dpeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-set-alias", "Set alias for datapoint", {
    dpeName: z.string(),
    alias: z.string(),
  }, async ({ dpeName, alias }) => {
    const result = await winccoa.dpSetAlias(dpeName, alias);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-alias-to-name", "Get datapoint name for alias", {
    alias: z.string(),
  }, async ({ alias }) => {
    const result = winccoa.dpAliasToName(alias);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-all-aliases", "Get all aliases with filtering", {
    aliasFilter: z.string().optional(),
    dpeFilter: z.string().optional(),
  }, async ({ aliasFilter, dpeFilter }) => {
    const result = winccoa.dpGetAllAliases(aliasFilter || '*', dpeFilter || '*');
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-description", "Get description/comment for datapoint", {
    dpeName: z.string(),
    mode: z.number().optional(),
  }, async ({ dpeName, mode }) => {
    const result = winccoa.dpGetDescription(dpeName, mode);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-set-description", "Set description/comment for datapoint", {
    dpeName: z.string(),
    description: z.any(),
  }, async ({ dpeName, description }) => {
    const result = await winccoa.dpSetDescription(dpeName, description);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-format", "Get numerical format of datapoint", {
    dpeName: z.string(),
  }, async ({ dpeName }) => {
    const result = winccoa.dpGetFormat(dpeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-set-format", "Set numerical format of datapoint", {
    dpeName: z.string(),
    format: z.string(),
  }, async ({ dpeName, format }) => {
    const result = await winccoa.dpSetFormat(dpeName, format);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-unit", "Get unit of datapoint", {
    dpeName: z.string(),
  }, async ({ dpeName }) => {
    const result = winccoa.dpGetUnit(dpeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-set-unit", "Set unit of datapoint", {
    dpeName: z.string(),
    unit: z.string(),
  }, async ({ dpeName, unit }) => {
    const result = await winccoa.dpSetUnit(dpeName, unit);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-id", "Get datapoint ID and element ID", {
    dpName: z.string(),
  }, async ({ dpName }) => {
    const result = winccoa.dpGetId(dpName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-name", "Get datapoint name from IDs", {
    dpId: z.number(),
    elementId: z.number(),
    systemId: z.number().optional(),
  }, async ({ dpId, elementId, systemId }) => {
    const result = winccoa.dpGetName(dpId, elementId, systemId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-create", "Create a datapoint", {
    dpName: z.string(),
    dpType: z.string(),
    systemId: z.number().optional(),
    dpId: z.number().optional(),
  }, async ({ dpName, dpType, systemId, dpId }) => {
    const result = await winccoa.dpCreate(dpName, dpType, systemId, dpId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-delete", "Delete a datapoint", {
    dpName: z.string(),
  }, async ({ dpName }) => {
    const result = await winccoa.dpDelete(dpName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-copy", "Copy a datapoint", {
    srcDpName: z.string(),
    dstDpName: z.string(),
    driver: z.number().optional(),
  }, async ({ srcDpName, dstDpName, driver }) => {
    const result = await winccoa.dpCopy(srcDpName, dstDpName, driver);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-query", "Execute SQL-like query on datapoints", {
    query: z.string(),
  }, async ({ query }) => {
    const result = await winccoa.dpQuery(query);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-period", "Get historical data for time period", {
    startTime: z.string(),
    endTime: z.string(),
    dpeList: z.union([z.string(), z.array(z.string())]),
    count: z.number().optional(),
  }, async ({ startTime, endTime, dpeList, count }) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const result = await winccoa.dpGetPeriod(start, end, dpeList, count);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-set-timed", "Set datapoint value with specific timestamp", {
    sourceTime: z.string(),
    dpeNames: z.union([z.string(), z.array(z.string())]),
    values: z.union([z.any(), z.array(z.any())]),
  }, async ({ sourceTime, dpeNames, values }) => {
    const sTime = new Date(sourceTime);
    const result = winccoa.dpSetTimed(sTime, dpeNames, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-set-timed-wait", "Set datapoint value with timestamp and wait", {
    sourceTime: z.string(),
    dpeNames: z.union([z.string(), z.array(z.string())]),
    values: z.union([z.any(), z.array(z.any())]),
  }, async ({ sourceTime, dpeNames, values }) => {
    const sTime = new Date(sourceTime);
    const result = await winccoa.dpSetTimedWait(sTime, dpeNames, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-sub-str", "Get substring of datapoint name", {
    dp: z.string(),
    pattern: z.string(),
  }, async ({ dp, pattern }) => {
    const result = winccoa.dpSubStr(dp, pattern);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-attribute-type", "Get data type of datapoint attribute", {
    dpAttributeName: z.string(),
  }, async ({ dpAttributeName }) => {
    const result = winccoa.dpAttributeType(dpAttributeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-all-configs", "Get all possible configs for datapoint/type", {
    dpNameOrType: z.string(),
  }, async ({ dpNameOrType }) => {
    const result = winccoa.dpGetAllConfigs(dpNameOrType);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-all-attrib", "Get all attributes for config", {
    configName: z.string(),
  }, async ({ configName }) => {
    const result = winccoa.dpGetAllAttrib(configName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-all-details", "Get all details for config", {
    configName: z.string(),
  }, async ({ configName }) => {
    const result = winccoa.dpGetAllDetails(configName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-get-all-descriptions", "Get all datapoints with descriptions", {
    descriptionFilter: z.string().optional(),
    dpeFilter: z.string().optional(),
    mode: z.number().optional(),
  }, async ({ descriptionFilter, dpeFilter, mode }) => {
    const result = winccoa.dpGetAllDescriptions(descriptionFilter, dpeFilter, mode);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  // ==================== DATAPOINT TYPE TOOLS ====================
  
  server.tool("dp-type-get", "Get datapoint type structure", {
    dpType: z.string(),
    withSubTypes: z.boolean().optional(),
  }, async ({ dpType, withSubTypes }) => {
    const result = winccoa.dpTypeGet(dpType, withSubTypes);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-type-name", "Get datapoint type name for datapoint", {
    dpName: z.string(),
  }, async ({ dpName }) => {
    const result = winccoa.dpTypeName(dpName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-type-ref", "Get type reference of datapoint element", {
    dpeName: z.string(),
  }, async ({ dpeName }) => {
    const result = winccoa.dpTypeRef(dpeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-type-create", "Create new datapoint type", {
    typeStructure: z.any(),
  }, async ({ typeStructure }) => {
    const result = await winccoa.dpTypeCreate(typeStructure);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-type-change", "Change existing datapoint type", {
    typeStructure: z.any(),
  }, async ({ typeStructure }) => {
    const result = await winccoa.dpTypeChange(typeStructure);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });
  
  server.tool("dp-type-delete", "Delete datapoint type", {
    dpTypeName: z.string(),
  }, async ({ dpTypeName }) => {
    const result = await winccoa.dpTypeDelete(dpTypeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  }); */
}

function init_alert(winccoa,server) {
  // ==================== ALERT TOOLS ====================

  /*server.tool("alert-get", "Get alert values", {
    alertTime: z.any(),
    dpeNames: z.union([z.string(), z.array(z.string())]),
    alertCount: z.union([z.number(), z.array(z.number())]).optional(),
  }, async ({ alertTime, dpeNames, alertCount }) => {
    const result = await winccoa.alertGet(alertTime, dpeNames, alertCount);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("alert-get-period", "Get alerts for time period", {
    startTime: z.string(),
    endTime: z.string(),
    dpeNames: z.array(z.string()),
  }, async ({ startTime, endTime, dpeNames }) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const result = await winccoa.alertGetPeriod(start, end, dpeNames);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("alert-set", "Set alert attributes", {
    alerts: z.any(),
    values: z.any(),
  }, async ({ alerts, values }) => {
    const result = winccoa.alertSet(alerts, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("alert-set-wait", "Set alert attributes and wait", {
    alerts: z.any(),
    values: z.any(),
  }, async ({ alerts, values }) => {
    const result = await winccoa.alertSetWait(alerts, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("alert-set-timed", "Set alert attributes with timestamp", {
    sourceTime: z.string(),
    alerts: z.any(),
    values: z.any(),
  }, async ({ sourceTime, alerts, values }) => {
    const sTime = new Date(sourceTime);
    const result = winccoa.alertSetTimed(sTime, alerts, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("alert-set-timed-wait", "Set alert attributes with timestamp and wait", {
    sourceTime: z.string(),
    alerts: z.any(),
    values: z.any(),
  }, async ({ sourceTime, alerts, values }) => {
    const sTime = new Date(sourceTime);
    const result = await winccoa.alertSetTimedWait(sTime, alerts, values);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });*/
}

function init_cns(winccoa, server) {
  // ==================== CNS/UNS VIEW MANAGEMENT TOOLS ====================

  /*server.tool("cns-create-view", "Create a new CNS view", {
    viewId: z.string(),
    displayNames: z.record(z.string(), z.string()).optional(),
    systemId: z.number().optional(),
  }, async ({ viewId, displayNames, systemId }) => {
    console.log(`Creating CNS view: ${viewId}`);
    const result = await winccoa.cnsCreateView(viewId, displayNames, systemId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-delete-view", "Delete a CNS view", {
    viewPath: z.string(),
  }, async ({ viewPath }) => {
    console.log(`Deleting CNS view: ${viewPath}`);
    const result = await winccoa.cnsDeleteView(viewPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-views", "Get all CNS views in system", {
    systemName: z.string().optional(),
  }, async ({ systemName }) => {
    if (!systemName||systemName==="") { 
      systemName = winccoa.getSystemName();
    }
    const result = winccoa.cnsGetViews(systemName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-view-exists", "Check if CNS view exists", {
    viewPath: z.string(),
  }, async ({ viewPath }) => {
    const result = winccoa.cns_viewExists(viewPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-is-view", "Check if given ID is a view", {
    id: z.string(),
  }, async ({ id }) => {
    const result = winccoa.cns_isView(id);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-view-display-names", "Change display names of view", {
    viewPath: z.string(),
    displayNames: z.record(z.string(), z.string()),
  }, async ({ viewPath, displayNames }) => {
    const result = await winccoa.cnsChangeViewDisplayNames(viewPath, displayNames);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-view-names", "Change ID of view", {
    oldViewPath: z.string(),
    newViewId: z.string(),
  }, async ({ oldViewPath, newViewId }) => {
    const result = await winccoa.cnsChangeViewNames(oldViewPath, newViewId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-view-display-names", "Get display names of view", {
    viewPath: z.string(),
  }, async ({ viewPath }) => {
    const result = winccoa.cnsGetViewDisplayNames(viewPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-view-separators", "Get separators of view", {
    viewPath: z.string(),
  }, async ({ viewPath }) => {
    const result = winccoa.cnsGetViewSeparators(viewPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-view-separators", "Change separators of view", {
    viewPath: z.string(),
    nodeSeparator: z.string(),
    treeSeparator: z.string(),
  }, async ({ viewPath, nodeSeparator, treeSeparator }) => {
    const result = await winccoa.cnsChangeViewSeparators(viewPath, nodeSeparator, treeSeparator);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-view-permission", "Get permissions for view", {
    viewPath: z.string(),
  }, async ({ viewPath }) => {
    const result = winccoa.cns_getViewPermission(viewPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-view-permission", "Set permissions for view", {
    viewPath: z.string(),
    permission: z.number(),
  }, async ({ viewPath, permission }) => {
    const result = await winccoa.cns_setViewPermission(viewPath, permission);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CNS/UNS TREE AND NODE MANAGEMENT TOOLS ====================

  server.tool("cns-add-tree", "Create a tree or sub-tree", {
    treePath: z.string(),
    displayNames: z.record(z.string(), z.string()).optional(),
    nodeType: z.string().optional(),
  }, async ({ treePath, displayNames, nodeType }) => {
    console.log(`Creating CNS tree: ${treePath}`);
    const result = await winccoa.cnsAddTree(treePath, displayNames, nodeType);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-add-node", "Add a new node to tree or sub-tree", {
    nodePath: z.string(),
    displayNames: z.record(z.string(), z.string()).optional(),
    nodeType: z.string().optional(),
    dpElement: z.string().optional(),
  }, async ({ nodePath, displayNames, nodeType, dpElement }) => {
    console.log(`Creating CNS node: ${nodePath}`);
    const result = await winccoa.cnsAddNode(nodePath, displayNames, nodeType, dpElement);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-delete-tree", "Delete tree, sub-tree or node", {
    path: z.string(),
  }, async ({ path }) => {
    console.log(`Deleting CNS tree/node: ${path}`);
    const result = await winccoa.cnsDeleteTree(path);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-trees", "Get all trees of view", {
    viewPath: z.string(),
  }, async ({ viewPath }) => {
    const result = winccoa.cnsGetTrees(viewPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-tree-exists", "Check if tree exists", {
    treePath: z.string(),
  }, async ({ treePath }) => {
    const result = winccoa.cns_treeExists(treePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-node-exists", "Check if node exists", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cns_nodeExists(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-is-tree", "Check if given ID is a tree", {
    id: z.string(),
  }, async ({ id }) => {
    const result = winccoa.cns_isTree(id);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-is-node", "Check if given ID is a node", {
    id: z.string(),
  }, async ({ id }) => {
    const result = winccoa.cns_isNode(id);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-children", "Get all child elements of node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetChildren(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-parent", "Get parent node path", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetParent(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-root", "Get root node of tree containing given node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetRoot(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-node-data", "Change datapoint and type of node", {
    nodePath: z.string(),
    dpElement: z.string(),
    nodeType: z.string().optional(),
  }, async ({ nodePath, dpElement, nodeType }) => {
    const result = await winccoa.cnsChangeNodeData(nodePath, dpElement, nodeType);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-node-display-names", "Change display names of node", {
    nodePath: z.string(),
    displayNames: z.record(z.string(), z.string()),
  }, async ({ nodePath, displayNames }) => {
    const result = await winccoa.cnsChangeNodeDisplayNames(nodePath, displayNames);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-node-name", "Change ID of node", {
    oldNodePath: z.string(),
    newNodeId: z.string(),
  }, async ({ oldNodePath, newNodeId }) => {
    const result = await winccoa.cnsChangeNodeName(oldNodePath, newNodeId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-tree", "Replace tree with new tree", {
    treePath: z.string(),
    newTreeStructure: z.any(),
  }, async ({ treePath, newTreeStructure }) => {
    const result = await winccoa.cnsChangeTree(treePath, newTreeStructure);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CNS/UNS DATA AND PROPERTY MANAGEMENT TOOLS ====================

  server.tool("cns-get-id", "Get linked datapoint and type of node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetId(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-id-set", "Get datapoint names linked to matching nodes", {
    nodePattern: z.string(),
  }, async ({ nodePattern }) => {
    const result = winccoa.cnsGetIdSet(nodePattern);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-nodes-by-data", "Find nodes linked to datapoint", {
    dpElement: z.string(),
  }, async ({ dpElement }) => {
    const result = winccoa.cnsGetNodesByData(dpElement);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-nodes-by-name", "Find nodes matching criteria", {
    namePattern: z.string(),
    viewPattern: z.string().optional(),
    exactMatch: z.boolean().optional(),
  }, async ({ namePattern, viewPattern, exactMatch }) => {
    const result = winccoa.cnsGetNodesByName(namePattern, viewPattern, exactMatch);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-property", "Set property for node as key/value pair", {
    nodePath: z.string(),
    key: z.string(),
    value: z.any(),
  }, async ({ nodePath, key, value }) => {
    const result = await winccoa.cnsSetProperty(nodePath, key, value);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-property", "Get property value from node", {
    nodePath: z.string(),
    key: z.string(),
  }, async ({ nodePath, key }) => {
    const result = winccoa.cnsGetProperty(nodePath, key);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-remove-property", "Remove property key from node", {
    nodePath: z.string(),
    key: z.string(),
  }, async ({ nodePath, key }) => {
    const result = await winccoa.cnsRemoveProperty(nodePath, key);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-property-keys", "Get all property keys for node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetPropertyKeys(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-user-data", "Set user data in node", {
    nodePath: z.string(),
    userData: z.any(),
  }, async ({ nodePath, userData }) => {
    const result = await winccoa.cnsSetUserData(nodePath, userData);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-user-data", "Get user data from node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetUserData(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CNS/UNS DISPLAY AND ICON MANAGEMENT TOOLS ====================

  server.tool("cns-get-display-names", "Get display names of node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetDisplayNames(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-display-path", "Get display name path of node", {
    nodePath: z.string(),
    language: z.string().optional(),
  }, async ({ nodePath, language }) => {
    const result = winccoa.cnsGetDisplayPath(nodePath, language);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-node-icon", "Get icon path for node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cns_getNodeIcon(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-node-icon", "Set icon for node", {
    nodePath: z.string(),
    iconPath: z.string(),
  }, async ({ nodePath, iconPath }) => {
    const result = await winccoa.cns_setNodeIcon(nodePath, iconPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CNS/UNS NODE TYPE MANAGEMENT TOOLS ====================

  server.tool("cns-create-node-type", "Create new node type", {
    nodeTypeName: z.string(),
    displayNames: z.record(z.string(), z.string()).optional(),
    iconPath: z.string().optional(),
    value: z.any().optional(),
  }, async ({ nodeTypeName, displayNames, iconPath, value }) => {
    const result = await winccoa.cns_createNodeType(nodeTypeName, displayNames, iconPath, value);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-delete-node-type", "Delete node type", {
    nodeTypeName: z.string(),
  }, async ({ nodeTypeName }) => {
    const result = await winccoa.cns_deleteNodeType(nodeTypeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-node-types", "Get all node types", {}, async () => {
    const result = winccoa.cns_getNodeTypes();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-change-node-type-name", "Change name of node type", {
    oldTypeName: z.string(),
    newTypeName: z.string(),
  }, async ({ oldTypeName, newTypeName }) => {
    const result = await winccoa.cns_changeNodeTypeName(oldTypeName, newTypeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-node-type-display-name", "Get display name of node type", {
    nodeTypeName: z.string(),
  }, async ({ nodeTypeName }) => {
    const result = winccoa.cns_getNodeTypeDisplayName(nodeTypeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-node-type-display-name", "Set display name for node type", {
    nodeTypeName: z.string(),
    displayNames: z.record(z.string(), z.string()),
  }, async ({ nodeTypeName, displayNames }) => {
    const result = await winccoa.cns_setNodeTypeDisplayName(nodeTypeName, displayNames);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-node-type-icon", "Get icon path of node type", {
    nodeTypeName: z.string(),
  }, async ({ nodeTypeName }) => {
    const result = winccoa.cns_getNodeTypeIcon(nodeTypeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-node-type-icon", "Set icon for node type", {
    nodeTypeName: z.string(),
    iconPath: z.string(),
  }, async ({ nodeTypeName, iconPath }) => {
    const result = await winccoa.cns_setNodeTypeIcon(nodeTypeName, iconPath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-node-type-value", "Get value of node type", {
    nodeTypeName: z.string(),
  }, async ({ nodeTypeName }) => {
    const result = winccoa.cns_getNodeTypeValue(nodeTypeName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-node-type-value", "Set value of node type", {
    nodeTypeName: z.string(),
    value: z.any(),
  }, async ({ nodeTypeName, value }) => {
    const result = await winccoa.cns_setNodeTypeValue(nodeTypeName, value);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CNS/UNS SYSTEM MANAGEMENT TOOLS ====================

  server.tool("cns-get-system-names", "Get display names of system", {
    systemName: z.string(),
  }, async ({ systemName }) => {
    const result = winccoa.cnsGetSystemNames(systemName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-set-system-names", "Set display names for system", {
    systemName: z.string(),
    displayNames: z.record(z.string(), z.string()),
  }, async ({ systemName, displayNames }) => {
    const result = await winccoa.cnsSetSystemNames(systemName, displayNames);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CNS/UNS OBSERVER MANAGEMENT TOOLS ====================

  server.tool("cns-add-observer", "Register CNS observer function", {
    observerCallback: z.string(),
  }, async ({ observerCallback }) => {
    console.log(`Registering CNS observer: ${observerCallback}`);
    // Note: This would need special implementation as it involves callback functions
    return {content: [{type: "text", text: "CNS Observer registration requires callback implementation"}]};
  });

  server.tool("cns-remove-observer", "Unregister CNS observer function", {
    observerCallback: z.string(),
  }, async ({ observerCallback }) => {
    console.log(`Unregistering CNS observer: ${observerCallback}`);
    // Note: This would need special implementation as it involves callback functions
    return {content: [{type: "text", text: "CNS Observer deregistration requires callback implementation"}]};
  });

  // ==================== CNS/UNS UTILITY TOOLS ====================

  server.tool("cns-sub-str", "Extract parts of CNS path", {
    cnsPath: z.string(),
    pattern: z.string(),
  }, async ({ cnsPath, pattern }) => {
    const result = winccoa.cnsSubStr(cnsPath, pattern);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-opc-access-right", "Get OPC access rights for node", {
    nodePath: z.string(),
  }, async ({ nodePath }) => {
    const result = winccoa.cnsGetOPCAccessRight(nodePath);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-check-id", "Check if CNS ID is valid", {
    id: z.string(),
  }, async ({ id }) => {
    const result = winccoa.cns_checkId(id);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-check-name", "Check if CNS name is valid", {
    name: z.string(),
  }, async ({ name }) => {
    const result = winccoa.cns_checkName(name);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-check-separator", "Check if CNS separator is valid", {
    separator: z.string(),
  }, async ({ separator }) => {
    const result = winccoa.cns_checkSeparator(separator);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("cns-get-readable-views", "Get views available for permission", {
    permission: z.number(),
  }, async ({ permission }) => {
    const result = winccoa.cns_getReadableViews(permission);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });*/
}

function init_mgmnt(winccoa, server) {
  // ==================== SYSTEM INFORMATION TOOLS ====================

  /*server.tool("get-system-id", "Get system ID", {
    systemName: z.string().optional(),
  }, async ({ systemName }) => {
    const result = winccoa.getSystemId(systemName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-system-name", "Get system name", {
    systemId: z.number().optional(),
  }, async ({ systemId }) => {
    const result = winccoa.getSystemName(systemId);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-user-id", "Get user ID", {
    userName: z.string().optional(),
  }, async ({ userName }) => {
    const result = winccoa.getUserId(userName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-user-name", "Get user name", {
    id: z.number().optional(),
  }, async ({ id }) => {
    const result = winccoa.getUserName(id);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-versions", "Get API and WinCC OA versions", {}, async () => {
    const result = winccoa.getVersions();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-project-languages", "Get project language names", {}, async () => {
    const result = winccoa.getProjectLanguages();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-paths", "Get project and installation paths", {}, async () => {
    const result = winccoa.getPaths();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-config", "Get config file content", {
    configName: z.string().optional(),
    directoryLevel: z.number().optional(),
  }, async ({ configName, directoryLevel }) => {
    const result = winccoa.getConfig(configName, directoryLevel);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("is-redu-system", "Check if project is redundant", {}, async () => {
    const result = winccoa.isReduSystem();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("is-redu-host", "Check if event manager is active REDU partner", {}, async () => {
    const result = winccoa.isReduHost();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-redu-host", "Get event manager host name", {}, async () => {
    const result = winccoa.getReduHost();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("get-redu-host-num", "Get host number in redundant system", {}, async () => {
    const result = winccoa.getReduHostNum();
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("is-debug-set", "Check if debug flag is set", {
    flag: z.union([z.string(), z.number()]),
  }, async ({ flag }) => {
    const result = winccoa.isDebugSet(flag);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("debug", "Write debug log entry", {
    flag: z.union([z.string(), z.number()]),
    message: z.string(),
  }, async ({ flag, message }) => {
    winccoa.debug(flag, message);
    return {content: [{type: "text", text: "Debug message written"}]};
  });

  // ==================== UTILITY TOOLS ====================

  server.tool("name-check", "Check if name contains invalid characters", {
    name: z.string(),
    checkType: z.number(),
  }, async ({ name, checkType }) => {
    const result = await winccoa.nameCheck(name, checkType);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("file-search", "Search for file in WinCC OA paths", {
    fileName: z.string(),
  }, async ({ fileName }) => {
    const result = winccoa.fileSearch(fileName);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  // ==================== CRYPTOGRAPHY TOOLS ====================

  server.tool("encrypt", "Encrypt text/data", {
    plaintext: z.any(),
    passphrase: z.string(),
    cipherConfig: z.string().optional(),
  }, async ({ plaintext, passphrase, cipherConfig }) => {
    const result = await winccoa.encrypt(plaintext, passphrase, cipherConfig);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("decrypt-to-string", "Decrypt to string", {
    ciphertext: z.string(),
    passphrase: z.string(),
  }, async ({ ciphertext, passphrase }) => {
    const result = await winccoa.decryptToString(ciphertext, passphrase);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("crypt", "Create cryptographic hash", {
    text: z.string(),
    version: z.number().optional(),
    iterations: z.number().optional(),
  }, async ({ text, version, iterations }) => {
    const result = await winccoa.crypt(text, version, iterations);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });

  server.tool("check-crypt", "Check if hash is valid for text", {
    text: z.string(),
    hash: z.string(),
  }, async ({ text, hash }) => {
    const result = await winccoa.checkCrypt(text, hash);
    return {content: [{type: "text", text: JSON.stringify(result)}]};
  });*/
}

export function init_tools() {
//console.error("init_tools 0");
  winccoa = new WinccoaManager();
  // Create server instance
//console.error("init_tools 1");
  server = new McpServer({
    name: "WinCC OA Extended with CNS/UNS",
    version: "3.0.0",
    capabilities: {
      resources: {},
      tools: {},
    },
  });
//console.error("init_tools 2");

  init_dp(winccoa, server);
//console.error("init_tools 3");
  init_alert(winccoa, server);
//console.error("init_tools 4");
  init_cns(winccoa, server);
//console.error("init_tools 5");
  init_mgmnt(winccoa, server);
//console.error("init_tools 6");
  return server;  
}

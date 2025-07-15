import fs from 'fs';
let instance = null;
const dpName = "MCPTool"

class State {
    async init(oaManager) {
        if (!instance) {
            this.oaManager = oaManager;
            const values = await this.oaManager.dpGet([`${dpName}.keyPath`, 
                `${dpName}.certPath`, 
                `${dpName}.token`,
                `${dpName}.mainInstructionsPath`,
                `${dpName}.plantSpecificInstructionsPath`,
                `${dpName}.viewName`
            ]);
            this.state = {
                keyPath: values[0],
                certPath: values[1],
                token: values[2],
                rules: {}
            }

            this.state.mainInstructions = fs.readFileSync(values[3],'utf-8');
            this.state.specificInstructions = fs.readFileSync(values[4],'utf-8');

            const viewName = values[5];
            this.state.tree = getCnsTree(this.oaManager, viewName);
            const rules = parseFieldRules(this.state.mainInstructions).allowed_patterns
            .concat(parseFieldRules(this.state.specificInstructions).allowed_patterns);
            this.state.rules.allowed_patterns = [...(new Set(rules))];
            instance = this
        }

        return instance
    }
    getState() {
        return instance.state
    }
}

function getCnsTree(winccoa, viewName) {
    const trees = winccoa.cnsGetTrees(viewName);
    const root = winccoa.cnsGetRoot(trees[0]);
    const tree = {};
    tree[winccoa.cnsGetDisplayNames(root)] = getChildrenNodesOrValue(winccoa, root);
    return tree;
}

function getChildrenNodesOrValue(winccoa, nodePath) {
    const dpName = winccoa.cnsGetId(nodePath)
    if (dpName !== null && dpName !== undefined && dpName !== '') {
        return { dpName: dpName };
    }
    else {
        const children = winccoa.cnsGetChildren(nodePath);
        const childrenNodes = {};
        children.forEach(element => {
            childrenNodes[winccoa.cnsGetDisplayNames(element)] = getChildrenNodesOrValue(winccoa, element);
        });
        return childrenNodes;
    }
}

/**
 * Parse field instructions to extract rules
 * @param {string} content - The markdown content
 * @returns {Object} Parsed rules and patterns
 */
export function parseFieldRules(content) {
  const rules = {
    allowed_patterns: [],
  };
  
  const lines = content.split('\n');
  let inDatapointSection = false;
  
  for (const line of lines) {
    if (line.includes('Datapoint Naming Conventions') || line.includes('Datapoint Conventions')) {
      inDatapointSection = true;
      continue;
    }
    
    if (inDatapointSection && line.startsWith('#')) {
      inDatapointSection = false;
      continue;
    }
    
    if (inDatapointSection && line.includes('`')) {
      const matches = line.match(/`([^`]+)`/g);
      if (matches) {
        for (const match of matches) {
          const pattern = match.replace(/`/g, '');
          if (pattern.includes('*')) {
            if (line.toLowerCase().includes('ai manipulation') ||
                      line.toLowerCase().includes('designated for ai')) {
              rules.allowed_patterns.push(pattern);
            }
          }
        }
      }
    }
  }
  return rules;
}

export default State;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Try to load dotenv if available
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (error) {
  // dotenv not available, continue without it
  console.log('dotenv not available, using environment variables directly');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all field configuration files from the fields directory
 * @returns {Promise<Object>} Object with field names as keys and content as values
 */
export async function loadFieldConfigurations() {
  const fieldsDir = path.join(__dirname, 'fields');
  const configs = {};
  
  try {
    // Check if fields directory exists
    await fs.access(fieldsDir);
    
    // Read all files in the fields directory
    const files = await fs.readdir(fieldsDir);
    
    // Load each markdown file
    for (const file of files) {
      if (file.endsWith('.md')) {
        const fieldName = path.basename(file, '.md');
        const filePath = path.join(fieldsDir, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          configs[fieldName] = {
            name: fieldName,
            content: content,
            path: filePath
          };
          console.log(`Loaded field configuration: ${fieldName}`);
        } catch (error) {
          console.error(`Error loading field ${fieldName}:`, error);
        }
      }
    }
    
    // Ensure default configuration exists
    if (!configs.default) {
      configs.default = {
        name: 'default',
        content: '# Default Configuration\n\nNo specific field instructions available.',
        path: null
      };
    }
    
  } catch (error) {
    console.error('Error accessing fields directory:', error);
    // Return minimal default if directory doesn't exist
    configs.default = {
      name: 'default',
      content: '# Default Configuration\n\nNo field configurations found.',
      path: null
    };
  }
  
  return configs;
}

/**
 * Get the active field from environment variable
 * @returns {string} The active field name, defaults to 'default'
 */
export function getActiveField() {
  const field = process.env.WINCCOA_FIELD || 'default';
  console.log(`Active field: ${field}`);
  return field;
}

/**
 * Load project-specific configuration if available
 * @returns {Promise<Object|null>} Project configuration or null
 */
export async function loadProjectConfiguration() {
  const projectPath = process.env.WINCCOA_PROJECT_INSTRUCTIONS;
  
  if (!projectPath) {
    console.log('No project configuration specified (WINCCOA_PROJECT_INSTRUCTIONS not set)');
    return null;
  }
  
  try {
    // Resolve the path (could be absolute or relative)
    const resolvedPath = path.resolve(projectPath);
    
    // Check if file exists
    await fs.access(resolvedPath);
    
    // Read the project configuration
    const content = await fs.readFile(resolvedPath, 'utf8');
    
    console.log(`Loaded project configuration from: ${resolvedPath}`);
    
    return {
      name: path.basename(resolvedPath, path.extname(resolvedPath)),
      path: resolvedPath,
      content: content
    };
  } catch (error) {
    console.error(`Error loading project configuration from ${projectPath}:`, error.message);
    return null;
  }
}

/**
 * Merge project and field instructions
 * @param {string} fieldContent - Field instructions content
 * @param {string} projectContent - Project instructions content
 * @returns {string} Merged content with project taking precedence
 */
export function mergeInstructions(fieldContent, projectContent) {
  if (!projectContent) {
    return fieldContent;
  }
  
  // Create merged content with clear sections
  const merged = `# Combined Instructions (Project + Field)

## Project-Specific Instructions
${projectContent}

---

## Field Base Instructions
${fieldContent}

---

## Note
Project-specific rules take precedence over field rules.
When in doubt, follow the project-specific instructions above.`;

  return merged;
}

/**
 * Merge project and field rules
 * @param {Object} fieldRules - Parsed field rules
 * @param {Object} projectRules - Parsed project rules
 * @returns {Object} Merged rules with project taking precedence
 */
export function mergeRules(fieldRules, projectRules) {
  // Start with field rules as base
  const merged = {
    allowed_patterns: [...(fieldRules.allowed_patterns || [])],
    forbidden_patterns: [...(fieldRules.forbidden_patterns || [])],
    warning_patterns: [...(fieldRules.warning_patterns || [])]
  };
  
  // Add project rules (these take precedence)
  if (projectRules.allowed_patterns) {
    merged.allowed_patterns = [...projectRules.allowed_patterns, ...merged.allowed_patterns];
  }
  
  if (projectRules.forbidden_patterns) {
    // Project forbidden patterns are added to the beginning (checked first)
    merged.forbidden_patterns = [...projectRules.forbidden_patterns, ...merged.forbidden_patterns];
  }
  
  if (projectRules.warning_patterns) {
    merged.warning_patterns = [...projectRules.warning_patterns, ...merged.warning_patterns];
  }
  
  // Remove duplicates while preserving order (first occurrence wins)
  merged.allowed_patterns = [...new Set(merged.allowed_patterns)];
  merged.forbidden_patterns = [...new Set(merged.forbidden_patterns)];
  merged.warning_patterns = [...new Set(merged.warning_patterns)];
  
  return merged;
}

/**
 * Parse field instructions to extract rules
 * @param {string} content - The markdown content
 * @returns {Object} Parsed rules and patterns
 */
export function parseFieldRules(content) {
  const rules = {
    allowed_patterns: [],
    forbidden_patterns: [],
    warning_patterns: []
  };
  
  // Extract patterns from markdown content
  // Look for datapoint naming conventions section
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
      // Extract pattern from backticks
      const matches = line.match(/`([^`]+)`/g);
      if (matches) {
        for (const match of matches) {
          const pattern = match.replace(/`/g, '');
          if (pattern.includes('*')) {
            // Classify based on description
            if (line.toLowerCase().includes('read only') || 
                line.toLowerCase().includes('read-only') ||
                line.toLowerCase().includes('strictly')) {
              rules.forbidden_patterns.push(pattern);
            } else if (line.toLowerCase().includes('validation') || 
                      line.toLowerCase().includes('requires') ||
                      line.toLowerCase().includes('coordinate')) {
              rules.warning_patterns.push(pattern);
            } else if (line.toLowerCase().includes('ai manipulation') ||
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
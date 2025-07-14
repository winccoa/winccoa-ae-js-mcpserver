import { parseFieldRules, mergeRules } from '../field_loader.js';

/**
 * Validate datapoint access against field and project rules
 * @param {string} dpeName - Datapoint element name
 * @param {Object} context - Server context with field configs and project config
 * @returns {Object} Validation result with allowed, warning, and error information
 */
export function validateDatapointAccess(dpeName, context) {
  const { fieldConfigs, activeFieldName, projectConfig } = context;
  
  // Get field rules
  const fieldConfig = fieldConfigs[activeFieldName] || fieldConfigs.default;
  const fieldRules = parseFieldRules(fieldConfig.content);
  
  // Merge with project rules if available
  let rules = fieldRules;
  if (projectConfig) {
    const projectRules = parseFieldRules(projectConfig.content);
    rules = mergeRules(fieldRules, projectRules);
  }
  
  return validateAgainstRules(dpeName, rules, activeFieldName);
}

/**
 * Validate datapoint against specific rules
 * @param {string} dpeName - Datapoint element name
 * @param {Object} rules - Validation rules object
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} Validation result
 */
export function validateAgainstRules(dpeName, rules, fieldName) {
  const result = {
    allowed: false,
    warning: null,
    error: null,
    pattern: null
  };
  
  // Check forbidden patterns first (highest priority)
  for (const pattern of rules.forbidden_patterns || []) {
    if (matchesPattern(dpeName, pattern)) {
      result.error = `Datapoint '${dpeName}' matches forbidden pattern '${pattern}' in ${fieldName} field configuration. This datapoint is read-only.`;
      result.pattern = pattern;
      return result;
    }
  }
  
  // Check allowed patterns
  for (const pattern of rules.allowed_patterns || []) {
    if (matchesPattern(dpeName, pattern)) {
      result.allowed = true;
      result.pattern = pattern;
      break;
    }
  }
  
  // Check warning patterns
  for (const pattern of rules.warning_patterns || []) {
    if (matchesPattern(dpeName, pattern)) {
      result.warning = `Warning: Datapoint '${dpeName}' matches pattern '${pattern}' which requires validation in ${fieldName} field.`;
      result.pattern = pattern;
      if (!result.allowed) {
        // If not explicitly allowed, treat as allowed with warning
        result.allowed = true;
      }
      break;
    }
  }
  
  // If no explicit rules found, check if we have any allowed patterns
  if (!result.allowed && !result.warning && rules.allowed_patterns && rules.allowed_patterns.length > 0) {
    result.error = `Datapoint '${dpeName}' is not in the allowed patterns for ${fieldName} field. Allowed patterns: ${rules.allowed_patterns.join(', ')}`;
  } else if (!result.allowed && !result.warning && !result.error) {
    // No specific rules defined, allow by default
    result.allowed = true;
  }
  
  return result;
}

/**
 * Check if a datapoint name matches a pattern (supports wildcards)
 * @param {string} dpeName - Datapoint element name
 * @param {string} pattern - Pattern to match (supports * wildcards)
 * @returns {boolean} True if matches
 */
export function matchesPattern(dpeName, pattern) {
  if (!dpeName || !pattern) return false;
  
  // Convert wildcard pattern to regex
  const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
  const regex = new RegExp(regexPattern, 'i'); // Case insensitive
  
  return regex.test(dpeName);
}

/**
 * Get validation summary for display
 * @param {Object} validation - Validation result
 * @returns {string} Human-readable validation summary
 */
export function getValidationSummary(validation) {
  if (validation.error) {
    return `❌ FORBIDDEN: ${validation.error}`;
  }
  
  if (validation.warning) {
    return `⚠️ WARNING: ${validation.warning}`;
  }
  
  if (validation.allowed) {
    const pattern = validation.pattern ? ` (matched pattern: ${validation.pattern})` : '';
    return `✅ ALLOWED${pattern}`;
  }
  
  return '❓ UNKNOWN: No specific validation rules found';
}

/**
 * Check if a datapoint operation should be logged based on project configuration
 * @param {string} dpeName - Datapoint element name
 * @param {Object} context - Server context
 * @returns {boolean} True if should be logged
 */
export function shouldLogOperation(dpeName, context) {
  // Check if project config defines critical patterns for logging
  const { projectConfig } = context;
  
  if (projectConfig && projectConfig.content) {
    // Extract logging patterns from project config
    const loggingPatterns = extractLoggingPatterns(projectConfig.content);
    if (loggingPatterns.length > 0) {
      return loggingPatterns.some(pattern => matchesPattern(dpeName, pattern));
    }
  }
  
  // Default: no automatic logging unless specified in project config
  return false;
}

/**
 * Extract logging patterns from project configuration
 * @param {string} content - Project configuration content
 * @returns {Array<string>} Array of patterns that should trigger logging
 */
function extractLoggingPatterns(content) {
  const patterns = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Look for logging indicators in project config
    if (line.toLowerCase().includes('critical') && line.includes('`')) {
      const matches = line.match(/`([^`]+)`/g);
      if (matches) {
        patterns.push(...matches.map(m => m.replace(/`/g, '')));
      }
    }
  }
  
  return patterns;
}
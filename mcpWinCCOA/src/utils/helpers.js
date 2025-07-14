/**
 * Create content array for MCP responses, filtering internal types if needed
 * @param {Array} arr - Array of type names
 * @param {boolean} withInternals - Whether to include internal types (starting with _)
 * @returns {Array} Content array for MCP response
 */
export function mkTypesContent(arr, withInternals) {
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

/**
 * Recursively add full path and unit information to datapoint children
 * @param {Array} children - Array of child datapoint elements
 * @param {string} parentPath - Parent datapoint path
 * @param {Object} winccoa - WinCC OA manager instance
 */
export function addFullPathAndUnitToChildren(children, parentPath, winccoa) {
  children.forEach(child => {
    const currentPath = `${parentPath}.${child.name}`;
    if (Array.isArray(child.children) && child.children.length > 0) {
      addFullPathAndUnitToChildren(child.children, currentPath, winccoa);
    } else {
      if (winccoa.dpElementType !== 1) {
        child.unit = winccoa.dpGetUnit(currentPath);
        child.description = winccoa.dpGetDescription(currentPath);
      }
    }
  });
}

/**
 * Create standardized error response for MCP tools
 * @param {string} message - Error message
 * @param {string} code - Error code (optional)
 * @returns {Object} MCP error response
 */
export function createErrorResponse(message, code = 'TOOL_ERROR') {
  return {
    content: [{
      type: "text", 
      text: JSON.stringify({
        error: true,
        code,
        message
      })
    }]
  };
}

/**
 * Create standardized success response for MCP tools
 * @param {any} result - Result data
 * @param {string} message - Optional success message
 * @returns {Object} MCP success response
 */
export function createSuccessResponse(result, message = null) {
  const response = {
    success: true,
    data: result
  };
  
  if (message) {
    response.message = message;
  }
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(response)
    }]
  };
}

/**
 * Validate datapoint name format
 * @param {string} dpName - Datapoint name to validate
 * @returns {boolean} True if valid
 */
export function isValidDatapointName(dpName) {
  if (!dpName || typeof dpName !== 'string') {
    return false;
  }
  
  // Basic validation: should not be empty, no special chars that break WinCC OA
  return dpName.length > 0 && !dpName.includes('..') && !dpName.startsWith('.');
}

/**
 * Sanitize datapoint name for safe usage
 * @param {string} dpName - Datapoint name to sanitize
 * @returns {string} Sanitized datapoint name
 */
export function sanitizeDatapointName(dpName) {
  if (!dpName) return '';
  return dpName.trim().replace(/[<>:"\\|?*]/g, '_');
}
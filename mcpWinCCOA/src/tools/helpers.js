export function mkTypesContent(arr, withInternals) {
  const ret = [];
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].startsWith('_')) {
      ret.push({ type: "text", text: arr[i] });
    } else if (withInternals) {
      ret.push({ type: "text", text: arr[i] });
    }
  }
  return ret;
}


export function addDescAndUnits(children, parentPath, winccoa) {
  children.forEach(child => {
    const currentPath = `${parentPath}.${child.name}`;
    if (Array.isArray(child.children) && child.children.length > 0) {
      addDescAndUnits(child.children, currentPath, winccoa);
    } else {
      if (winccoa.dpElementType !== 1) {
        child.unit = winccoa.dpGetUnit(currentPath);
        child.description = winccoa.dpGetDescription(currentPath);
      }
    }
  });
}

export function validateAgainstRules(dpeName, rules) {
  if (rules.allowed_patterns.some(pattern => matchesPattern(dpeName, pattern))) {
    return true;
  }
  return false;
}

function matchesPattern(dpeName, pattern) {
  if (!dpeName || !pattern) return false;

  const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
  const regex = new RegExp(regexPattern, 'i'); // Case insensitive

  return regex.test(dpeName);
}
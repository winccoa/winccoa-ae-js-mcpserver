/**
 * Unit tests for src/utils/helpers.ts
 *
 * These tests cover all pure utility functions that do not require
 * a running WinCC OA instance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  isValidDatapointName,
  isValidDatapointElementForGet,
  validateDatapointElementsForGet,
  filterTypeNames,
  describeWinccoaError,
  logWinccoaError
} from '../../../src/utils/helpers.js';

// ---------------------------------------------------------------------------
// createSuccessResponse
// ---------------------------------------------------------------------------

describe('createSuccessResponse', () => {
  it('returns a content array with one text element', () => {
    const response = createSuccessResponse({ value: 42 });
    expect(response.content).toHaveLength(1);
    expect(response.content[0]!.type).toBe('text');
  });

  it('sets success=true and embeds data', () => {
    const response = createSuccessResponse({ key: 'val' });
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ key: 'val' });
  });

  it('includes optional message when provided', () => {
    const response = createSuccessResponse({}, 'Done');
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.message).toBe('Done');
  });

  it('omits message field when not provided', () => {
    const response = createSuccessResponse({});
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.message).toBeUndefined();
  });

  it('handles primitive data types', () => {
    const response = createSuccessResponse(42);
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.data).toBe(42);
  });

  it('handles array data', () => {
    const response = createSuccessResponse([1, 2, 3]);
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.data).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// createErrorResponse
// ---------------------------------------------------------------------------

describe('createErrorResponse', () => {
  it('returns a content array with one text element', () => {
    const response = createErrorResponse('Oops');
    expect(response.content).toHaveLength(1);
    expect(response.content[0]!.type).toBe('text');
  });

  it('sets error=true with the provided message', () => {
    const response = createErrorResponse('Something failed');
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toBe('Something failed');
  });

  it('includes code when a string is passed as second argument', () => {
    const response = createErrorResponse('Not found', 'NOT_FOUND');
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.code).toBe('NOT_FOUND');
  });

  it('merges object into response when object passed as second argument', () => {
    const response = createErrorResponse('Failed', { details: 'info', stack: 'trace' });
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.details).toBe('info');
    expect(parsed.stack).toBe('trace');
  });

  it('does not set code when no second argument is provided', () => {
    const response = createErrorResponse('Error');
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.code).toBeUndefined();
  });

  it('does not modify the error or message fields when merging an object', () => {
    const response = createErrorResponse('Err', { custom: true });
    const parsed = JSON.parse(response.content[0]!.text);
    expect(parsed.error).toBe(true);
    expect(parsed.message).toBe('Err');
    expect(parsed.custom).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidDatapointName
// ---------------------------------------------------------------------------

describe('isValidDatapointName', () => {
  it('accepts a simple alphanumeric name', () => {
    expect(isValidDatapointName('MyDP')).toBe(true);
  });

  it('accepts a dotted path like System1.DP1', () => {
    expect(isValidDatapointName('System1.DP1')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidDatapointName('')).toBe(false);
  });

  it('rejects a name starting with a dot', () => {
    expect(isValidDatapointName('.MyDP')).toBe(false);
  });

  it('rejects a name containing consecutive dots', () => {
    expect(isValidDatapointName('My..DP')).toBe(false);
  });

  it('accepts a name with underscores', () => {
    expect(isValidDatapointName('_Internal_DP')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidDatapointElementForGet
// ---------------------------------------------------------------------------

describe('isValidDatapointElementForGet', () => {
  it('accepts a valid DPE string', () => {
    expect(isValidDatapointElementForGet('MyDP.Value')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidDatapointElementForGet('')).toBe(false);
  });

  it('rejects a string starting with a dot', () => {
    expect(isValidDatapointElementForGet('.MyDP')).toBe(false);
  });

  it('rejects a string with consecutive dots', () => {
    expect(isValidDatapointElementForGet('My..DP')).toBe(false);
  });

  it('rejects a string containing an asterisk wildcard', () => {
    expect(isValidDatapointElementForGet('MyDP.*')).toBe(false);
  });

  it('rejects a bare asterisk', () => {
    expect(isValidDatapointElementForGet('*')).toBe(false);
  });

  it('accepts a DPE with underscores', () => {
    expect(isValidDatapointElementForGet('_System._Config')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateDatapointElementsForGet
// ---------------------------------------------------------------------------

describe('validateDatapointElementsForGet', () => {
  it('returns valid=true and empty invalid array for all-valid inputs', () => {
    const result = validateDatapointElementsForGet(['DP1.Value', 'DP2.Status']);
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it('returns valid=false and lists invalid entries', () => {
    const result = validateDatapointElementsForGet(['DP1.Value', 'DP2.*', '']);
    expect(result.valid).toBe(false);
    expect(result.invalid).toContain('DP2.*');
    expect(result.invalid).toContain('');
  });

  it('handles an empty input array', () => {
    const result = validateDatapointElementsForGet([]);
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterTypeNames
// ---------------------------------------------------------------------------

describe('filterTypeNames', () => {
  it('returns non-internal types', () => {
    expect(filterTypeNames(['TypeA', 'TypeB'])).toEqual(['TypeA', 'TypeB']);
  });

  it('excludes types starting with underscore by default', () => {
    expect(filterTypeNames(['TypeA', '_Internal', 'TypeB'])).toEqual(['TypeA', 'TypeB']);
  });

  it('includes underscore types when withInternals=true', () => {
    expect(filterTypeNames(['TypeA', '_Internal'], true)).toEqual(['TypeA', '_Internal']);
  });

  it('returns an empty array for an empty input', () => {
    expect(filterTypeNames([])).toEqual([]);
  });

  it('skips undefined entries in the array', () => {
    expect(filterTypeNames(['TypeA', undefined, 'TypeB'])).toEqual(['TypeA', 'TypeB']);
  });
});

// ---------------------------------------------------------------------------
// describeWinccoaError
// ---------------------------------------------------------------------------

/** Shape of a WinccoaError: an Error with a numeric code and nested details. */
function oaError(code: number, message: string, details?: unknown): Error {
  return Object.assign(new Error(message), { code, ...(details !== undefined ? { details } : {}) });
}

describe('describeWinccoaError', () => {
  it('uses the inner code and message of a 9399 "multiple errors"', () => {
    const error = oaError(9399, 'multiple errors (2 errors total)', [
      oaError(71, 'DP does not exist, NoSuchDp_XYZ.value:_online.._value'),
      oaError(71, 'DP does not exist, NoSuchDp_XYZ.value:_original.._stime')
    ]);
    const described = describeWinccoaError(error);
    expect(described.code).toBe(71);
    expect(described.outerCode).toBe(9399);
    expect(described.message).toContain('DP does not exist, NoSuchDp_XYZ.value:_online.._value');
    expect(described.message).not.toContain('multiple errors');
    expect(described.details).toHaveLength(2);
    expect(described.details[0]).toEqual({
      code: 71,
      message: 'DP does not exist, NoSuchDp_XYZ.value:_online.._value'
    });
  });

  it('flattens nested details one level', () => {
    const error = oaError(9399, 'multiple errors', [
      oaError(9399, 'multiple errors', [oaError(71, 'DP does not exist, A'), oaError(71, 'DP does not exist, B')]),
      oaError(71, 'DP does not exist, C')
    ]);
    const described = describeWinccoaError(error);
    expect(described.code).toBe(71);
    expect(described.details.map(d => d.message)).toEqual([
      'DP does not exist, A',
      'DP does not exist, B',
      'DP does not exist, C'
    ]);
  });

  it('keeps the outer code when inner codes disagree', () => {
    const error = oaError(9399, 'multiple errors', [oaError(71, 'DP does not exist, A'), oaError(19, 'attribute missing')]);
    const described = describeWinccoaError(error);
    expect(described.code).toBe(9399);
    expect(described.details.map(d => d.code)).toEqual([71, 19]);
  });

  it('handles an error without details', () => {
    expect(describeWinccoaError(oaError(71, 'DP does not exist'))).toEqual({
      code: 71,
      outerCode: 71,
      message: 'DP does not exist',
      details: []
    });
  });

  it('handles a plain Error and a non-Error value', () => {
    expect(describeWinccoaError(new Error('boom'))).toEqual({ message: 'boom', details: [] });
    expect(describeWinccoaError('text')).toEqual({ message: 'text', details: [] });
  });

  it('accepts a single nested error object instead of an array', () => {
    const described = describeWinccoaError(oaError(9399, 'multiple errors', oaError(71, 'DP does not exist, A')));
    expect(described.code).toBe(71);
    expect(described.details).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// logWinccoaError
// ---------------------------------------------------------------------------

describe('logWinccoaError', () => {
  const origLevel = process.env.MCP_LOG_LEVEL;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.MCP_LOG_LEVEL;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (origLevel === undefined) delete process.env.MCP_LOG_LEVEL;
    else process.env.MCP_LOG_LEVEL = origLevel;
  });

  it('logs code 71 as a single warn line without stack', () => {
    const err = Object.assign(new Error('DP does not exist'), { code: 71 });
    logWinccoaError('Error getting type name for X', err);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]).toHaveLength(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('DP does not exist');
    expect(String(warnSpy.mock.calls[0][0])).not.toContain('at ');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs other codes at error level, stack only in debug', () => {
    const err = Object.assign(new Error('boom'), { code: 5 });
    logWinccoaError('ctx', err);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();

    process.env.MCP_LOG_LEVEL = 'debug';
    logWinccoaError('ctx', err);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0][0])).toContain('boom');
  });
});

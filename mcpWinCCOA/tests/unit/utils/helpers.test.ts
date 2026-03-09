/**
 * Unit tests for src/utils/helpers.ts
 *
 * These tests cover all pure utility functions that do not require
 * a running WinCC OA instance.
 */

import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  isValidDatapointName,
  isValidDatapointElementForGet,
  validateDatapointElementsForGet,
  mkTypesContent
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
// mkTypesContent
// ---------------------------------------------------------------------------

describe('mkTypesContent', () => {
  it('returns content items for non-internal types', () => {
    const result = mkTypesContent(['TypeA', 'TypeB']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'text', text: 'TypeA' });
    expect(result[1]).toEqual({ type: 'text', text: 'TypeB' });
  });

  it('excludes types starting with underscore by default', () => {
    const result = mkTypesContent(['TypeA', '_Internal', 'TypeB']);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.text)).not.toContain('_Internal');
  });

  it('includes underscore types when withInternals=true', () => {
    const result = mkTypesContent(['TypeA', '_Internal'], true);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.text)).toContain('_Internal');
  });

  it('returns an empty array for an empty input', () => {
    const result = mkTypesContent([]);
    expect(result).toHaveLength(0);
  });

  it('skips undefined entries in the array', () => {
    const arr = ['TypeA', undefined as unknown as string, 'TypeB'];
    const result = mkTypesContent(arr);
    expect(result).toHaveLength(2);
  });
});

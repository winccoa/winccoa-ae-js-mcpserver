/**
 * Dashboard Types
 *
 * Defines dashboard configuration and identification types
 */

import type { WidgetInstance } from './schema.js';

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  name: string;
  description: string;
}

/**
 * Dashboard information (as returned by listDashboards)
 */
export interface DashboardInfo {
  id: string; // e.g. "_Dashboard_000001"
  dashboardNumber: number;
  name: string;
  description: string;
  widgetCount: number;
  isPublished: boolean;
}

/**
 * Widget identifier (by ID or by index in array)
 */
export type WidgetIdentifier = { id: string } | { index: number };

/**
 * Check if identifier is by ID
 */
export function isWidgetIdIdentifier(identifier: WidgetIdentifier): identifier is { id: string } {
  return 'id' in identifier;
}

/**
 * Check if identifier is by index
 */
export function isWidgetIndexIdentifier(
  identifier: WidgetIdentifier
): identifier is { index: number } {
  return 'index' in identifier;
}

/**
 * Dashboard datapoint structure (minimal required fields)
 */
export interface DashboardDatapoint {
  id: number;
  isPublished: number; // 0 or 1
  settings: string; // JSON string
  widgets: string[]; // Array of widget JSON strings
}

/**
 * Generate dashboard datapoint name from number
 */
export function getDashboardDatapointName(dashboardNumber: number): string {
  const paddedNumber = dashboardNumber.toString().padStart(6, '0');
  return `_Dashboard_${paddedNumber}`;
}

/**
 * Extract dashboard number from datapoint name
 */
export function extractDashboardNumber(dpName: string): number | null {
  const match = dpName.match(/_Dashboard_0*(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : null;
}

/**
 * Dashboard settings JSON structure
 */
export interface DashboardSettings {
  name: {
    [locale: string]: string; // e.g. "en_US.utf8": "My Dashboard"
  };
  description: {
    [locale: string]: string;
  };
  presentation: {
    margin: null;
    backgroundColor: {
      color: string;
      useDifferentColors: boolean;
      darkModeColor: string;
    };
    transparentWidgets: boolean;
  };
  rangeSelectorValue: {
    state: string;
  };
  icon: null;
  showInMenu: boolean;
}

/**
 * Create default dashboard settings
 */
export function createDefaultDashboardSettings(
  name: string,
  description: string
): DashboardSettings {
  return {
    name: {
      'en_US.utf8': name
    },
    description: {
      'en_US.utf8': description
    },
    presentation: {
      margin: null,
      backgroundColor: {
        color: 'rgba(255,255,255,1)',
        useDifferentColors: true,
        darkModeColor: 'rgba(19,19,19,1)'
      },
      transparentWidgets: false
    },
    rangeSelectorValue: {
      state: 'undefined'
    },
    icon: null,
    showInMenu: false
  };
}

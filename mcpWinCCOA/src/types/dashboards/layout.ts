/**
 * Dashboard Layout Types
 *
 * Defines layout presets and grid positioning for dashboard widgets
 */

/**
 * Grid position with size
 */
export interface GridPosition {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/**
 * Minimum dimensions for widgets
 */
export interface MinimumDimensions {
  minCols: number;
  minRows: number;
}

/**
 * Complete widget dimensions including minimums
 */
export interface WidgetDimensions extends GridPosition, MinimumDimensions {}

/**
 * Layout preset names
 */
export type LayoutPreset = 'auto' | 'small' | 'medium' | 'large' | 'fullwidth';

/**
 * Layout configuration (preset name or explicit position)
 */
export type LayoutConfig = LayoutPreset | GridPosition;

/**
 * Widget size category presets
 */
export interface WidgetSizePreset {
  cols: number;
  rows: number;
  minCols: number;
  minRows: number;
}

/**
 * Map of presets for a widget type
 */
export type WidgetPresets = {
  [K in Exclude<LayoutPreset, 'auto'>]?: WidgetSizePreset;
};

/**
 * Dashboard grid constants
 */
export const DASHBOARD_GRID = {
  /** Total columns in dashboard grid */
  TOTAL_COLUMNS: 50,
  /** Default widget spacing */
  SPACING: 0,
  /** Minimum widget size */
  MIN_SIZE: 3
} as const;

/**
 * Default preset dimensions for Gauge widget
 */
export const GAUGE_PRESETS: WidgetPresets = {
  small: { cols: 4, rows: 4, minCols: 6, minRows: 6 },
  medium: { cols: 6, rows: 6, minCols: 6, minRows: 6 },
  large: { cols: 8, rows: 8, minCols: 6, minRows: 6 }
};

/**
 * Default preset dimensions for Label widget
 */
export const LABEL_PRESETS: WidgetPresets = {
  small: { cols: 4, rows: 3, minCols: 6, minRows: 3 },
  medium: { cols: 6, rows: 3, minCols: 6, minRows: 3 },
  large: { cols: 12, rows: 3, minCols: 6, minRows: 3 }
};

/**
 * Default preset dimensions for Trend widget
 */
export const TREND_PRESETS: WidgetPresets = {
  medium: { cols: 12, rows: 8, minCols: 8, minRows: 8 },
  large: { cols: 16, rows: 12, minCols: 8, minRows: 8 },
  fullwidth: { cols: 24, rows: 8, minCols: 8, minRows: 8 }
};

/**
 * Default preset dimensions for Pie widget
 */
export const PIE_PRESETS: WidgetPresets = {
  small: { cols: 6, rows: 6, minCols: 6, minRows: 6 },
  medium: { cols: 8, rows: 8, minCols: 6, minRows: 6 },
  large: { cols: 12, rows: 12, minCols: 6, minRows: 6 }
};

/**
 * Get presets for a widget type
 */
export function getWidgetPresets(widgetType: string): WidgetPresets {
  switch (widgetType) {
    case 'gauge':
      return GAUGE_PRESETS;
    case 'label':
      return LABEL_PRESETS;
    case 'trend':
      return TREND_PRESETS;
    case 'pie':
      return PIE_PRESETS;
    default:
      // Default to medium gauge preset for unknown types
      return GAUGE_PRESETS;
  }
}

/**
 * Get default dimensions for a widget type
 */
export function getDefaultDimensions(widgetType: string): WidgetSizePreset {
  const presets = getWidgetPresets(widgetType);
  return presets.medium || presets.small || { cols: 6, rows: 6, minCols: 6, minRows: 6 };
}

/**
 * Check if a layout config is a preset name
 */
export function isLayoutPreset(layout: LayoutConfig): layout is LayoutPreset {
  return typeof layout === 'string';
}

/**
 * Check if a layout config is a grid position
 */
export function isGridPosition(layout: LayoutConfig): layout is GridPosition {
  return (
    typeof layout === 'object' &&
    'x' in layout &&
    'y' in layout &&
    'cols' in layout &&
    'rows' in layout
  );
}

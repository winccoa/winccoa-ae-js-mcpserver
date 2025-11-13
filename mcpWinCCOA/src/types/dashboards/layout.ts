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
  MIN_SIZE: 3,
  /** Grid alignment for auto-positioning (widgets snap to multiples of this value) */
  ALIGNMENT: 4
} as const;

/**
 * Widget Size Presets - Sizing Philosophy
 *
 * All widget sizes follow 4-column grid alignment principle for professional dashboard layouts.
 *
 * SIZING PHILOSOPHY:
 * - Small: Discouraged for production use (hard to read, creates visual clutter)
 * - Medium: RECOMMENDED baseline for professional dashboards (optimal readability)
 * - Large: For emphasis or data-heavy widgets requiring more space
 * - Fullwidth: Special case for single-row spanning widgets
 *
 * GRID ALIGNMENT:
 * - Dashboard width: 50 columns
 * - Recommended column widths: 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48
 * - Using 4-column increments ensures perfect grid alignment
 * - Examples: 8 cols = 1/6 width (6 per row), 12 cols = 1/4 width (4 per row), 24 cols = 1/2 width (2 per row)
 *
 * DESIGN GUIDELINES:
 * - Consistent sizing within widget groups creates professional appearance
 * - Medium (8x8 gauge, 12x8 chart, 24x8 trend) creates the "Tunnel Lighting System" look
 * - Avoid mixing small/medium/large randomly - leads to unstructured layouts
 */

/**
 * Default preset dimensions for Gauge widget
 */
export const GAUGE_PRESETS: WidgetPresets = {
  medium: { cols: 8, rows: 8, minCols: 6, minRows: 6 },
  large: { cols: 8, rows: 8, minCols: 6, minRows: 6 }
};

/**
 * Default preset dimensions for Label widget
 */
export const LABEL_PRESETS: WidgetPresets = {
  medium: { cols: 8, rows: 4, minCols: 6, minRows: 3 },
  large: { cols: 12, rows: 4, minCols: 6, minRows: 3 }
};

/**
 * Default preset dimensions for Trend widget
 */
export const TREND_PRESETS: WidgetPresets = {
  medium: { cols: 24, rows: 8, minCols: 8, minRows: 8 },
  large: { cols: 24, rows: 12, minCols: 8, minRows: 8 },
  fullwidth: { cols: 24, rows: 8, minCols: 8, minRows: 8 }
};

/**
 * Default preset dimensions for Pie widget
 */
export const PIE_PRESETS: WidgetPresets = {
  medium: { cols: 8, rows: 8, minCols: 6, minRows: 6 },
  large: { cols: 12, rows: 12, minCols: 6, minRows: 6 }
};

/**
 * Default preset dimensions for Bar Chart widget
 */
export const BARCHART_PRESETS: WidgetPresets = {
  medium: { cols: 12, rows: 8, minCols: 6, minRows: 6 },
  large: { cols: 16, rows: 10, minCols: 6, minRows: 6 }
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
    case 'barchart':
    case 'progressbar':
      return BARCHART_PRESETS;
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
  return presets.medium || { cols: 8, rows: 8, minCols: 6, minRows: 6 };
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

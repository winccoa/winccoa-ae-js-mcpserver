/**
 * Layout Helper
 *
 * Helper class for resolving widget layouts, finding positions, and validating grid placements.
 */

import type {
  LayoutConfig,
  LayoutPreset,
  GridPosition,
  WidgetDimensions,
  WidgetSizePreset
} from '../../types/dashboards/layout.js';
import {
  isLayoutPreset,
  isGridPosition,
  getWidgetPresets,
  getDefaultDimensions,
  DASHBOARD_GRID
} from '../../types/dashboards/layout.js';
import type { WidgetInstance } from '../../types/dashboards/schema.js';
import type { WidgetType } from '../../types/dashboards/widgets.js';

/**
 * Layout Helper Class
 */
export class LayoutHelper {
  /**
   * Resolve layout configuration to concrete grid position with dimensions
   * @param layout - Layout configuration (preset or explicit position)
   * @param widgetType - Type of widget
   * @param existingWidgets - Array of existing widgets on dashboard
   * @returns Complete widget dimensions
   */
  resolveLayout(
    layout: LayoutConfig | undefined,
    widgetType: WidgetType,
    existingWidgets: WidgetInstance[]
  ): WidgetDimensions {
    // Default to 'auto' if no layout specified
    const resolvedLayout = layout || 'auto';

    // If explicit grid position provided
    if (isGridPosition(resolvedLayout)) {
      const presets = getWidgetPresets(widgetType);
      const defaultPreset = getDefaultDimensions(widgetType);

      return {
        x: resolvedLayout.x,
        y: resolvedLayout.y,
        cols: resolvedLayout.cols,
        rows: resolvedLayout.rows,
        minCols: defaultPreset.minCols,
        minRows: defaultPreset.minRows
      };
    }

    // Layout is a preset name
    const preset = resolvedLayout as LayoutPreset;

    // Get dimensions for the preset
    const dimensions = this.getPresetDimensions(preset, widgetType);

    // If 'auto', find best position automatically
    if (preset === 'auto') {
      const position = this.findAutoPosition(existingWidgets, dimensions);
      return {
        ...position,
        cols: dimensions.cols,
        rows: dimensions.rows,
        minCols: dimensions.minCols,
        minRows: dimensions.minRows
      };
    }

    // For other presets, start at position (0, 0) unless finding a better spot
    const position = this.findAutoPosition(existingWidgets, dimensions);

    return {
      ...position,
      cols: dimensions.cols,
      rows: dimensions.rows,
      minCols: dimensions.minCols,
      minRows: dimensions.minRows
    };
  }

  /**
   * Get preset dimensions for a widget type
   * @param preset - Preset name
   * @param widgetType - Widget type
   * @returns Widget size preset with dimensions
   */
  getPresetDimensions(preset: LayoutPreset, widgetType: WidgetType): WidgetSizePreset {
    // For 'auto', use default (medium) dimensions
    if (preset === 'auto') {
      return getDefaultDimensions(widgetType);
    }

    const presets = getWidgetPresets(widgetType);
    const dimensions = presets[preset];

    if (!dimensions) {
      console.warn(
        `Preset '${preset}' not available for widget type '${widgetType}', using default`
      );
      return getDefaultDimensions(widgetType);
    }

    return dimensions;
  }

  /**
   * Find next available position in grid for a widget
   * Uses simple top-to-bottom, left-to-right placement
   * @param existingWidgets - Array of existing widgets
   * @param widgetSize - Size of widget to place
   * @returns Grid position {x, y}
   */
  findAutoPosition(
    existingWidgets: WidgetInstance[],
    widgetSize: { cols: number; rows: number }
  ): { x: number; y: number } {
    // If no widgets, start at top-left
    if (existingWidgets.length === 0) {
      return { x: 0, y: 0 };
    }

    // Try to find a position by scanning the grid
    const maxY = this.getMaxY(existingWidgets) + 20; // Scan up to 20 rows below last widget

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= DASHBOARD_GRID.TOTAL_COLUMNS - widgetSize.cols; x++) {
        const position = { x, y };
        if (this.isPositionAvailable(position, widgetSize, existingWidgets)) {
          return position;
        }
      }
    }

    // If no position found (shouldn't happen), place below all widgets
    return { x: 0, y: maxY + 1 };
  }

  /**
   * Check if a position is available (no overlap with existing widgets)
   * @param position - Position to check
   * @param size - Size of widget
   * @param existingWidgets - Existing widgets on dashboard
   * @returns true if position is available
   */
  private isPositionAvailable(
    position: { x: number; y: number },
    size: { cols: number; rows: number },
    existingWidgets: WidgetInstance[]
  ): boolean {
    const newWidget = {
      x: position.x,
      y: position.y,
      cols: size.cols,
      rows: size.rows
    };

    // Check against all existing widgets for overlap
    for (const widget of existingWidgets) {
      if (this.widgetsOverlap(newWidget, widget)) {
        return false;
      }
    }

    // Check if widget fits within grid bounds
    return newWidget.x + newWidget.cols <= DASHBOARD_GRID.TOTAL_COLUMNS;
  }

  /**
   * Check if two widgets overlap
   * @param w1 - First widget
   * @param w2 - Second widget
   * @returns true if widgets overlap
   */
  private widgetsOverlap(
    w1: { x: number; y: number; cols: number; rows: number },
    w2: { x: number; y: number; cols: number; rows: number }
  ): boolean {
    return !(
      w1.x + w1.cols <= w2.x || // w1 is left of w2
      w2.x + w2.cols <= w1.x || // w2 is left of w1
      w1.y + w1.rows <= w2.y || // w1 is above w2
      w2.y + w2.rows <= w1.y // w2 is above w1
    );
  }

  /**
   * Get maximum Y coordinate (bottom edge) of existing widgets
   * @param widgets - Array of widgets
   * @returns Maximum Y + rows
   */
  private getMaxY(widgets: WidgetInstance[]): number {
    if (widgets.length === 0) return 0;

    return Math.max(...widgets.map((w) => w.y + w.rows));
  }

  /**
   * Validate grid position
   * @param position - Position to validate
   * @returns true if valid
   */
  validateGridPosition(position: GridPosition): boolean {
    // Check bounds
    if (position.x < 0 || position.y < 0) {
      return false;
    }

    if (position.cols < DASHBOARD_GRID.MIN_SIZE || position.rows < DASHBOARD_GRID.MIN_SIZE) {
      return false;
    }

    if (position.x + position.cols > DASHBOARD_GRID.TOTAL_COLUMNS) {
      return false;
    }

    return true;
  }

  /**
   * Suggest next position for a widget (helper for user)
   * @param existingWidgets - Existing widgets
   * @param widgetType - Type of widget to place
   * @param preset - Optional preset
   * @returns Suggested grid position
   */
  suggestNextPosition(
    existingWidgets: WidgetInstance[],
    widgetType: WidgetType,
    preset: LayoutPreset = 'auto'
  ): WidgetDimensions {
    const dimensions = this.getPresetDimensions(preset === 'auto' ? 'medium' : preset, widgetType);
    const position = this.findAutoPosition(existingWidgets, dimensions);

    return {
      ...position,
      ...dimensions
    };
  }
}

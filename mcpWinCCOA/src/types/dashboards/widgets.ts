/**
 * Widget Configuration Types
 *
 * Defines configuration interfaces for all supported widget types
 */

import type { LayoutConfig } from './layout.js';

/**
 * Widget types (extensible)
 */
export type WidgetType = 'gauge' | 'label' | 'trend' | 'pie' | string;

/**
 * Range settings for widgets with value ranges
 */
export interface RangeSettings {
  type: 'manual' | 'oa'; // manual = user-defined, oa = from datapoint config
  min?: number;
  max?: number;
}

/**
 * Color configuration
 */
export interface ColorConfig {
  color: string;
  useDifferentColors: boolean;
  darkModeColor: string;
}

/**
 * Icon position types
 */
export type IconPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * Font size types
 */
export type FontSize = 'small' | 'medium' | 'large';

/**
 * Icon size types
 */
export type IconSize = 'small' | 'medium' | 'large';

/**
 * Legend position types
 */
export type LegendPosition = 'topleft' | 'topright' | 'bottomleft' | 'bottomright';

/**
 * Label position types
 */
export type LabelPosition = 'inside' | 'outside';

/**
 * Base widget configuration (common to all widgets)
 */
export interface BaseWidgetConfig {
  type: WidgetType;
  title: string;
  layout?: LayoutConfig;
}

/**
 * Gauge chart type
 */
export type GaugeChartType = 'classic' | 'metric' | 'circle' | 'arc';

/**
 * Gauge widget configuration
 */
export interface GaugeConfig extends BaseWidgetConfig {
  type: 'gauge';
  dataPoint: string;
  rangeSettings?: RangeSettings;
  // Optional parameters with defaults in factory
  formatValue?: string; // e.g. "%0.2f"
  unit?: string;
  chartType?: GaugeChartType; // default: 'classic'
  showTooltip?: boolean; // default: true
}

/**
 * Label widget configuration
 */
export interface LabelConfig extends BaseWidgetConfig {
  type: 'label';
  dataPoint: string;
  // Optional styling parameters
  icon?: string;
  iconPosition?: IconPosition; // default: 'left'
  iconSizeFactor?: IconSize; // default: 'medium'
  fontSizeFactor?: FontSize; // default: 'small'
  unitFontSizeFactor?: FontSize; // default: 'small'
  valuePrefix?: string | null;
  valuePostfix?: string | null;
  fontColor?: ColorConfig;
}

/**
 * Trend series configuration for individual datapoints
 */
export interface TrendSeriesConfig {
  dataPoint: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted'; // default: 'solid'
  showCustomYAxis?: boolean; // default: false - creates separate y-axis for this series
  yAxisPosition?: 'left' | 'right'; // default: 'right' when showCustomYAxis is true
}

/**
 * Trend widget configuration
 * Supports single datapoint or multiple datapoints
 */
export interface TrendConfig extends BaseWidgetConfig {
  type: 'trend';
  dataPoint?: string; // Single datapoint
  dataPoints?: string[]; // Multiple datapoints (alternative to single)
  series?: TrendSeriesConfig[]; // Detailed series configuration with custom y-axis
  // Optional chart configuration
  timeRange?: string; // e.g. "now/h", "now/d" - default: "now/h" (current hour)
  rangeSelectorDefault?: string; // e.g. "60min", "24h"
  stacked?: boolean;
  legendType?: 'scroll' | 'plain'; // default: 'scroll'
  legendOrientation?: 'horizontal' | 'vertical'; // default: 'horizontal'
  legendVerticalPosition?: 'top' | 'middle' | 'bottom'; // default: 'top'
  legendHorizontalPosition?: 'left' | 'center' | 'right'; // default: 'center'
  showLegend?: boolean; // default: true
  yAxisRangeSource?: 'auto' | 'manual';
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisColor?: string; // default: ''
  showXAxisGrid?: boolean; // default: false
  showYAxisGrid?: boolean; // default: true
  showRangePicker?: boolean; // default: true
  showTooltip?: boolean; // default: true
  zoom?: number; // default: 1
}

/**
 * Pie chart type
 */
export type PieChartType = 'pie' | 'doughnut' | 'doughnutRounded' | 'halfDoughnut';

/**
 * Pie widget configuration
 */
export interface PieConfig extends BaseWidgetConfig {
  type: 'pie';
  dataPoints: string[]; // Array of datapoint names
  dataPointsDescriptions: string[]; // Descriptions for each slice
  // Optional chart configuration
  chartType?: PieChartType; // default: 'pie'
  labelsShow?: boolean; // default: false
  labelsPosition?: LabelPosition; // default: 'outside'
  labelsDetails?: 'both' | 'value' | 'percentage'; // default: 'value'
  labelLineLength?: number; // default: 10
  legendPosition?: LegendPosition;
  showTooltip?: boolean; // default: true
  colors?: string[]; // Custom colors for slices
  darkModeColors?: string[]; // Custom dark mode colors
}

/**
 * Union of all widget configurations
 */
export type WidgetConfig = GaugeConfig | LabelConfig | TrendConfig | PieConfig;

/**
 * Type guard for Gauge config
 */
export function isGaugeConfig(config: WidgetConfig): config is GaugeConfig {
  return config.type === 'gauge';
}

/**
 * Type guard for Label config
 */
export function isLabelConfig(config: WidgetConfig): config is LabelConfig {
  return config.type === 'label';
}

/**
 * Type guard for Trend config
 */
export function isTrendConfig(config: WidgetConfig): config is TrendConfig {
  return config.type === 'trend';
}

/**
 * Type guard for Pie config
 */
export function isPieConfig(config: WidgetConfig): config is PieConfig {
  return config.type === 'pie';
}

/**
 * Validate trend config has either dataPoint or dataPoints
 */
export function validateTrendConfig(config: TrendConfig): boolean {
  return !!(config.dataPoint || (config.dataPoints && config.dataPoints.length > 0));
}

/**
 * Validate pie config has matching dataPoints and descriptions
 */
export function validatePieConfig(config: PieConfig): boolean {
  return (
    config.dataPoints.length > 0 &&
    config.dataPoints.length === config.dataPointsDescriptions.length
  );
}

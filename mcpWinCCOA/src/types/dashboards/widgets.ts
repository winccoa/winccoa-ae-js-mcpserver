/**
 * Widget Configuration Types
 *
 * Defines configuration interfaces for all supported widget types
 */

import type { LayoutConfig } from './layout.js';

/**
 * Widget types (extensible)
 */
export type WidgetType = 'gauge' | 'label' | 'trend' | 'pie' | 'progressbar' | 'barchart' | string;

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
  // Global appearance settings (for ECharts widgets)
  animation?: boolean; // Enable animations (default: false)
  font?: string; // Font family (default: "Siemens Sans", Arial, Helvetica, sans-serif)
  renderer?: 'svg' | 'canvas'; // Renderer type (default: 'canvas')
  theme?: string; // Theme name (default: auto from system)
  backgroundColor?: string; // Background color (default: 'transparent')
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
  // Visual customization
  color?: string; // Pointer/progress color
  // Data formatting
  format?: string; // Value format (e.g. "%0.2f")
  unit?: string; // Value unit
  name?: string; // Gauge name/title
  // Display mode
  isRelative?: boolean; // Display as percentage (default: false)
  // Chart configuration
  chartType?: GaugeChartType; // default: 'classic'
  showTooltip?: boolean; // default: true
}

/**
 * Label widget configuration
 */
export interface LabelConfig extends BaseWidgetConfig {
  type: 'label';
  dataPoint: string;
  // Visual customization
  color?: string; // Font color
  icon?: string;
  iconPosition?: IconPosition; // default: 'left'
  iconSizeFactor?: IconSize; // default: 'medium'
  // Data formatting
  format?: string; // Value format (e.g. "%0.2f")
  unit?: string; // Value unit
  name?: string; // Prefix text before value
  // Font configuration
  fontSizeFactor?: FontSize; // default: 'small'
  unitFontSizeFactor?: FontSize; // default: 'small'
  // Legacy/advanced options
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
  // Visual customization
  showArea?: boolean; // Fill area under line (default: false)
  showConfidenceBand?: boolean; // Show min/max confidence band (default: false)
  color?: string; // Custom series color (hex or CSS variable)
  // Data formatting
  unit?: string; // Display unit (e.g., "°C", "bar")
  format?: string; // Number format (e.g., "%0.2f", "%.1f")
  name?: string; // Custom series name for legend (overrides datapoint name)
  // Custom Y-axis range (when showCustomYAxis is true)
  min?: number; // Y-axis minimum value
  max?: number; // Y-axis maximum value
}

/**
 * Trend widget configuration
 * Supports single datapoint or multiple datapoints
 */
export interface TrendConfig extends BaseWidgetConfig {
  type: 'trend';
  dataPoint?: string; // Single datapoint
  dataPoints?: (string | TrendSeriesConfig)[]; // Multiple datapoints: strings for default Y-axis, objects for custom Y-axis
  // Time range configuration
  timeRange?: string; // e.g. "1h", "now/h", "now/d", "1d/d" - default: "now/h" (current hour from XX:00)
  rangeSelectorDefault?: string; // e.g. "60min", "24h"
  // Main Y-axis configuration
  yAxisName?: string; // Main Y-axis title (default: '')
  yAxisUnit?: string; // Main Y-axis unit (e.g., "°C", "bar")
  yAxisColor?: string; // Main Y-axis color
  range?: { min: number | null; max: number | null }; // Main Y-axis range (default: auto)
  // Legacy Y-axis config (deprecated - use range instead)
  yAxisRangeSource?: 'auto' | 'manual';
  yAxisMin?: number;
  yAxisMax?: number;
  // Chart configuration
  stacked?: boolean;
  showXAxisGrid?: boolean; // default: false
  showYAxisGrid?: boolean; // default: true
  showRangePicker?: boolean; // default: true
  showTooltip?: boolean; // default: true
  zoom?: number; // default: 1
  // Legend configuration
  legendType?: 'scroll' | 'plain'; // default: 'scroll'
  legendOrientation?: 'horizontal' | 'vertical'; // default: 'horizontal'
  legendVerticalPosition?: 'top' | 'middle' | 'bottom'; // default: 'top'
  legendHorizontalPosition?: 'left' | 'center' | 'right'; // default: 'center'
  showLegend?: boolean; // default: true
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
 * Progress bar size types
 */
export type ProgressBarSize = '1.5em' | '2.25em' | '3em';

/**
 * Alert range for progress bar
 */
export interface AlertRange {
  min: number;
  max: number;
  color: string;
}

/**
 * Progress bar widget configuration
 */
export interface ProgressBarConfig extends BaseWidgetConfig {
  type: 'progressbar';
  dataPoint: string;
  // Visual customization
  color?: string; // Progress bar color
  size?: ProgressBarSize; // Bar height (default: '2.25em')
  // Data configuration
  unit?: string; // Display unit (e.g., "%", "bar")
  format?: string; // Number format (e.g., "%0.2f")
  min?: number; // Minimum value (default: from datapoint config)
  max?: number; // Maximum value (default: from datapoint config)
  // Display options
  showRange?: boolean; // Show min/max range labels (default: true)
  isAbsolute?: boolean; // Show absolute value instead of percentage (default: false)
  // Alert configuration
  alertRanges?: AlertRange[]; // Color ranges for different value zones
}

/**
 * Bar chart widget configuration
 */
export interface BarChartConfig extends BaseWidgetConfig {
  type: 'barchart';
  dataPoints: string[]; // Array of datapoint paths
  // Y-axis configuration
  yAxisName?: string; // Y-axis title (default: '')
  yAxisUnit?: string; // Y-axis unit (e.g., "kW", "°C")
  yAxisColor?: string; // Y-axis color
  range?: { min: number | null; max: number | null }; // Y-axis range (default: auto)
  // Chart configuration
  isStacked?: boolean; // Stack bars (default: false)
  isHorizontal?: boolean; // Horizontal bars (default: false)
  showTooltip?: boolean; // Show tooltip on hover (default: true)
  // Legend configuration
  showLegend?: boolean; // default: true
  legendPosition?: LegendPosition; // default: 'topright'
}

/**
 * Union of all widget configurations
 */
export type WidgetConfig = GaugeConfig | LabelConfig | TrendConfig | PieConfig | ProgressBarConfig | BarChartConfig;

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
 * Type guard for ProgressBar config
 */
export function isProgressBarConfig(config: WidgetConfig): config is ProgressBarConfig {
  return config.type === 'progressbar';
}

/**
 * Type guard for BarChart config
 */
export function isBarChartConfig(config: WidgetConfig): config is BarChartConfig {
  return config.type === 'barchart';
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

/**
 * Validate bar chart config has dataPoints
 */
export function validateBarChartConfig(config: BarChartConfig): boolean {
  return config.dataPoints.length > 0;
}

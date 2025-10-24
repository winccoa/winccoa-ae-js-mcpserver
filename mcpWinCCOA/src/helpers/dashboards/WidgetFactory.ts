/**
 * Widget Factory
 *
 * Factory class for creating widget instances with proper schema structure.
 * Uses Factory Pattern to allow registration of new widget types.
 */

import type {
  WidgetInstance,
  ComponentMeta,
  StructuredSettings
} from '../../types/dashboards/schema.js';
import {
  createArrayContext,
  createSimpleGroupContext
} from '../../types/dashboards/schema.js';
import type {
  WidgetConfig,
  GaugeConfig,
  LabelConfig,
  TrendConfig,
  PieConfig,
  ProgressBarConfig,
  BarChartConfig,
  WidgetType
} from '../../types/dashboards/widgets.js';
import type { WidgetDimensions } from '../../types/dashboards/layout.js';

/**
 * Widget creator function type
 */
type WidgetCreator = (
  config: any,
  dimensions: WidgetDimensions
) => WidgetInstance;

/**
 * Widget Factory Class
 */
export class WidgetFactory {
  private creators: Map<string, WidgetCreator>;

  constructor() {
    this.creators = new Map();

    // Register default widget types
    this.registerWidgetType('gauge', this.createGauge.bind(this));
    this.registerWidgetType('label', this.createLabel.bind(this));
    this.registerWidgetType('trend', this.createTrend.bind(this));
    this.registerWidgetType('pie', this.createPie.bind(this));
    this.registerWidgetType('progressbar', this.createProgressBar.bind(this));
    this.registerWidgetType('barchart', this.createBarChart.bind(this));
  }

  /**
   * Register a new widget type
   * @param type - Widget type identifier
   * @param creator - Function to create widget instances
   */
  registerWidgetType(type: string, creator: WidgetCreator): void {
    this.creators.set(type, creator);
  }

  /**
   * Create a widget instance
   * @param config - Widget configuration
   * @param dimensions - Widget dimensions (position and size)
   * @returns Complete widget instance
   */
  createWidget(config: WidgetConfig, dimensions: WidgetDimensions): WidgetInstance {
    const creator = this.creators.get(config.type);

    if (!creator) {
      throw new Error(`Unknown widget type: ${config.type}. Register it using registerWidgetType().`);
    }

    return creator(config, dimensions);
  }

  /**
   * Generate UUID v4 for widget IDs
   * @returns UUID v4 string
   */
  generateUuidV4(): string {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Create Gauge widget
   */
  private createGauge(config: GaugeConfig, dimensions: WidgetDimensions): WidgetInstance {
    const {
      dataPoint,
      title,
      chartType = 'classic',
      showTooltip = true,
      color,
      format,
      unit,
      name,
      isRelative = false,
      // Global appearance settings
      animation,
      font,
      renderer,
      theme,
      backgroundColor
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Build settings with correct structure
    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/gauge.widget',
      config: createSimpleGroupContext({
        chartType,                      // Simplified: direct value
        datapoint: {
          context: 'data-point',
          config: {
            dpName: dataPoint,
            definedConfigs: [
              'datapoint',
              'value',
              'name',
              'unit',
              'format',
              'color',
              'min',
              'max',
              'alertRanges',
              'alertColor'
            ],
            customAlertColor: true,
            alertColor: ''
          }
        },
        showTooltip,                     // Simplified: direct value
        ...(color && { color }),
        ...(format && { format }),
        ...(unit && { unit }),
        ...(name && { name }),
        isRelative,
        // Global appearance settings
        ...(animation !== undefined && { animation }),
        ...(font && { font }),
        ...(renderer && { renderer }),
        ...(theme && { theme }),
        ...(backgroundColor && { backgroundColor })
      }),
      general: createSimpleGroupContext({
        titleAlignment: 'center',       // Simplified: direct value
        subtitleAlignment: 'center'
      })
    };

    const component: ComponentMeta = {
      tagname: 'wui-widget-gauge',
      scripts: ['gauge'],
      styles: [],
      jsonSchema: 'StandardLibrary/Charts/gauge-json-schema',
      uiSchema: 'StandardLibrary/Charts/gauge-ui-schema'
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WUI_gauge.Widget.gauge.label',
      x,
      y,
      rows,
      cols,
      minCols,
      minRows,
      settings,
      component
    };
  }

  /**
   * Create Label widget
   */
  private createLabel(config: LabelConfig, dimensions: WidgetDimensions): WidgetInstance {
    const {
      dataPoint,
      title,
      icon = '',
      iconPosition = 'left',
      iconSizeFactor = 'medium',
      fontSizeFactor = 'medium',  // Changed from 'small' to 'medium' for better readability
      unitFontSizeFactor = 'small',
      color,
      format,
      unit,
      name
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/label.widget',
      config: createSimpleGroupContext({
        datapoint: {
          context: 'data-point',
          config: {
            dpName: dataPoint,
            definedConfigs: [
              'datapoint',
              'value',
              'name',
              'unit',
              'format',
              'color',
              'alertColor'
            ],
            customAlertColor: true,
            alertColor: ''
          }
        },
        icon,                           // Simplified: direct values
        iconPosition,
        iconSizeFactor,
        fontSizeFactor,
        unitFontSizeFactor,
        ...(color && { color }),
        ...(format && { format }),
        ...(unit && { unit }),
        ...(name && { name })
      }),
      general: createSimpleGroupContext({
        titleAlignment: 'center',       // Simplified: direct values
        subtitleAlignment: 'center'
      })
    };

    const component: ComponentMeta = {
      tagname: 'wui-widget-label',
      scripts: ['label'],
      styles: [],
      jsonSchema: 'StandardLibrary/Charts/label-json-schema',
      uiSchema: 'StandardLibrary/Charts/label-ui-schema'
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WUI_label.Widget.label.label',
      x,
      y,
      rows,
      cols,
      minCols,
      minRows,
      settings,
      component
    };
  }

  /**
   * Create Trend widget
   * Supports single or multiple datapoints with custom y-axis per series
   */
  private createTrend(config: TrendConfig, dimensions: WidgetDimensions): WidgetInstance {
    const {
      dataPoint,
      dataPoints,
      title,
      timeRange = 'now/h', // Default to current hour (from last full hour) - grows with time for live monitoring
      legendType = 'scroll',
      legendOrientation = 'horizontal',
      legendVerticalPosition = 'top',
      legendHorizontalPosition = 'center',
      showLegend = true,
      showXAxisGrid = false,
      showYAxisGrid = true,
      showRangePicker = true,
      showTooltip = true,
      yAxisColor = '',
      yAxisName = '',
      yAxisUnit,
      range,
      zoom = 1,
      // Global appearance settings
      animation,
      font,
      renderer,
      theme,
      backgroundColor
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Build series array from dataPoints (smart union type) or single dataPoint
    const dpArray = dataPoints && dataPoints.length > 0 ? dataPoints : [dataPoint!];

    const seriesArray = dpArray.map((dp) => {
      const seriesConfig: any = {
        datapoint: {
          context: 'data-point',
          config: {
            definedConfigs: [
              'datapoint',
              'value',
              'name',
              'unit',
              'format',
              'color',
              'min',
              'max',
              'alertColor'
            ],
            dpName: typeof dp === 'string' ? dp : dp.dataPoint,
            fetchMethod: 'historic',
            compress: true,
            historic: {
              sTimeRange: '${sTimeRange}'
            },
            customAlertColor: true,
            alertColor: ''
          }
        },
        lineStyle: typeof dp === 'string' ? 'solid' : (dp.lineStyle || 'solid')
      };

      // Add new visual and formatting properties (when dp is an object)
      if (typeof dp !== 'string') {
        // Visual customization
        if (dp.showArea !== undefined) seriesConfig.showArea = dp.showArea;
        if (dp.showConfidenceBand !== undefined) seriesConfig.showConfidenceBand = dp.showConfidenceBand;
        if (dp.color) seriesConfig.color = dp.color;

        // Data formatting
        if (dp.unit) seriesConfig.unit = dp.unit;
        if (dp.format) seriesConfig.format = dp.format;
        if (dp.name) seriesConfig.name = dp.name;

        // Custom Y-axis configuration
        if (dp.showCustomYAxis) {
          seriesConfig.showCustomYAxis = true;
          seriesConfig.yAxisPosition = dp.yAxisPosition || 'right';
          if (dp.min !== undefined) seriesConfig.min = dp.min;
          if (dp.max !== undefined) seriesConfig.max = dp.max;
        }
      }

      return createSimpleGroupContext(seriesConfig);
    });

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/linechart.widget',
      config: createSimpleGroupContext({
        legendType,                    // Simplified: direct values
        series: createArrayContext(seriesArray as any),
        showLegend,
        zoom,
        legendOrientation,
        showYAxisGrid,
        showXAxisGrid,
        legendVerticalPosition,
        legendHorizontalPosition,
        yAxisColor,
        yAxisName,
        ...(yAxisUnit && { yAxisUnit }),
        ...(range && { range }),
        showRangePicker,
        showTooltip,
        // Global appearance settings
        ...(animation !== undefined && { animation }),
        ...(font && { font }),
        ...(renderer && { renderer }),
        ...(theme && { theme }),
        ...(backgroundColor && { backgroundColor })
      }),
      general: createSimpleGroupContext({
        titleAlignment: 'center',       // Simplified: direct values
        subtitleAlignment: 'center'
      }),
      variables: createSimpleGroupContext({
        sTimeRange: timeRange           // Simplified: direct value
      })
    };

    const component: ComponentMeta = {
      tagname: 'wui-widget-trend',
      scripts: ['trend'],
      styles: [],
      jsonSchema: 'StandardLibrary/Charts/linechart-json-schema',
      uiSchema: 'StandardLibrary/Charts/linechart-ui-schema'
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WUI_trend.Widget.trend.label',
      x,
      y,
      rows,
      cols,
      minCols,
      minRows,
      settings,
      component
    };
  }

  /**
   * Create Pie widget
   * ECharts-based widget extending WuiEchartsWithLegend
   */
  private createPie(config: PieConfig, dimensions: WidgetDimensions): WidgetInstance {
    const {
      dataPoints,
      dataPointsDescriptions,
      title,
      chartType = 'pie',
      labelsShow = false,
      labelsPosition = 'outside',
      labelsDetails = 'value',
      labelLineLength = 10,
      legendPosition = 'topright',
      showTooltip = true,
      colors,
      darkModeColors
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Default color arrays for pie slices
    const defaultColors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];
    const defaultDarkColors = ['#4992ff', '#7cffb2', '#fddd60', '#ff6e76', '#58d9f9', '#05c091'];
    const sliceColors = colors || defaultColors;
    const sliceDarkColors = darkModeColors || defaultDarkColors;

    // Build series array with datapoint-context (ECharts format)
    const seriesArray = dataPoints.map((dp, index) =>
      createSimpleGroupContext({
        datapoint: {
          context: 'data-point',
          config: {
            dpName: dp,
            definedConfigs: [
              'datapoint',
              'value',
              'name',
              'unit',
              'format',
              'color',
              'alertColor'
            ],
            customAlertColor: true,
            alertColor: ''
          }
        },
        name: dataPointsDescriptions[index] || `Slice ${index + 1}`,
        color: sliceColors[index % sliceColors.length],
        darkModeColor: sliceDarkColors[index % sliceDarkColors.length]
      })
    );

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/pie.widget',
      config: createSimpleGroupContext({
        chartType,
        labelsShow,
        labelsPosition,
        labelsDetails,
        labelLineLength,
        series: createArrayContext(seriesArray as any),
        showTooltip
      }),
      general: createSimpleGroupContext({
        titleAlignment: 'center',
        subtitleAlignment: 'center'
      })
    };

    const component: ComponentMeta = {
      tagname: 'wui-widget-pie',
      scripts: ['pie'],
      styles: [],
      jsonSchema: 'StandardLibrary/Charts/pie-json-schema',
      uiSchema: 'StandardLibrary/Charts/pie-ui-schema'
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WUI_pie.Widget.pie.label',
      x,
      y,
      rows,
      cols,
      minCols,
      minRows,
      settings,
      component
    };
  }

  /**
   * Create Progress Bar widget
   */
  private createProgressBar(config: ProgressBarConfig, dimensions: WidgetDimensions): WidgetInstance {
    const {
      dataPoint,
      title,
      color,
      size = '2.25em',
      unit,
      format,
      min,
      max,
      showRange = true,
      isAbsolute = false,
      alertRanges,
      // Global appearance settings
      animation,
      font,
      renderer,
      theme,
      backgroundColor
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/progressbar.widget',
      config: createSimpleGroupContext({
        datapoint: {
          context: 'data-point',
          config: {
            dpName: dataPoint,
            definedConfigs: [
              'datapoint',
              'value',
              'name',
              'unit',
              'format',
              'color',
              'min',
              'max',
              'alertRanges',
              'alertColor'
            ],
            customAlertColor: true,
            alertColor: ''
          }
        },
        size,
        showRange,
        isAbsolute,
        ...(color && { color }),
        ...(unit && { unit }),
        ...(format && { format }),
        ...(min !== undefined && { min }),
        ...(max !== undefined && { max }),
        ...(alertRanges && { alertRanges }),
        // Global appearance settings
        ...(animation !== undefined && { animation }),
        ...(font && { font }),
        ...(renderer && { renderer }),
        ...(theme && { theme }),
        ...(backgroundColor && { backgroundColor })
      }),
      general: createSimpleGroupContext({
        titleAlignment: 'center',
        subtitleAlignment: 'center'
      })
    };

    const component: ComponentMeta = {
      tagname: 'wui-widget-progress-bar',
      scripts: ['progress-bar'],
      styles: [],
      jsonSchema: 'StandardLibrary/Charts/progressbar-json-schema',
      uiSchema: 'StandardLibrary/Charts/progressbar-ui-schema'
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WUI_progressbar.Widget.progressbar.label',
      x,
      y,
      rows,
      cols,
      minCols,
      minRows,
      settings,
      component
    };
  }

  /**
   * Create Bar Chart widget
   */
  private createBarChart(config: BarChartConfig, dimensions: WidgetDimensions): WidgetInstance {
    const {
      dataPoints,
      title,
      yAxisName = '',
      yAxisUnit,
      yAxisColor,
      range,
      isStacked = false,
      isHorizontal = false,
      showTooltip = true,
      showLegend = true,
      legendPosition = 'topright',
      // Global appearance settings
      animation,
      font,
      renderer,
      theme,
      backgroundColor
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Build series array from dataPoints
    const seriesArray = dataPoints.map((dp) =>
      createSimpleGroupContext({
        datapoint: {
          context: 'data-point',
          config: {
            dpName: dp,
            definedConfigs: [
              'datapoint',
              'value',
              'name',
              'unit',
              'format',
              'color',
              'alertColor'
            ],
            customAlertColor: true,
            alertColor: ''
          }
        }
      })
    );

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/barchart.widget',
      config: createSimpleGroupContext({
        series: createArrayContext(seriesArray as any),
        isStacked,
        isHorizontal,
        showTooltip,
        showLegend,
        legendPosition,
        yAxisName,
        ...(yAxisUnit && { yAxisUnit }),
        ...(yAxisColor && { yAxisColor }),
        ...(range && { range }),
        // Global appearance settings
        ...(animation !== undefined && { animation }),
        ...(font && { font }),
        ...(renderer && { renderer }),
        ...(theme && { theme }),
        ...(backgroundColor && { backgroundColor })
      }),
      general: createSimpleGroupContext({
        titleAlignment: 'center',
        subtitleAlignment: 'center'
      })
    };

    const component: ComponentMeta = {
      tagname: 'wui-widget-barchart',
      scripts: ['barchart'],
      styles: [],
      jsonSchema: 'StandardLibrary/Charts/barchart-json-schema',
      uiSchema: 'StandardLibrary/Charts/barchart-ui-schema'
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WUI_barchart.Widget.barchart.label',
      x,
      y,
      rows,
      cols,
      minCols,
      minRows,
      settings,
      component
    };
  }
}

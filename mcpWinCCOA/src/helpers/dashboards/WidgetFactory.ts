/**
 * Widget Factory
 *
 * Factory class for creating widget instances with proper schema structure.
 * Uses Factory Pattern to allow registration of new widget types.
 */

import type {
  WidgetInstance,
  ComponentMeta,
  StructuredSettings,
  GroupContext,
  DataPointContext,
  StaticContext,
  ArrayContext
} from '../../types/dashboards/schema.js';
import {
  createStaticContext,
  createDataPointContext,
  createGroupContext,
  createArrayContext
} from '../../types/dashboards/schema.js';
import type {
  WidgetConfig,
  GaugeConfig,
  LabelConfig,
  TrendConfig,
  PieConfig,
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
    const { dataPoint, title, chartType = 'classic', showTooltip = true } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Build settings with correct structure
    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/gauge.widget',
      config: createGroupContext({
        chartType: createStaticContext(chartType),
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
        showTooltip: createStaticContext(showTooltip)
      }),
      general: createGroupContext({
        titleAlignment: createStaticContext('center'),
        subtitleAlignment: createStaticContext('center')
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
      fontSizeFactor = 'small',
      unitFontSizeFactor = 'small'
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/label.widget',
      config: createGroupContext({
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
        icon: createStaticContext(icon),
        iconPosition: createStaticContext(iconPosition),
        iconSizeFactor: createStaticContext(iconSizeFactor),
        fontSizeFactor: createStaticContext(fontSizeFactor),
        unitFontSizeFactor: createStaticContext(unitFontSizeFactor)
      }),
      general: createGroupContext({
        titleAlignment: createStaticContext('center'),
        subtitleAlignment: createStaticContext('center')
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
      series,
      title,
      timeRange = 'now/h', // Default to current hour
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
      zoom = 1
    } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Build series array based on priority: series > dataPoints > dataPoint
    let seriesArray: any[];

    if (series && series.length > 0) {
      // Use detailed series configuration
      seriesArray = series.map((s) => {
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
              dpName: s.dataPoint,
              fetchMethod: 'historic',
              compress: true,
              historic: {
                sTimeRange: '${sTimeRange}'
              },
              customAlertColor: true,
              alertColor: ''
            }
          },
          lineStyle: createStaticContext(s.lineStyle || 'solid')
        };

        // Add custom y-axis if requested
        if (s.showCustomYAxis) {
          seriesConfig.showCustomYAxis = createStaticContext(true);
          // Default to 'right' for custom y-axis (since main axis is on left)
          seriesConfig.yAxisPosition = createStaticContext(s.yAxisPosition || 'right');
        }

        return createGroupContext(seriesConfig);
      });
    } else {
      // Use simple dataPoint(s) array
      const dpArray = dataPoints && dataPoints.length > 0 ? dataPoints : [dataPoint!];
      seriesArray = dpArray.map((dp) =>
        createGroupContext({
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
              dpName: dp,
              fetchMethod: 'historic',
              compress: true,
              historic: {
                sTimeRange: '${sTimeRange}'
              },
              customAlertColor: true,
              alertColor: ''
            }
          },
          lineStyle: createStaticContext('solid')
        })
      );
    }

    const settings: StructuredSettings = {
      jsonFileName: 'StandardLibrary/Charts/linechart.widget',
      config: createGroupContext({
        legendType: createStaticContext(legendType),
        series: createArrayContext(seriesArray as any),
        showLegend: createStaticContext(showLegend),
        zoom: createStaticContext(zoom),
        legendOrientation: createStaticContext(legendOrientation),
        showYAxisGrid: createStaticContext(showYAxisGrid),
        showXAxisGrid: createStaticContext(showXAxisGrid),
        legendVerticalPosition: createStaticContext(legendVerticalPosition),
        legendHorizontalPosition: createStaticContext(legendHorizontalPosition),
        yAxisColor: createStaticContext(yAxisColor),
        showRangePicker: createStaticContext(showRangePicker),
        showTooltip: createStaticContext(showTooltip)
      }),
      general: createGroupContext({
        titleAlignment: createStaticContext('center'),
        subtitleAlignment: createStaticContext('center')
      }),
      variables: createGroupContext({
        sTimeRange: createStaticContext(timeRange)
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
   */
  private createPie(config: PieConfig, dimensions: WidgetDimensions): WidgetInstance {
    const { dataPoints, dataPointsDescriptions, title } = config;
    const { x, y, cols, rows, minCols, minRows } = dimensions;

    // Color arrays for pie slices
    const colors = ['#123123', '#006FE6', '#BBD0D7', '#265461', '#016FE6', '#BBC0D7'];
    const darkColors = ['#123123', '#006FE6', '#BBD0D7', '#265461', '#016FE6', '#BBC0D7'];

    // Build series array with datapoint-context
    const seriesArray = dataPoints.map((dp, index) =>
      createGroupContext({
        name: createGroupContext({
          name: createStaticContext({ 'en_US.utf8': dataPointsDescriptions[index] || `Slice ${index + 1}` }),
          queryName: createStaticContext(false),
          nameSource: createStaticContext('manual')
        }),
        dpe: {
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
        color: createStaticContext({
          color: colors[index % colors.length],
          useDifferentColors: false,
          darkModeColor: darkColors[index % darkColors.length]
        }),
        formatSettings: createStaticContext({
          value: index === 0 ? '%0.2f' : '%0.0d',
          type: 'oa'
        }),
        unitSettings: createStaticContext({
          type: 'oa',
          value: { 'en_US.utf8': '' }
        })
      })
    );

    const settings: StructuredSettings = {
      jsonFileName: 'pie',
      config: createGroupContext({
        type: createStaticContext('pie'),
        chartOptions: createGroupContext({
          series: createArrayContext(seriesArray as any),
          legend: createStaticContext({
            show: true,
            orient: 'vertical',
            position: 'topright'
          }),
          tooltip: createStaticContext({ show: true }),
          chartType: createStaticContext({
            type: 'pie',
            pieRadius: 50,
            radius: [25, 75],
            roseType: 'area'
          }),
          label: createStaticContext({
            show: true,
            position: 'outside',
            formatter: 'value'
          }),
          labelLine: createStaticContext({ show: true })
        })
      }),
      general: createGroupContext({
        title: createGroupContext({
          name: createStaticContext({ 'en_US.utf8': title }),
          queryName: createStaticContext(false),
          nameSource: createStaticContext('manual')
        }),
        subtitle: createGroupContext({
          name: createStaticContext(null),
          queryName: createStaticContext(false),
          nameSource: createStaticContext('manual')
        }),
        background: createGroupContext({
          customBackground: createStaticContext(false),
          backgroundColor: createStaticContext({
            color: '',
            useDifferentColors: false,
            darkModeColor: ''
          })
        })
      })
    };

    const component: ComponentMeta = {
      tagname: 'wdk-pie',
      scripts: [],
      styles: [],
      jsonSchema: {},
      uiSchema: {}
    };

    return {
      id: this.generateUuidV4(),
      version: 2,
      name: 'WDK_pie.Widget.pie.label',
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

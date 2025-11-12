/**
 * Dashboard Manager
 *
 * Central class for managing dashboards and widgets in WinCC OA.
 * Provides CRUD operations for dashboards and widgets.
 */

import type { WinccoaManager } from 'winccoa-manager';
import { WidgetFactory } from './WidgetFactory.js';
import { LayoutHelper } from './LayoutHelper.js';
import type {
  DashboardConfig,
  DashboardInfo,
  WidgetIdentifier,
  getDashboardDatapointName,
  extractDashboardNumber,
  createDefaultDashboardSettings
} from '../../types/dashboards/dashboard.js';
import {
  getDashboardDatapointName as getDashboardDpName,
  extractDashboardNumber as extractDashboardNum,
  createDefaultDashboardSettings as createDefaultSettings
} from '../../types/dashboards/dashboard.js';
import type { WidgetInstance } from '../../types/dashboards/schema.js';
import type { WidgetConfig } from '../../types/dashboards/widgets.js';
import { validateTrendConfig, validatePieConfig } from '../../types/dashboards/widgets.js';
import { isWidgetIdIdentifier, isWidgetIndexIdentifier } from '../../types/dashboards/dashboard.js';

/**
 * Dashboard Manager Class
 */
export class DashboardManager {
  private winccoa: WinccoaManager;
  private widgetFactory: WidgetFactory;
  private layoutHelper: LayoutHelper;

  constructor(winccoa: WinccoaManager) {
    this.winccoa = winccoa;
    this.widgetFactory = new WidgetFactory();
    this.layoutHelper = new LayoutHelper();
  }

  /**
   * Get the WidgetFactory instance (for registering custom widget types)
   */
  getWidgetFactory(): WidgetFactory {
    return this.widgetFactory;
  }

  /**
   * Get the LayoutHelper instance
   */
  getLayoutHelper(): LayoutHelper {
    return this.layoutHelper;
  }

  // ==================== DASHBOARD OPERATIONS ====================

  /**
   * Create a new dashboard
   * @param config - Dashboard configuration (name, description, createdBy)
   * @returns Dashboard datapoint name (e.g. "_Dashboard_000001")
   */
  async createDashboard(config: DashboardConfig): Promise<string> {
    // Validate that root user is not used as creator
    // Dashboards created by root cannot be modified later in WinCC OA
    if (config.createdBy.toLowerCase() === 'root') {
      throw new Error(
        'Dashboard cannot be created with "root" as creator. Dashboards created by root cannot be modified later. Please use a proper user account (e.g., "admin" or another valid username).'
      );
    }

    // Lookup user and get userId
    const userNames = await this.winccoa.dpGet('_Users.UserName');
    const userIndex = userNames.findIndex((name: string) => name === config.createdBy);

    if (userIndex === -1) {
      throw new Error(
        `User not found: ${config.createdBy}. Dashboard cannot be created without valid creator.`
      );
    }

    const userIds = await this.winccoa.dpGet('_Users.UserId');
    const userId = userIds[userIndex];

    // Get next available dashboard number
    const dashboardNumber = await this.getNextDashboardNumber();
    const dpName = getDashboardDpName(dashboardNumber);

    // Check if dashboard already exists
    if (this.winccoa.dpExists(dpName)) {
      throw new Error(`Dashboard ${dpName} already exists`);
    }

    // Create dashboard datapoint
    const created = await this.winccoa.dpCreate(dpName, '_Dashboard');
    if (!created) {
      throw new Error(`Failed to create dashboard datapoint ${dpName}`);
    }

    // Set dashboard properties
    const settings = createDefaultSettings(config.name, config.description);
    const settingsJson = JSON.stringify(settings);

    this.winccoa.dpSet(`${dpName}.isPublished`, 1);
    this.winccoa.dpSet(`${dpName}.id`, dashboardNumber);
    this.winccoa.dpSet(`${dpName}.settings`, settingsJson);
    this.winccoa.dpSet(`${dpName}.widgets`, []); // Empty widget array
    this.winccoa.dpSet(`${dpName}.createdBy`, userId); // Set creator userId

    console.log(`✅ Created dashboard: ${dpName} (created by user: ${config.createdBy})`);
    return dpName;
  }

  /**
   * Edit dashboard properties
   * @param dashboardId - Dashboard datapoint name
   * @param updates - Properties to update (name and/or description)
   */
  async editDashboard(
    dashboardId: string,
    updates: Partial<DashboardConfig>
  ): Promise<void> {
    // Verify dashboard exists
    if (!this.winccoa.dpExists(dashboardId)) {
      throw new Error(`Dashboard ${dashboardId} does not exist`);
    }

    // Get current settings
    const currentSettingsJson = await this.winccoa.dpGet(`${dashboardId}.settings`);
    const currentSettings = JSON.parse(currentSettingsJson);

    // Update settings
    if (updates.name) {
      currentSettings.name['en_US.utf8'] = updates.name;
    }
    if (updates.description) {
      currentSettings.description['en_US.utf8'] = updates.description;
    }

    // Save updated settings
    const updatedSettingsJson = JSON.stringify(currentSettings);
    this.winccoa.dpSet(`${dashboardId}.settings`, updatedSettingsJson);

    console.log(`✅ Updated dashboard: ${dashboardId}`);
  }

  /**
   * Delete a dashboard
   * @param dashboardId - Dashboard datapoint name
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    // Verify dashboard exists
    if (!this.winccoa.dpExists(dashboardId)) {
      throw new Error(`Dashboard ${dashboardId} does not exist`);
    }

    // Delete dashboard datapoint
    // Note: WinCC OA doesn't have dpDelete in JS API, so we set isPublished to 0
    this.winccoa.dpSet(`${dashboardId}.isPublished`, 0);
    this.winccoa.dpSet(`${dashboardId}.widgets`, []); // Clear widgets

    console.log(`✅ Deleted dashboard: ${dashboardId}`);
  }

  /**
   * List all dashboards
   * @returns Array of dashboard information
   */
  async listDashboards(): Promise<DashboardInfo[]> {
    const dashboards: DashboardInfo[] = [];

    // Find all _Dashboard datapoints
    const dashboardDps = this.winccoa.dpNames('_Dashboard*', '_Dashboard');

    for (const dpName of dashboardDps) {
      try {
        const id = await this.winccoa.dpGet(`${dpName}.id`);
        const isPublished = await this.winccoa.dpGet(`${dpName}.isPublished`);
        const settingsJson = await this.winccoa.dpGet(`${dpName}.settings`);
        const widgets = await this.winccoa.dpGet(`${dpName}.widgets`);

        const settings = JSON.parse(settingsJson);

        dashboards.push({
          id: dpName,
          dashboardNumber: id,
          name: settings.name?.['en_US.utf8'] || 'Unnamed Dashboard',
          description: settings.description?.['en_US.utf8'] || '',
          widgetCount: Array.isArray(widgets) ? widgets.length : 0,
          isPublished: isPublished === 1
        });
      } catch (error) {
        console.warn(`Failed to read dashboard ${dpName}:`, error);
      }
    }

    return dashboards.sort((a, b) => a.dashboardNumber - b.dashboardNumber);
  }

  // ==================== WIDGET OPERATIONS ====================

  /**
   * Add a widget to a dashboard
   * @param dashboardId - Dashboard datapoint name
   * @param config - Widget configuration
   * @returns Widget ID (UUID)
   */
  async addWidget(dashboardId: string, config: WidgetConfig): Promise<string> {
    // Verify dashboard exists
    if (!this.winccoa.dpExists(dashboardId)) {
      throw new Error(`Dashboard ${dashboardId} does not exist`);
    }

    // Validate widget configuration
    this.validateWidgetConfig(config);

    // Validate datapoints exist
    await this.validateDatapoints(config);

    // Get existing widgets
    const existingWidgets = await this.getWidgets(dashboardId);

    // Resolve layout
    const dimensions = this.layoutHelper.resolveLayout(
      config.layout,
      config.type,
      existingWidgets
    );

    // Validate no overlaps (safety check for explicit layouts)
    const wouldOverlap = existingWidgets.some((existing) => {
      return this.layoutHelper.widgetsOverlap(
        { x: dimensions.x, y: dimensions.y, cols: dimensions.cols, rows: dimensions.rows },
        existing
      );
    });

    if (wouldOverlap) {
      console.warn(
        `Warning: Widget at position (${dimensions.x}, ${dimensions.y}) may overlap with existing widgets. Consider using layout: "auto" instead.`
      );
      // Note: We don't throw an error to allow intentional overlaps if needed,
      // but the warning will help debug unintentional overlaps
    }

    // Auto-populate yAxisUnit from first datapoint if not provided (trend widgets)
    if (config.type === 'trend' && !(config as any).yAxisUnit) {
      const firstDp = (config as any).dataPoint ||
        ((config as any).dataPoints?.[0] &&
         (typeof (config as any).dataPoints[0] === 'string'
           ? (config as any).dataPoints[0]
           : (config as any).dataPoints[0].dataPoint));

      if (firstDp) {
        const unit = await this.getDatapointUnit(firstDp);
        if (unit) {
          (config as any).yAxisUnit = unit;
          console.log(`📊 Auto-populated yAxisUnit from DPE config: ${unit}`);
        } else {
          console.warn(`⚠️ No unit found in DPE config for ${firstDp}. Consider configuring :_original.._unit or specifying yAxisUnit manually.`);
        }
      }
    }

    // Auto-populate units for individual series in dataPoints array
    if ((config as any).dataPoints && Array.isArray((config as any).dataPoints)) {
      for (let i = 0; i < (config as any).dataPoints.length; i++) {
        const dp = (config as any).dataPoints[i];
        if (typeof dp === 'object' && dp.dataPoint && !dp.unit) {
          const unit = await this.getDatapointUnit(dp.dataPoint);
          if (unit) {
            dp.unit = unit;
            console.log(`📊 Auto-populated series unit from DPE config: ${unit} for ${dp.dataPoint}`);
          } else {
            console.warn(`⚠️ No unit found in DPE config for series ${dp.dataPoint}. Consider configuring :_original.._unit.`);
          }
        }
      }
    }

    // Create widget instance
    const widget = this.widgetFactory.createWidget(config, dimensions);

    // Add widget to dashboard
    const widgetJson = JSON.stringify(widget);
    const updatedWidgets = [...existingWidgets.map((w) => JSON.stringify(w)), widgetJson];

    this.winccoa.dpSet(`${dashboardId}.widgets`, updatedWidgets);

    console.log(`✅ Added ${config.type} widget to dashboard ${dashboardId}`);
    return widget.id;
  }

  /**
   * Edit a widget on a dashboard
   * @param dashboardId - Dashboard datapoint name
   * @param identifier - Widget identifier (by ID or index)
   * @param updates - Widget configuration updates
   */
  async editWidget(
    dashboardId: string,
    identifier: WidgetIdentifier,
    updates: Partial<WidgetConfig>
  ): Promise<void> {
    // Get existing widgets
    const widgets = await this.getWidgets(dashboardId);

    // Find widget
    const widgetIndex = this.findWidgetIndex(widgets, identifier);
    if (widgetIndex === -1) {
      throw new Error(`Widget not found`);
    }

    const widget = widgets[widgetIndex];
    if (!widget) {
      throw new Error('Widget not found at index');
    }

    // Apply updates (recreate widget with updated config)
    // Note: This is a simplified approach; a full implementation would update the widget instance directly
    if (updates.title) {
      // Update title in settings
      const settings = widget.settings as any;
      if (settings.general?.config?.title?.config?.name) {
        settings.general.config.title.config.name = {
          context: 'static',
          config: { 'en_US.utf8': updates.title }
        };
      }
    }

    // Update appearance settings if provided
    if (updates.appearance) {
      const settings = widget.settings as any;
      if (!settings.general) {
        settings.general = { context: 'group', config: {} };
      }
      if (!settings.general.config) {
        settings.general.config = {};
      }

      const appearance = updates.appearance;

      // Helper function to create multilingual text format
      const createMultilingualText = (text: string) => ({
        context: 'group',
        config: {
          'en_US.utf8': text
        }
      });

      // Update header settings
      if (appearance.titleIcon !== undefined) {
        settings.general.config.titleIcon = appearance.titleIcon;
      }
      if (appearance.title !== undefined) {
        settings.general.config.title = createMultilingualText(appearance.title);
      }
      if (appearance.titleAlignment !== undefined) {
        settings.general.config.titleAlignment = appearance.titleAlignment;
      }

      // Update footer settings
      if (appearance.subtitleIcon !== undefined) {
        settings.general.config.subtitleIcon = appearance.subtitleIcon;
      }
      if (appearance.subtitle !== undefined) {
        settings.general.config.subtitle = createMultilingualText(appearance.subtitle);
      }
      if (appearance.subtitleAlignment !== undefined) {
        settings.general.config.subtitleAlignment = appearance.subtitleAlignment;
      }

      // Update color settings
      if (appearance.backgroundColor !== undefined) {
        settings.general.config.backgroundColor = appearance.backgroundColor;
      }
      if (appearance.borderColor !== undefined) {
        settings.general.config.borderColor = appearance.borderColor;
      }

      // Update control settings
      if (appearance.showFullscreenButton !== undefined) {
        settings.general.config.showFullscreenButton = appearance.showFullscreenButton;
      }

      // Update link settings
      if (appearance.linkTitle !== undefined) {
        settings.general.config.linkTitle = createMultilingualText(appearance.linkTitle);
      }
      if (appearance.linkOpenInNewTab !== undefined) {
        settings.general.config.linkOpenInNewTab = appearance.linkOpenInNewTab;
      }
    }

    // Update widget-specific settings if provided
    const settings = widget.settings as any;
    const widgetUpdates = updates as any; // Cast to any for dynamic property access
    if (settings.config && settings.config.config) {
      // Data formatting settings (common to most widgets)
      if (widgetUpdates.unit !== undefined) {
        settings.config.config.unit = widgetUpdates.unit;
      }
      if (widgetUpdates.format !== undefined) {
        settings.config.config.format = widgetUpdates.format;
      }
      if (widgetUpdates.name !== undefined) {
        settings.config.config.name = widgetUpdates.name;
      }
      if (widgetUpdates.color !== undefined) {
        settings.config.config.color = widgetUpdates.color;
      }
      if (widgetUpdates.showTooltip !== undefined) {
        settings.config.config.showTooltip = widgetUpdates.showTooltip;
      }

      // Range settings
      if (widgetUpdates.min !== undefined) {
        settings.config.config.min = widgetUpdates.min;
      }
      if (widgetUpdates.max !== undefined) {
        settings.config.config.max = widgetUpdates.max;
      }
      if (widgetUpdates.rangeSettings !== undefined) {
        settings.config.config.rangeSettings = widgetUpdates.rangeSettings;
      }

      // Trend-specific settings
      if (widgetUpdates.showLegend !== undefined) {
        settings.config.config.showLegend = widgetUpdates.showLegend;
      }
      if (widgetUpdates.dataPoints !== undefined) {
        // Handle dataPoints update (rebuild series array)
        const dpArray = widgetUpdates.dataPoints;
        const seriesArray = dpArray.map((dp: any) => {
          const seriesConfig: any = {
            datapoint: {
              context: 'data-point',
              config: {
                definedConfigs: ['datapoint', 'value', 'name', 'unit', 'format', 'color', 'min', 'max', 'alertColor'],
                dpName: typeof dp === 'string' ? dp : dp.dataPoint,
                fetchMethod: 'historic',
                compress: true,
                historic: { sTimeRange: '${sTimeRange}' },
                customAlertColor: true,
                alertColor: ''
              }
            },
            lineStyle: typeof dp === 'string' ? 'solid' : (dp.lineStyle || 'solid')
          };

          if (typeof dp !== 'string' && dp.showCustomYAxis) {
            seriesConfig.showCustomYAxis = true;
            seriesConfig.yAxisPosition = dp.yAxisPosition || 'right';
          }

          return { context: 'group', config: seriesConfig };
        });

        settings.config.config.series = { context: 'array', config: seriesArray };
      }

      // Bar chart specific settings
      if (widgetUpdates.yAxisName !== undefined) {
        settings.config.config.yAxisName = widgetUpdates.yAxisName;
      }
      if (widgetUpdates.yAxisUnit !== undefined) {
        settings.config.config.yAxisUnit = widgetUpdates.yAxisUnit;
      }
      if (widgetUpdates.yAxisColor !== undefined) {
        settings.config.config.yAxisColor = widgetUpdates.yAxisColor;
      }
      if (widgetUpdates.range !== undefined) {
        settings.config.config.range = widgetUpdates.range;
      }
      if (widgetUpdates.isStacked !== undefined) {
        settings.config.config.isStacked = widgetUpdates.isStacked;
      }
      if (widgetUpdates.isHorizontal !== undefined) {
        settings.config.config.isHorizontal = widgetUpdates.isHorizontal;
      }
      if (widgetUpdates.legendPosition !== undefined) {
        settings.config.config.legendPosition = widgetUpdates.legendPosition;
      }
    }

    // Update timeRange in variables section (trend-specific)
    if (widgetUpdates.timeRange !== undefined && settings.variables) {
      if (!settings.variables.config) {
        settings.variables.config = {};
      }
      settings.variables.config.sTimeRange = widgetUpdates.timeRange;
    }

    // Update layout if provided
    if (updates.layout) {
      const dimensions = this.layoutHelper.resolveLayout(
        updates.layout,
        widget.component.tagname.includes('gauge')
          ? 'gauge'
          : widget.component.tagname.includes('label')
          ? 'label'
          : widget.component.tagname.includes('trend')
          ? 'trend'
          : widget.component.tagname.includes('pie')
          ? 'pie'
          : widget.component.tagname.includes('progress-bar')
          ? 'progressbar'
          : 'barchart',
        widgets.filter((_, i) => i !== widgetIndex)
      );
      widget.x = dimensions.x;
      widget.y = dimensions.y;
      widget.cols = dimensions.cols;
      widget.rows = dimensions.rows;
    }

    // Save updated widgets
    widgets[widgetIndex] = widget;
    const widgetsJson = widgets.map((w) => JSON.stringify(w));
    this.winccoa.dpSet(`${dashboardId}.widgets`, widgetsJson);

    console.log(`✅ Updated widget on dashboard ${dashboardId}`);
  }

  /**
   * Delete a widget from a dashboard
   * @param dashboardId - Dashboard datapoint name
   * @param identifier - Widget identifier (by ID or index)
   */
  async deleteWidget(dashboardId: string, identifier: WidgetIdentifier): Promise<void> {
    // Get existing widgets
    const widgets = await this.getWidgets(dashboardId);

    // Find widget
    const widgetIndex = this.findWidgetIndex(widgets, identifier);
    if (widgetIndex === -1) {
      throw new Error(`Widget not found`);
    }

    // Remove widget
    widgets.splice(widgetIndex, 1);

    // Save updated widgets
    const widgetsJson = widgets.map((w) => JSON.stringify(w));
    this.winccoa.dpSet(`${dashboardId}.widgets`, widgetsJson);

    console.log(`✅ Deleted widget from dashboard ${dashboardId}`);
  }

  /**
   * List all widgets on a dashboard
   * @param dashboardId - Dashboard datapoint name
   * @returns Array of widget instances
   */
  async listWidgets(dashboardId: string): Promise<WidgetInstance[]> {
    return this.getWidgets(dashboardId);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get next available dashboard number
   * @returns Next dashboard number
   */
  private async getNextDashboardNumber(): Promise<number> {
    const dashboards = this.winccoa.dpNames('_Dashboard*', '_Dashboard');

    if (dashboards.length === 0) {
      return 1;
    }

    const numbers = dashboards
      .map((dp) => extractDashboardNum(dp))
      .filter((n) => n !== null) as number[];

    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  }

  /**
   * Get widgets from dashboard
   * @param dashboardId - Dashboard datapoint name
   * @returns Array of widget instances
   */
  private async getWidgets(dashboardId: string): Promise<WidgetInstance[]> {
    const widgetsJson = await this.winccoa.dpGet(`${dashboardId}.widgets`);

    if (!Array.isArray(widgetsJson)) {
      return [];
    }

    return widgetsJson.map((json) => JSON.parse(json));
  }

  /**
   * Find widget index by identifier
   * @param widgets - Array of widgets
   * @param identifier - Widget identifier
   * @returns Widget index or -1 if not found
   */
  private findWidgetIndex(widgets: WidgetInstance[], identifier: WidgetIdentifier): number {
    if (isWidgetIdIdentifier(identifier)) {
      return widgets.findIndex((w) => w.id === identifier.id);
    } else if (isWidgetIndexIdentifier(identifier)) {
      return identifier.index >= 0 && identifier.index < widgets.length ? identifier.index : -1;
    }
    return -1;
  }

  /**
   * Validate widget configuration
   * @param config - Widget configuration
   */
  private validateWidgetConfig(config: WidgetConfig): void {
    if (config.type === 'trend') {
      if (!validateTrendConfig(config)) {
        throw new Error('Trend widget must have either dataPoint or dataPoints array');
      }
    } else if (config.type === 'pie') {
      if (!validatePieConfig(config)) {
        throw new Error('Pie widget must have matching dataPoints and dataPointsDescriptions arrays');
      }
    }
  }

  /**
   * Validate that datapoints exist
   * @param config - Widget configuration
   */
  private async validateDatapoints(config: WidgetConfig): Promise<void> {
    const datapoints: string[] = [];

    if ('dataPoint' in config && config.dataPoint) {
      datapoints.push(config.dataPoint);
    }

    if ('dataPoints' in config && config.dataPoints) {
      // Handle both string and object formats in dataPoints
      for (const dp of config.dataPoints) {
        if (typeof dp === 'string') {
          datapoints.push(dp);
        } else {
          datapoints.push(dp.dataPoint);
        }
      }
    }

    for (const dp of datapoints) {
      if (!this.winccoa.dpExists(dp)) {
        throw new Error(`Datapoint does not exist: ${dp}`);
      }
    }
  }

  /**
   * Get unit from datapoint configuration
   * @param dpName - Datapoint name
   * @returns Unit string or undefined
   */
  private async getDatapointUnit(dpName: string): Promise<string | undefined> {
    try {
      // Get unit from datapoint config using dpGetUnit() API
      const unit = this.winccoa.dpGetUnit(dpName);
      return unit || undefined;
    } catch (error) {
      // If unit doesn't exist or error reading, return undefined
      return undefined;
    }
  }
}

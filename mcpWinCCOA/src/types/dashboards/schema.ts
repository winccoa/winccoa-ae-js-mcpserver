/**
 * Dashboard Widget Schema Types
 *
 * Based on WinCC OA Dashboard Widget Instance JSON Schema
 * Implements the official context-based widget structure
 */

/**
 * I18n name map (language => value)
 */
export interface I18nNameMap {
  [locale: string]: string; // e.g. "en_US.utf8": "Temperature"
}

/**
 * Widget instance name (plain string or i18n map)
 */
export type WidgetName = string | I18nNameMap;

/**
 * Context types used in widget settings
 */
export type ContextType = 'group' | 'array' | 'data-point' | 'static' | string;

/**
 * Base context interface
 */
export interface BaseContext {
  context: ContextType;
  config: any;
}

/**
 * Group Context - nested configuration structure
 */
export interface GroupContext {
  context: 'group';
  config: {
    [key: string]: BaseContext | string | number | boolean | null;
  };
}

/**
 * Array Context - for arrays of contexts
 */
export interface ArrayContext {
  context: 'array';
  config: Array<GroupContext | GenericContext>;
}

/**
 * DataPoint Context - for datapoint bindings
 */
export interface DataPointContext {
  context: 'data-point';
  config: {
    dataPath: string;
    dataType: string;
    isCnsNode: boolean;
    [key: string]: any;
  };
}

/**
 * Static Context - for static literal values
 */
export interface StaticContext {
  context: 'static';
  config: string | number | boolean | object | any[] | null;
}

/**
 * Generic Context - for custom context types
 */
export interface GenericContext {
  context: string; // Must not be reserved names (group, array, data-point, static)
  config: any;
}

/**
 * Any context type
 */
export type AnyContext =
  | GroupContext
  | ArrayContext
  | DataPointContext
  | StaticContext
  | GenericContext;

/**
 * Structured Settings - with config/general/variables
 */
export interface StructuredSettings {
  jsonFileName: string;
  config: GroupContext;
  general?: GroupContext;
  variables?: GroupContext;
}

/**
 * Raw Settings - simple attribute map
 */
export interface RawSettings {
  jsonFileName: string;
  [key: string]: any;
}

/**
 * Widget settings (structured or raw)
 */
export type WidgetSettings = StructuredSettings | RawSettings;

/**
 * Component metadata
 */
export interface ComponentMeta {
  tagname: string; // e.g. "wui-widget-gauge", "wui-widget-pie"
  scripts: string[]; // Mandatory, e.g. ["gauge"]
  styles?: string[]; // Optional, defaults to []
  jsonSchema?: string | object; // Path string like "StandardLibrary/Charts/gauge-json-schema" or object
  uiSchema?: string | object; // Path string like "StandardLibrary/Charts/gauge-ui-schema" or object
}

/**
 * Widget permissions
 */
export interface WidgetPermissions {
  canWrite?: boolean;
}

/**
 * Complete Widget Instance (as stored in WinCC OA)
 */
export interface WidgetInstance {
  id: string; // UUID v4
  version: number; // 2 for WebComponent widgets
  name: WidgetName;
  x: number;
  y: number;
  rows: number;
  cols: number;
  minCols?: number; // Preferred over minItemCols
  minRows?: number; // Preferred over minItemRows
  minItemCols?: number; // Legacy, use minCols
  minItemRows?: number; // Legacy, use minRows
  rotation?: number;
  permissions?: WidgetPermissions;
  settings: WidgetSettings;
  component: ComponentMeta;
}

/**
 * Helper to check if settings are structured
 */
export function isStructuredSettings(settings: WidgetSettings): settings is StructuredSettings {
  return 'config' in settings && typeof (settings as StructuredSettings).config === 'object';
}

/**
 * Helper to create a static context
 */
export function createStaticContext(value: any): StaticContext {
  return {
    context: 'static',
    config: value
  };
}

/**
 * Helper to create a datapoint context
 */
export function createDataPointContext(
  dataPath: string,
  dataType: string = 'float',
  isCnsNode: boolean = false,
  additional?: Record<string, any>
): DataPointContext {
  return {
    context: 'data-point',
    config: {
      dataPath,
      dataType,
      isCnsNode,
      ...additional
    }
  };
}

/**
 * Helper to create a group context
 */
export function createGroupContext(config: Record<string, any>): GroupContext {
  return {
    context: 'group',
    config
  };
}

/**
 * Helper to create an array context
 */
export function createArrayContext(items: Array<GroupContext | GenericContext>): ArrayContext {
  return {
    context: 'array',
    config: items
  };
}

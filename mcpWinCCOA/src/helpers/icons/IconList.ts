/**
 * Icon List Manager
 *
 * Manages the 1,407 Siemens IX icons available for WinCC OA dashboards.
 * Provides categorization, searching, and filtering capabilities.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface IconCategory {
  name: string;
  description: string;
  keywords: string[];
  icons: string[];
}

/**
 * Icon categories with curated icon lists
 */
export const ICON_CATEGORIES: IconCategory[] = [
  {
    name: 'trend',
    description: 'Trend and direction indicators',
    keywords: ['trend', 'direction', 'up', 'down', 'sideways'],
    icons: [
      'trend',
      'trend-upward',
      'trend-upward-filled',
      'trend-upward-circle',
      'trend-downward',
      'trend-downward-filled',
      'trend-downward-circle',
      'trend-sideways',
      'trend-sideways-filled',
      'trend-sideways-circle',
      'trend-companion',
      'trend-flat-curve',
      'monitor-trend'
    ]
  },
  {
    name: 'chart',
    description: 'Chart and graph types',
    keywords: ['chart', 'graph', 'diagram', 'plot', 'visualization'],
    icons: [
      'chart-curve-spline',
      'chart-curve-linear',
      'chart-curve-stepped',
      'barchart',
      'barchart-horizontal',
      'stacked-barchart',
      'linechart',
      'areachart',
      'piechart',
      'piechart-filled',
      'doughnutchart',
      'doughnutchart-filled',
      'radarchart',
      'polarchart',
      'polarchart-filled',
      'spiderchart',
      'spiderchart-filled',
      'gaugechart',
      'gauge',
      'gauge-filled',
      'ganttchart',
      'sankeychart',
      'scatterplot',
      'box-plot',
      'box-plot-filled',
      'heat-map-chart',
      'heat-map-chart-filled',
      'chart-diagram',
      'chart-diagrams'
    ]
  },
  {
    name: 'status',
    description: 'Status indicators and alerts',
    keywords: ['status', 'alert', 'alarm', 'error', 'warning', 'success', 'info'],
    icons: [
      'alarm',
      'alarm-filled',
      'error',
      'error-filled',
      'warning',
      'warning-filled',
      'warning-rhomb',
      'warning-rhomb-filled',
      'warning-hexagon',
      'warning-hexagon-filled',
      'warning-octagon',
      'warning-octagon-filled',
      'warning-square',
      'warning-square-filled',
      'success',
      'success-filled',
      'info',
      'info-filled',
      'indicator',
      'indicator-filled'
    ]
  },
  {
    name: 'action',
    description: 'Common user actions',
    keywords: ['action', 'edit', 'delete', 'save', 'download', 'upload', 'copy'],
    icons: [
      'pen',
      'pen-filled',
      'trashcan',
      'trashcan-filled',
      'download',
      'upload',
      'save',
      'save-all',
      'refresh',
      'reload',
      'copy',
      'copy-filled',
      'paste',
      'paste-filled',
      'cut',
      'cut-filled',
      'add',
      'minus',
      'check',
      'close',
      'cancel'
    ]
  },
  {
    name: 'navigation',
    description: 'Navigation and movement',
    keywords: ['navigation', 'arrow', 'chevron', 'home', 'search'],
    icons: [
      'home',
      'home-filled',
      'search',
      'chevron-up',
      'chevron-down',
      'chevron-left',
      'chevron-right',
      'chevron-up-small',
      'chevron-down-small',
      'arrow-up',
      'arrow-down',
      'arrow-left',
      'arrow-right',
      'double-chevron-up',
      'double-chevron-down',
      'double-chevron-left',
      'double-chevron-right'
    ]
  },
  {
    name: 'settings',
    description: 'Configuration and settings',
    keywords: ['settings', 'configuration', 'cogwheel', 'gear'],
    icons: [
      'cogwheel',
      'cogwheel-filled',
      'configuration',
      'settings',
      'user-settings',
      'user-settings-filled',
      'user-management-settings',
      'project-settings',
      'calendar-settings',
      'database',
      'database-filled'
    ]
  },
  {
    name: 'time',
    description: 'Time and schedule related',
    keywords: ['time', 'clock', 'calendar', 'schedule', 'date'],
    icons: [
      'clock',
      'clock-filled',
      'calendar',
      'calendar-filled',
      'calendar-day',
      'calendar-week',
      'hourglass',
      'hourglass-filled',
      'stopwatch',
      'stopwatch-filled',
      'alarm-clock',
      'alarm-clock-filled',
      'time-zone',
      'time-zone-filled'
    ]
  },
  {
    name: 'device',
    description: 'Hardware and devices',
    keywords: ['device', 'hardware', 'plc', 'network', 'sensor'],
    icons: [
      'generic-device',
      'plc-device',
      'plc',
      'network-device',
      'network-device-filled',
      'server-interface',
      'pc-tower',
      'monitor',
      'screen',
      'sensor',
      'drive',
      'power-supply'
    ]
  },
  {
    name: 'user',
    description: 'People and user management',
    keywords: ['user', 'person', 'people', 'profile', 'group'],
    icons: [
      'user',
      'user-filled',
      'user-profile',
      'user-profile-filled',
      'user-group',
      'user-management',
      'user-management-filled',
      'add-user'
    ]
  },
  {
    name: 'file',
    description: 'Files and documents',
    keywords: ['file', 'document', 'folder', 'pdf', 'save'],
    icons: [
      'document',
      'document-filled',
      'folder',
      'folder-filled',
      'folder-open',
      'folder-new',
      'open-file',
      'pdf-document',
      'code-document',
      'text-document',
      'json-document',
      'xml-document'
    ]
  },
  {
    name: 'plant',
    description: 'Industrial plants and buildings',
    keywords: ['plant', 'factory', 'building', 'industrial'],
    icons: [
      'plant',
      'plant-filled',
      'plant-details',
      'create-plant',
      'operate-plant',
      'building1',
      'building2',
      'global-plant'
    ]
  },
  {
    name: 'battery',
    description: 'Battery and power status',
    keywords: ['battery', 'power', 'energy', 'charge', 'voltage'],
    icons: [
      'battery-full',
      'battery-three-quarter',
      'battery-half',
      'battery-quarter',
      'battery-low',
      'battery-empty',
      'battery-charge',
      'electrical-energy'
    ]
  },
  {
    name: 'network',
    description: 'Connectivity and network',
    keywords: ['network', 'connection', 'connected', 'wifi', 'signal'],
    icons: [
      'connected',
      'connected-circle',
      'disconnected',
      'disconnected-circle',
      'network-wired',
      'network-wired-wireless',
      'wlan-strength0',
      'wlan-strength1',
      'wlan-strength2',
      'wlan-strength3'
    ]
  }
];

/**
 * Icon List Manager Class
 */
export class IconList {
  private allIcons: Set<string>;
  private iconListPath: string;

  constructor(projectPath?: string) {
    this.allIcons = new Set();

    // Path to IX_ICONS_LIST.txt in docs folder
    // __dirname points to build/helpers/icons/, so go up 3 levels to reach mcpWinCCOA root
    this.iconListPath = projectPath
      ? path.join(projectPath, 'docs', 'IX_ICONS_LIST.txt')
      : path.join(__dirname, '..', '..', '..', 'docs', 'IX_ICONS_LIST.txt');
  }

  /**
   * Load all icons from IX_ICONS_LIST.txt
   */
  loadIcons(): void {
    if (this.allIcons.size > 0) {
      return; // Already loaded
    }

    try {
      if (fs.existsSync(this.iconListPath)) {
        const content = fs.readFileSync(this.iconListPath, 'utf8');
        const icons = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        icons.forEach(icon => this.allIcons.add(icon));
      } else {
        // Fallback: load from categories if file doesn't exist
        ICON_CATEGORIES.forEach(category => {
          category.icons.forEach(icon => this.allIcons.add(icon));
        });
      }
    } catch (error) {
      console.error('Failed to load icon list:', error);
      // Fallback to categories
      ICON_CATEGORIES.forEach(category => {
        category.icons.forEach(icon => this.allIcons.add(icon));
      });
    }
  }

  /**
   * Search icons by keyword
   * @param keyword - Search term (case-insensitive)
   * @param limit - Maximum number of results
   * @returns Array of matching icon names
   */
  searchIcons(keyword: string, limit: number = 50): string[] {
    this.loadIcons();

    if (!keyword || keyword.trim() === '') {
      // Return random sample if no keyword
      return Array.from(this.allIcons).slice(0, limit);
    }

    const searchTerm = keyword.toLowerCase();
    const matches: string[] = [];

    for (const icon of this.allIcons) {
      if (icon.includes(searchTerm)) {
        matches.push(icon);
        if (matches.length >= limit) {
          break;
        }
      }
    }

    return matches.sort();
  }

  /**
   * Get icons for a specific category
   * @param categoryName - Category name
   * @returns Array of icon names in that category
   */
  getCategory(categoryName: string): string[] {
    const category = ICON_CATEGORIES.find(cat => cat.name === categoryName);
    return category ? category.icons : [];
  }

  /**
   * Get all available categories
   * @returns Array of category information
   */
  getAllCategories(): IconCategory[] {
    return ICON_CATEGORIES;
  }

  /**
   * Check if an icon exists
   * @param iconName - Icon name to check
   * @returns True if icon exists
   */
  iconExists(iconName: string): boolean {
    this.loadIcons();
    return this.allIcons.has(iconName);
  }

  /**
   * Get total number of icons
   * @returns Total icon count
   */
  getTotalCount(): number {
    this.loadIcons();
    return this.allIcons.size;
  }

  /**
   * Search icons by category and keyword
   * @param category - Category name
   * @param keyword - Optional search term
   * @param limit - Maximum results
   * @returns Filtered icon names
   */
  searchByCategory(category: string, keyword?: string, limit: number = 50): string[] {
    const categoryIcons = this.getCategory(category);

    if (!keyword || keyword.trim() === '') {
      return categoryIcons.slice(0, limit);
    }

    const searchTerm = keyword.toLowerCase();
    return categoryIcons
      .filter(icon => icon.includes(searchTerm))
      .slice(0, limit);
  }
}

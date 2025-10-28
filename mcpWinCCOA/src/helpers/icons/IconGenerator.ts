/**
 * Icon Generator
 *
 * Utility class for generating custom SVG icons for WinCC OA dashboards.
 * Icons are saved to /data/WebUI/icons/ and can be referenced in widget headers/footers.
 *
 * IMPORTANT: Icons must be small (24x24 pixels by default) to match Siemens IX icon size.
 * Header/footer icons cannot be full-width banners - use small icons only.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface IconConfig {
  name: string; // Icon filename (without .svg extension)
  type: 'simple' | 'trend' | 'gauge' | 'alert' | 'custom';
  color?: string; // Primary color (default: currentColor for theme support)
  size?: number; // Viewbox size in pixels - should match IX Icons (24x24)
  customSvg?: string; // Custom SVG path/shape data
}

/**
 * SVG Icon Generator Class
 */
export class IconGenerator {
  private iconsPath: string;

  constructor(projectPath?: string) {
    // Default to standard WinCC OA project structure
    // __dirname points to build/helpers/icons/, go up 6 levels to reach project root
    this.iconsPath = projectPath
      ? path.join(projectPath, 'data', 'WebUI', 'icons')
      : path.join(__dirname, '..', '..', '..', '..', '..', '..', 'data', 'WebUI', 'icons');

    // Ensure icons directory exists
    if (!fs.existsSync(this.iconsPath)) {
      fs.mkdirSync(this.iconsPath, { recursive: true });
    }
  }

  /**
   * Generate a simple icon SVG
   * @param config - Icon configuration
   * @returns Path to generated SVG file
   */
  generateIcon(config: IconConfig): string {
    const size = config.size || 24;
    const color = config.color || 'currentColor';

    let svgContent: string;

    switch (config.type) {
      case 'trend':
        svgContent = this.createTrendIcon(size, color);
        break;
      case 'gauge':
        svgContent = this.createGaugeIcon(size, color);
        break;
      case 'alert':
        svgContent = this.createAlertIcon(size, color);
        break;
      case 'custom':
        if (!config.customSvg) {
          throw new Error('Custom SVG content is required for custom icon type');
        }
        svgContent = this.createCustomIcon(size, color, config.customSvg);
        break;
      case 'simple':
      default:
        svgContent = this.createSimpleIcon(size, color);
        break;
    }

    const filename = `${config.name}.svg`;
    const filepath = path.join(this.iconsPath, filename);

    fs.writeFileSync(filepath, svgContent, 'utf8');

    return `/data/WebUI/icons/${filename}`;
  }

  /**
   * Create a simple geometric icon (circle/square)
   */
  private createSimpleIcon(size: number, color: string): string {
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 3;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <circle cx="${centerX}" cy="${centerY}" r="${radius}" stroke="${color}" stroke-width="2" fill="none"/>
</svg>`;
  }

  /**
   * Create a trend icon (line chart with upward trend)
   */
  private createTrendIcon(size: number, color: string): string {
    const path = `M2 ${size - 4} L${size / 4} ${size / 2} L${size / 2} ${size / 3} L${3 * size / 4} ${size / 4} L${size - 2} 2`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <path d="${path}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${size / 4}" cy="${size / 2}" r="2" fill="${color}"/>
  <circle cx="${size / 2}" cy="${size / 3}" r="2" fill="${color}"/>
  <circle cx="${3 * size / 4}" cy="${size / 4}" r="2" fill="${color}"/>
</svg>`;
  }

  /**
   * Create a gauge icon (semicircular meter)
   */
  private createGaugeIcon(size: number, color: string): string {
    const centerX = size / 2;
    const centerY = size - 3;
    const radius = size / 2 - 3;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <path d="M3 ${centerY} A${radius} ${radius} 0 0 1 ${size - 3} ${centerY}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <line x1="${centerX}" y1="${centerY}" x2="${centerX + radius * 0.6}" y2="${centerY - radius * 0.6}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
</svg>`;
  }

  /**
   * Create an alert icon (warning triangle)
   */
  private createAlertIcon(size: number, color: string): string {
    const path = `M${size / 2} 3 L${size - 3} ${size - 3} L3 ${size - 3} Z`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <path d="${path}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round"/>
  <line x1="${size / 2}" y1="${size / 2 - 2}" x2="${size / 2}" y2="${size / 2 + 2}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="${size / 2}" cy="${size - 8}" r="1.5" fill="${color}"/>
</svg>`;
  }

  /**
   * Create a custom icon from SVG path data
   */
  private createCustomIcon(size: number, color: string, svgPath: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <path d="${svgPath}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  }

  /**
   * List all available custom icons
   * @returns Array of icon paths
   */
  listCustomIcons(): string[] {
    if (!fs.existsSync(this.iconsPath)) {
      return [];
    }

    const files = fs.readdirSync(this.iconsPath);
    return files
      .filter(file => file.endsWith('.svg'))
      .map(file => `/data/WebUI/icons/${file}`);
  }

  /**
   * Delete a custom icon
   * @param iconName - Icon filename (with or without .svg extension)
   */
  deleteIcon(iconName: string): boolean {
    const filename = iconName.endsWith('.svg') ? iconName : `${iconName}.svg`;
    const filepath = path.join(this.iconsPath, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }

    return false;
  }
}

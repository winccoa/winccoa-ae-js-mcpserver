/**
 * Icon Generator
 *
 * Utility class for generating custom SVG icons for WinCC OA dashboards.
 * Icons are saved to <project>/data/WebUI/icons/ (public URL /data/WebUI/icons/<file>)
 * and can be referenced in widget headers/footers.
 *
 * IMPORTANT: Icons must be small (24x24 pixels by default) to match Siemens IX icon size.
 * Header/footer icons cannot be full-width banners - use small icons only.
 */

import fs from 'fs';
import path from 'path';

export interface IconConfig {
  name: string; // Icon filename (without .svg extension)
  type: 'simple' | 'trend' | 'gauge' | 'alert' | 'custom';
  color?: string; // Primary color (default: currentColor for theme support)
  size?: number; // Viewbox size in pixels - should match IX Icons (24x24)
  customSvg?: string; // Custom SVG path/shape data
}

/** Hint appended to every storage error. */
const STORAGE_HINT = 'Set WINCCOA_PROJ_PATH or run inside the WinCC OA JavaScript manager.';

/**
 * Raised when the icons directory cannot be used: the project path is unknown,
 * or the directory cannot be created or written. The message is meant for the
 * MCP client as-is.
 */
export class IconStorageError extends Error {
  constructor(message: string, public readonly iconsPath?: string) {
    super(message);
    this.name = 'IconStorageError';
  }
}

/**
 * SVG Icon Generator Class
 *
 * The constructor never touches the filesystem and never throws: it used to
 * create the icons directory eagerly, and because tools are registered on every
 * HTTP request, a wrong or unwritable path made the whole icon tool module fail
 * to load on every request. The directory is now created lazily, when an icon
 * is actually written.
 */
export class IconGenerator {
  private readonly iconsPath: string | undefined;

  /**
   * @param projectPath - WinCC OA project directory (see utils/projectPath.ts).
   *   When undefined, the icon tools report a clear error instead of guessing.
   */
  constructor(projectPath?: string) {
    this.iconsPath = projectPath ? path.join(projectPath, 'data', 'WebUI', 'icons') : undefined;
  }

  /** Absolute icons directory, or undefined if the project path is unknown. */
  getIconsPath(): string | undefined {
    return this.iconsPath;
  }

  /**
   * Return the icons directory, failing with an IconStorageError if the
   * project path is unknown.
   */
  private requireIconsPath(): string {
    if (!this.iconsPath) {
      throw new IconStorageError(`Cannot write icons: project path unknown. ${STORAGE_HINT}`);
    }
    return this.iconsPath;
  }

  /**
   * Create the icons directory if needed and verify it is writable.
   * @returns The icons directory
   */
  private ensureWritableIconsDir(): string {
    const iconsPath = this.requireIconsPath();
    try {
      fs.mkdirSync(iconsPath, { recursive: true });
      fs.accessSync(iconsPath, fs.constants.W_OK);
    } catch {
      throw new IconStorageError(
        `Cannot write icons: directory not writable: ${iconsPath}. ${STORAGE_HINT}`,
        iconsPath
      );
    }
    return iconsPath;
  }

  /**
   * Generate a simple icon SVG
   * @param config - Icon configuration
   * @returns Public URL of the generated SVG file
   * @throws IconStorageError if the icons directory is unknown or not writable
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

    const iconsPath = this.ensureWritableIconsDir();
    const filename = `${config.name}.svg`;
    const filepath = path.join(iconsPath, filename);

    try {
      fs.writeFileSync(filepath, svgContent, 'utf8');
    } catch {
      throw new IconStorageError(
        `Cannot write icons: directory not writable: ${iconsPath}. ${STORAGE_HINT}`,
        iconsPath
      );
    }

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
    const iconsPath = this.requireIconsPath();
    if (!fs.existsSync(iconsPath)) {
      return [];
    }

    const files = fs.readdirSync(iconsPath);
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
    const filepath = path.join(this.requireIconsPath(), filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }

    return false;
  }
}

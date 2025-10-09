/**
 * Server Deployment Configuration
 *
 * Configuration for HTTP/STDIO server modes, authentication, CORS, SSL, and security.
 */

import { readFileSync } from 'fs';
import type { ServerConfig, SslCertificates } from '../types/index.js';

// Server deployment configuration
export const serverConfig: ServerConfig = {
  // Server mode configuration
  mode: (process.env.MCP_MODE as 'http' | 'stdio') || 'http',

  // HTTP server configuration
  http: {
    port: parseInt(process.env.MCP_HTTP_PORT || '3000'),
    host: process.env.MCP_HTTP_HOST || '0.0.0.0', // Listen on all interfaces for server deployment

    // Authentication configuration
    auth: {
      enabled: true, // Always enabled for security
      type: (process.env.MCP_AUTH_TYPE as 'bearer' | 'api-key') || 'bearer',
      token: process.env.MCP_API_TOKEN, // Required - no default

      // Additional auth options for future expansion
      jwt: {
        enabled: process.env.MCP_JWT_ENABLED === 'true',
        secret: process.env.MCP_JWT_SECRET,
        expiresIn: process.env.MCP_JWT_EXPIRES_IN || '24h'
      }
    },

    // CORS configuration for browser-based clients
    cors: {
      enabled: process.env.MCP_CORS_ENABLED === 'true',
      origins: process.env.MCP_CORS_ORIGINS ? process.env.MCP_CORS_ORIGINS.split(',') : ['*'],
      credentials: process.env.MCP_CORS_CREDENTIALS === 'true'
    },

    // SSL/TLS configuration
    ssl: {
      enabled: process.env.MCP_SSL_ENABLED === 'true',
      cert: process.env.MCP_SSL_CERT_PATH,
      key: process.env.MCP_SSL_KEY_PATH,
      ca: process.env.MCP_SSL_CA_PATH
    }
  },

  // Security configuration
  security: {
    // Rate limiting
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX || '100') // requests per window
    },

    // IP whitelist/blacklist
    ipFilter: {
      enabled: process.env.IP_FILTER_ENABLED === 'true',
      whitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [],
      blacklist: process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : []
    }
  }
};

/**
 * Helper function to load SSL certificates
 * @returns SSL certificate data or null if SSL is disabled or loading fails
 */
export function loadSSLConfig(): SslCertificates | null {
  const config = serverConfig.http.ssl;
  if (!config.enabled) return null;

  try {
    if (!config.cert || !config.key) {
      console.error('SSL enabled but cert or key path not configured');
      return null;
    }

    return {
      cert: readFileSync(config.cert),
      key: readFileSync(config.key),
      ca: config.ca ? readFileSync(config.ca) : undefined
    };
  } catch (error) {
    console.error('Failed to load SSL certificates:', error);
    return null;
  }
}

/**
 * Validate configuration
 * @returns Array of validation error messages (empty if valid)
 */
export function validateConfig(): string[] {
  console.log('🔍 Starting configuration validation...');
  console.log('🔍 process.env.MCP_API_TOKEN:', process.env.MCP_API_TOKEN ? 'SET' : 'NOT SET');
  console.log('🔍 serverConfig.http.auth.token:', serverConfig.http.auth.token ? 'SET' : 'NOT SET');

  const errors: string[] = [];

  // Always require API token
  if (!serverConfig.http.auth.token) {
    console.log('❌ MCP_API_TOKEN validation failed');
    errors.push('MCP_API_TOKEN must be set in environment variables or .env file');
  } else {
    console.log('✅ MCP_API_TOKEN validation passed');
  }

  console.log('🔍 Validation completed with', errors.length, 'errors');
  return errors;
}

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
 * Is this host a loopback address?
 *
 * Used to decide whether running without TLS is merely a development
 * convenience or an actual exposure: on a loopback bind the API token never
 * leaves the machine, on any other bind it crosses the network in clear text.
 *
 * @param host - Host or interface the server binds to
 * @returns true if traffic cannot leave the machine
 */
export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h === '::1' ||
    h === '0:0:0:0:0:0:0:1' ||
    /^127\./.test(h)
  );
}

/**
 * Validate configuration.
 *
 * Returns messages rather than throwing, so the caller can report every problem
 * at once instead of one per restart.
 *
 * @returns Array of validation error messages (empty if valid)
 */
export function validateConfig(): string[] {
  const errors: string[] = [];

  // Always require an API token.
  if (!serverConfig.http.auth.token) {
    errors.push(
      'MCP_API_TOKEN must be set in the environment or .env file. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  // If TLS is on, the certificate must actually be usable. Previously
  // loadSSLConfig() returned null and the caller reported only
  // "certificates could not be loaded", which named neither the missing
  // variable nor the unreadable path.
  const ssl = serverConfig.http.ssl;
  if (ssl.enabled) {
    for (const [envVar, value] of [
      ['MCP_SSL_CERT_PATH', ssl.cert],
      ['MCP_SSL_KEY_PATH', ssl.key]
    ] as const) {
      if (!value) {
        errors.push(
          `MCP_SSL_ENABLED is true but ${envVar} is not set. ` +
            'Set it, or set MCP_SSL_ENABLED=false to serve plain HTTP. ' +
            'To create a self-signed pair: openssl req -x509 -newkey rsa:2048 ' +
            '-nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"'
        );
      } else {
        try {
          readFileSync(value);
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : String(cause);
          errors.push(`${envVar} is set to "${value}" but could not be read: ${reason}`);
        }
      }
    }

    if (ssl.ca) {
      try {
        readFileSync(ssl.ca);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        errors.push(`MCP_SSL_CA_PATH is set to "${ssl.ca}" but could not be read: ${reason}`);
      }
    }
  }

  return errors;
}

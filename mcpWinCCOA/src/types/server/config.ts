/**
 * Server Configuration Types
 *
 * Type definitions for server deployment and security configuration.
 */

/**
 * JWT authentication configuration
 */
export interface JwtConfig {
  enabled: boolean;
  secret?: string;
  expiresIn: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  enabled: boolean;
  type: 'bearer' | 'api-key';
  token?: string;
  jwt: JwtConfig;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  enabled: boolean;
  origins: string[];
  credentials: boolean;
}

/**
 * SSL/TLS configuration
 */
export interface SslConfig {
  enabled: boolean;
  cert?: string;
  key?: string;
  ca?: string;
}

/**
 * HTTP server configuration
 */
export interface HttpConfig {
  port: number;
  host: string;
  auth: AuthConfig;
  cors: CorsConfig;
  ssl: SslConfig;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
}

/**
 * IP filtering configuration
 */
export interface IpFilterConfig {
  enabled: boolean;
  whitelist: string[];
  blacklist: string[];
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  rateLimit: RateLimitConfig;
  ipFilter: IpFilterConfig;
}

/**
 * Complete server configuration
 */
export interface ServerConfig {
  mode: 'http' | 'stdio';
  http: HttpConfig;
  security: SecurityConfig;
}

/**
 * SSL certificate data (loaded from files)
 */
export interface SslCertificates {
  cert: Buffer;
  key: Buffer;
  ca?: Buffer;
}

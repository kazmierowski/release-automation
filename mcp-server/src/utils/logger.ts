import winston from 'winston';

/**
 * Sensitive field patterns to redact from logs
 * Prevents credential leakage in audit trails
 */
const SENSITIVE_PATTERNS = [
  // API tokens and secrets
  /token["\s:=]+([a-zA-Z0-9_\-]+)/gi,
  /api[_-]?key["\s:=]+([a-zA-Z0-9_\-]+)/gi,
  /secret["\s:=]+([a-zA-Z0-9_\-]+)/gi,
  /password["\s:=]+([a-zA-Z0-9_\-@!#$%^&*]+)/gi,

  // Authorization headers
  /authorization["\s:=]+bearer\s+([a-zA-Z0-9._\-]+)/gi,
  /authorization["\s:=]+basic\s+([a-zA-Z0-9=]+)/gi,

  // Azure Key Vault secrets
  /vault\.azure\.net\/secrets\/([^"'\s]+)/gi,

  // Git credentials in URLs
  /https?:\/\/[^:@]+:([^@]+)@/gi,

  // Jenkins API tokens
  /jenkins[_-]?api[_-]?token["\s:=]+([a-zA-Z0-9]+)/gi,

  // JIRA tokens
  /jira[_-]?api[_-]?token["\s:=]+([a-zA-Z0-9]+)/gi,

  // Teams/Microsoft Graph tokens
  /client[_-]?secret["\s:=]+([a-zA-Z0-9_\-~.]+)/gi,
];

/**
 * Sanitizes log messages by redacting sensitive information
 *
 * @param message - Log message to sanitize
 * @returns Sanitized message with credentials replaced by ***REDACTED***
 */
export function sanitizeMessage(message: string): string {
  let sanitized = message;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, ...groups) => {
      // Replace the captured group (credential) with ***REDACTED***
      const prefix = match.substring(0, match.indexOf(groups[0]));
      return `${prefix}***REDACTED***`;
    });
  }

  return sanitized;
}

/**
 * Sanitizes objects by redacting sensitive field values
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object with credentials redacted
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeMessage(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive field names
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('credential')
      ) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Custom Winston format to sanitize log messages
 */
const sanitizeFormat = winston.format((info) => {
  // Sanitize message
  if (typeof info.message === 'string') {
    info.message = sanitizeMessage(info.message);
  }

  // Sanitize metadata
  if (info.metadata) {
    info.metadata = sanitizeObject(info.metadata);
  }

  // Sanitize error stacks
  if (info.stack && typeof info.stack === 'string') {
    info.stack = sanitizeMessage(info.stack);
  }

  return info;
});

/**
 * Create Winston logger instance with credential redaction
 *
 * Features:
 * - Automatic credential sanitization
 * - Structured JSON logging in production
 * - Human-readable console logging in development
 * - ISO timestamp formatting
 * - Log level from NODE_ENV (debug in dev, info in prod)
 */
const createLogger = (): winston.Logger => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      sanitizeFormat(),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        silent: isTest, // Suppress logs in tests
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, metadata }) => {
            const metaStr = metadata && typeof metadata === 'object' && Object.keys(metadata as object).length > 0
              ? `\n${JSON.stringify(metadata, null, 2)}`
              : '';
            return `${timestamp} [${level}]: ${message}${metaStr}`;
          })
        ),
      }),

      // File transport for errors (production only)
      ...(isProduction
        ? [
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
              format: winston.format.json(),
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
              format: winston.format.json(),
            }),
          ]
        : []),
    ],
  });
};

/**
 * Singleton logger instance
 * Automatically redacts credentials from all log messages
 */
export const logger = createLogger();

/**
 * Log API request/response with automatic sanitization
 *
 * @param method - HTTP method
 * @param url - Request URL
 * @param status - Response status code
 * @param duration - Request duration in milliseconds
 */
export function logApiCall(
  method: string,
  url: string,
  status: number,
  duration: number
): void {
  const sanitizedUrl = sanitizeMessage(url);
  logger.info(`API ${method} ${sanitizedUrl} - ${status} (${duration}ms)`);
}

/**
 * Log external service error with context
 *
 * @param service - Service name (e.g., 'Jenkins', 'JIRA', 'Bitbucket')
 * @param operation - Operation attempted
 * @param error - Error object
 */
export function logServiceError(
  service: string,
  operation: string,
  error: Error
): void {
  logger.error(`${service} ${operation} failed`, {
    service,
    operation,
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Log MCP tool execution
 *
 * @param toolName - MCP tool name
 * @param params - Tool input parameters (will be sanitized)
 * @param duration - Execution duration in milliseconds
 */
export function logToolExecution(
  toolName: string,
  params: unknown,
  duration: number
): void {
  logger.info(`MCP tool ${toolName} executed`, {
    tool: toolName,
    params: sanitizeObject(params),
    duration_ms: duration,
  });
}

import { ISecretsProvider, Secret } from '../providers/secrets/base.js';
import { logger } from '../utils/logger.js';

/**
 * Cached secret entry with TTL
 */
interface CachedSecret {
  secret: Secret;
  cachedAt: number; // Unix timestamp in milliseconds
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Secrets Manager
 *
 * Wraps secrets provider with in-memory caching (5 min TTL by default)
 * to minimize API calls and improve performance
 *
 * Features:
 * - Configurable TTL (default: 5 minutes from environment)
 * - Automatic cache expiration
 * - Cache invalidation on rotation
 * - Provider abstraction (Azure KV, Vault, AWS Secrets Manager)
 */
export class SecretsManager {
  private cache: Map<string, CachedSecret> = new Map();
  private cacheTTL: number; // Milliseconds
  private provider: ISecretsProvider;

  constructor(provider: ISecretsProvider, cacheTTLMs?: number) {
    this.provider = provider;
    this.cacheTTL = cacheTTLMs || parseInt(process.env.CACHE_TTL_SECRETS_MS || '300000', 10); // 5 min default

    logger.info('SecretsManager initialized', {
      provider: this.provider.provider,
      cacheTTL_ms: this.cacheTTL,
    });
  }

  /**
   * Get secret value with automatic caching
   *
   * Cache flow:
   * 1. Check cache for valid (non-expired) entry
   * 2. If cache miss or expired, fetch from provider
   * 3. Store in cache with TTL
   * 4. Return secret value
   *
   * @param secretName - Secret name to retrieve
   * @param version - Optional specific version
   * @returns {Promise<string>} Secret value
   */
  async getSecretValue(secretName: string, version?: string): Promise<string> {
    const cacheKey = version ? `${secretName}:${version}` : secretName;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      logger.debug(`Secret cache hit: ${secretName}`);
      return cached.secret.value;
    }

    // Cache miss or expired - fetch from provider
    logger.debug(`Secret cache miss: ${secretName} - fetching from provider`);

    const secret = await this.provider.getSecret(secretName, version);

    // Store in cache
    const now = Date.now();
    this.cache.set(cacheKey, {
      secret,
      cachedAt: now,
      expiresAt: now + this.cacheTTL,
    });

    logger.info(`Secret cached: ${secretName}`, {
      version: secret.metadata.version,
      expiresIn_ms: this.cacheTTL,
    });

    return secret.value;
  }

  /**
   * Get full secret with metadata (bypasses cache)
   *
   * Use when metadata is needed (version, expiration, tags)
   *
   * @param secretName - Secret name to retrieve
   * @param version - Optional specific version
   * @returns {Promise<Secret>} Secret with metadata
   */
  async getSecret(secretName: string, version?: string): Promise<Secret> {
    return this.provider.getSecret(secretName, version);
  }

  /**
   * Rotate secret to new value
   *
   * Automatically invalidates cache after rotation
   *
   * @param secretName - Secret name to rotate
   * @param newValue - New secret value
   * @returns {Promise<string>} New version identifier
   */
  async rotateSecret(secretName: string, newValue: string): Promise<string> {
    logger.info(`Rotating secret: ${secretName}`);

    const result = await this.provider.rotateSecret(secretName, newValue);

    if (result.success) {
      // Invalidate all cached versions of this secret
      this.invalidateSecret(secretName);

      logger.info(`Secret rotated and cache invalidated: ${secretName}`, {
        newVersion: result.new_version,
      });

      return result.new_version || 'latest';
    } else {
      throw new Error(result.error || 'Secret rotation failed');
    }
  }

  /**
   * Check if secret exists
   *
   * @param secretName - Secret name to check
   * @returns {Promise<boolean>} True if secret exists
   */
  async secretExists(secretName: string): Promise<boolean> {
    return this.provider.secretExists(secretName);
  }

  /**
   * Invalidate cached secret by name (all versions)
   *
   * Useful for manual cache refresh or after external updates
   *
   * @param secretName - Secret name to invalidate
   */
  invalidateSecret(secretName: string): void {
    let invalidatedCount = 0;

    // Invalidate all cache keys matching this secret name
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey === secretName || cacheKey.startsWith(`${secretName}:`)) {
        this.cache.delete(cacheKey);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      logger.debug(`Invalidated ${invalidatedCount} cache entries for: ${secretName}`);
    }
  }

  /**
   * Clear entire cache
   *
   * Use sparingly - typically only needed for testing or emergency scenarios
   */
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared secrets cache (${cacheSize} entries)`);
  }

  /**
   * Get cache statistics for monitoring
   *
   * @returns Cache statistics
   */
  getCacheStats(): {
    total_entries: number;
    valid_entries: number;
    expired_entries: number;
    cache_ttl_ms: number;
  } {
    let validCount = 0;
    let expiredCount = 0;

    for (const cached of this.cache.values()) {
      if (this.isCacheValid(cached)) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      total_entries: this.cache.size,
      valid_entries: validCount,
      expired_entries: expiredCount,
      cache_ttl_ms: this.cacheTTL,
    };
  }

  /**
   * Cleanup expired cache entries
   *
   * Should be called periodically (e.g., every 5 minutes)
   */
  cleanupExpiredEntries(): number {
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      if (!this.isCacheValid(cached)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }

    return keysToDelete.length;
  }

  /**
   * Check if cached entry is still valid (not expired)
   *
   * @param cached - Cached secret entry
   * @returns True if cache entry is valid
   */
  private isCacheValid(cached: CachedSecret): boolean {
    return Date.now() < cached.expiresAt;
  }

  /**
   * Health check for secrets provider
   *
   * @returns {Promise<boolean>} True if provider is healthy
   */
  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }
}

/**
 * Start periodic cache cleanup
 *
 * Runs cleanup every `interval` milliseconds
 *
 * @param manager - SecretsManager instance
 * @param interval - Cleanup interval in milliseconds (default: 5 minutes)
 * @returns NodeJS.Timeout for cleanup interval
 */
export function startCacheCleanup(
  manager: SecretsManager,
  interval: number = 300000
): NodeJS.Timeout {
  logger.info('Starting secrets cache cleanup task', {
    interval_ms: interval,
  });

  return setInterval(() => {
    manager.cleanupExpiredEntries();
  }, interval);
}

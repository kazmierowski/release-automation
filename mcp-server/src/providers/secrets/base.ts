/**
 * Secrets Provider Abstraction Layer
 *
 * Provides platform-agnostic interface for secret storage across:
 * - Azure Key Vault (initial implementation)
 * - HashiCorp Vault (future)
 * - AWS Secrets Manager (future)
 *
 * All implementations must support:
 * - Secure secret retrieval with caching (5 min TTL)
 * - Secret listing for discovery
 * - Secret rotation capabilities
 * - Audit logging for compliance
 */

/**
 * Secret metadata
 */
export interface SecretMetadata {
  name: string;
  version?: string;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  tags?: Record<string, string>;
  enabled: boolean;
}

/**
 * Secret with value and metadata
 */
export interface Secret {
  name: string;
  value: string;
  metadata: SecretMetadata;
}

/**
 * Secret rotation result
 */
export interface RotationResult {
  success: boolean;
  secret_name: string;
  new_version?: string;
  rotated_at?: string;
  error?: string;
}

/**
 * Abstract secrets provider interface
 *
 * All secret storage implementations must implement this interface
 */
export interface ISecretsProvider {
  /**
   * Provider identifier
   */
  readonly provider: 'azure-keyvault' | 'vault' | 'aws-secrets-manager';

  /**
   * Get secret value by name
   *
   * IMPORTANT: Results should be cached at the service layer (5 min TTL)
   * to minimize API calls and improve performance
   *
   * @param secretName - Secret name/identifier
   * @param version - Optional specific version (default: latest)
   * @returns {Promise<Secret>} Secret with value and metadata
   * @throws {Error} If secret not found or access denied
   */
  getSecret(secretName: string, version?: string): Promise<Secret>;

  /**
   * List all available secrets (metadata only, no values)
   *
   * Used for discovery and health checks
   *
   * @param filter - Optional filter criteria (tags, name pattern)
   * @returns {Promise<SecretMetadata[]>} Array of secret metadata
   * @throws {Error} If access denied or API error
   */
  listSecrets(filter?: {
    tags?: Record<string, string>;
    namePattern?: string;
  }): Promise<SecretMetadata[]>;

  /**
   * Rotate secret to new value
   *
   * Implementation should:
   * 1. Create new secret version with new value
   * 2. Mark old version as deprecated (don't delete immediately)
   * 3. Return rotation result with new version
   *
   * @param secretName - Secret name to rotate
   * @param newValue - New secret value
   * @returns {Promise<RotationResult>} Rotation operation result
   * @throws {Error} If secret not found or rotation fails
   */
  rotateSecret(secretName: string, newValue: string): Promise<RotationResult>;

  /**
   * Check if secret exists
   *
   * @param secretName - Secret name to check
   * @returns {Promise<boolean>} True if secret exists
   */
  secretExists(secretName: string): Promise<boolean>;

  /**
   * Health check for secrets provider connection
   *
   * @returns {Promise<boolean>} True if provider is healthy and accessible
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Base error class for secrets provider operations
 */
export class SecretsProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly operation: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SecretsProviderError';
  }
}

/**
 * Secret not found error
 */
export class SecretNotFoundError extends SecretsProviderError {
  constructor(public readonly secretName: string, provider: string) {
    super(
      `Secret "${secretName}" not found`,
      provider,
      'getSecret',
      false // Not retryable
    );
    this.name = 'SecretNotFoundError';
  }
}

/**
 * Access denied error
 */
export class AccessDeniedError extends SecretsProviderError {
  constructor(
    public readonly secretName: string,
    public readonly reason: string,
    provider: string
  ) {
    super(
      `Access denied to secret "${secretName}": ${reason}`,
      provider,
      'getSecret',
      false // Not retryable - requires permission change
    );
    this.name = 'AccessDeniedError';
  }
}

/**
 * Secret rotation failed error
 */
export class RotationFailedError extends SecretsProviderError {
  constructor(
    public readonly secretName: string,
    public readonly reason: string,
    provider: string
  ) {
    super(
      `Failed to rotate secret "${secretName}": ${reason}`,
      provider,
      'rotateSecret',
      true // May be retryable depending on reason
    );
    this.name = 'RotationFailedError';
  }
}

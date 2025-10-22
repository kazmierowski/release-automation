import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../../utils/logger.js';
import { retry } from '../../utils/retry.js';
import {
  ISecretsProvider,
  Secret,
  SecretMetadata,
  RotationResult,
  SecretNotFoundError,
  AccessDeniedError,
  RotationFailedError,
  SecretsProviderError,
} from './base.js';

/**
 * Azure Key Vault configuration
 */
export interface AzureKeyVaultConfig {
  vaultUrl: string;
  credential?: DefaultAzureCredential;
}

/**
 * Azure Key Vault secrets provider implementation
 *
 * Uses Managed Identity for authentication (DefaultAzureCredential)
 * Implements secret retrieval, listing, and rotation
 *
 * API Documentation:
 * https://learn.microsoft.com/en-us/javascript/api/@azure/keyvault-secrets
 */
export class AzureKeyVaultProvider implements ISecretsProvider {
  readonly provider = 'azure-keyvault' as const;
  private client: SecretClient;

  constructor(config: AzureKeyVaultConfig) {
    // Use provided credential or default Managed Identity
    const credential = config.credential || new DefaultAzureCredential();

    this.client = new SecretClient(config.vaultUrl, credential);

    logger.info('Azure Key Vault provider initialized', {
      vaultUrl: config.vaultUrl,
    });
  }

  /**
   * Get secret value by name
   */
  async getSecret(secretName: string, version?: string): Promise<Secret> {
    const operation = async (): Promise<Secret> => {
      try {
        logger.debug(`Retrieving secret: ${secretName}`, {
          version: version || 'latest',
        });

        const secretResponse = await this.client.getSecret(secretName, {
          version,
        });

        if (!secretResponse.value) {
          throw new SecretNotFoundError(secretName, this.provider);
        }

        const metadata: SecretMetadata = {
          name: secretResponse.name,
          version: secretResponse.properties.version,
          created_at: secretResponse.properties.createdOn?.toISOString(),
          updated_at: secretResponse.properties.updatedOn?.toISOString(),
          expires_at: secretResponse.properties.expiresOn?.toISOString(),
          tags: secretResponse.properties.tags || undefined,
          enabled: secretResponse.properties.enabled || false,
        };

        logger.info(`Successfully retrieved secret: ${secretName}`);

        return {
          name: secretResponse.name,
          value: secretResponse.value,
          metadata,
        };
      } catch (error: any) {
        // Azure SDK error codes
        if (error.code === 'SecretNotFound' || error.statusCode === 404) {
          throw new SecretNotFoundError(secretName, this.provider);
        }

        if (error.code === 'Forbidden' || error.statusCode === 403) {
          throw new AccessDeniedError(
            secretName,
            error.message || 'Insufficient permissions',
            this.provider
          );
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to retrieve secret ${secretName}: ${message}`);

        throw new SecretsProviderError(
          `Failed to retrieve secret: ${message}`,
          this.provider,
          'getSecret',
          true // Retryable for transient errors
        );
      }
    };

    return retry(operation, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
      isRetryable: (error) =>
        !(error instanceof SecretNotFoundError) &&
        !(error instanceof AccessDeniedError),
    });
  }

  /**
   * List all available secrets (metadata only)
   */
  async listSecrets(filter?: {
    tags?: Record<string, string>;
    namePattern?: string;
  }): Promise<SecretMetadata[]> {
    const operation = async (): Promise<SecretMetadata[]> => {
      try {
        logger.debug('Listing secrets from Key Vault');

        const secretsMetadata: SecretMetadata[] = [];

        // Iterate through all secret properties
        for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
          // Apply name pattern filter if specified
          if (filter?.namePattern) {
            const regex = new RegExp(filter.namePattern);
            if (!regex.test(secretProperties.name)) {
              continue;
            }
          }

          // Apply tag filter if specified
          if (filter?.tags) {
            const secretTags = secretProperties.tags || {};
            const matchesTags = Object.entries(filter.tags).every(
              ([key, value]) => secretTags[key] === value
            );
            if (!matchesTags) {
              continue;
            }
          }

          secretsMetadata.push({
            name: secretProperties.name,
            version: secretProperties.version,
            created_at: secretProperties.createdOn?.toISOString(),
            updated_at: secretProperties.updatedOn?.toISOString(),
            expires_at: secretProperties.expiresOn?.toISOString(),
            tags: secretProperties.tags || undefined,
            enabled: secretProperties.enabled || false,
          });
        }

        logger.info(`Listed ${secretsMetadata.length} secrets from Key Vault`);

        return secretsMetadata;
      } catch (error: any) {
        if (error.code === 'Forbidden' || error.statusCode === 403) {
          throw new AccessDeniedError(
            '*',
            'Insufficient permissions to list secrets',
            this.provider
          );
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to list secrets: ${message}`);

        throw new SecretsProviderError(
          `Failed to list secrets: ${message}`,
          this.provider,
          'listSecrets',
          true
        );
      }
    };

    return retry(operation, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
      isRetryable: (error) => !(error instanceof AccessDeniedError),
    });
  }

  /**
   * Rotate secret to new value
   */
  async rotateSecret(
    secretName: string,
    newValue: string
  ): Promise<RotationResult> {
    const operation = async (): Promise<RotationResult> => {
      try {
        logger.info(`Rotating secret: ${secretName}`);

        // Get current secret to preserve tags and metadata
        let tags: Record<string, string> | undefined;
        try {
          const currentSecret = await this.client.getSecret(secretName);
          tags = currentSecret.properties.tags || undefined;
        } catch {
          // Secret might not exist, that's okay
          tags = undefined;
        }

        // Set new secret value (creates new version)
        const setResult = await this.client.setSecret(secretName, newValue, {
          tags: {
            ...tags,
            lastRotated: new Date().toISOString(),
            rotatedBy: 'mcp-server',
          },
        });

        logger.info(`Successfully rotated secret: ${secretName}`, {
          newVersion: setResult.properties.version,
        });

        return {
          success: true,
          secret_name: secretName,
          new_version: setResult.properties.version,
          rotated_at: new Date().toISOString(),
        };
      } catch (error: any) {
        if (error.code === 'Forbidden' || error.statusCode === 403) {
          throw new AccessDeniedError(
            secretName,
            'Insufficient permissions to rotate secret',
            this.provider
          );
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to rotate secret ${secretName}: ${message}`);

        throw new RotationFailedError(secretName, message, this.provider);
      }
    };

    return retry(operation, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
      isRetryable: (error) =>
        !(error instanceof AccessDeniedError) &&
        error instanceof RotationFailedError,
    });
  }

  /**
   * Check if secret exists
   */
  async secretExists(secretName: string): Promise<boolean> {
    try {
      await this.client.getSecret(secretName);
      return true;
    } catch (error: any) {
      if (error.code === 'SecretNotFound' || error.statusCode === 404) {
        return false;
      }

      // Re-throw other errors (access denied, network, etc.)
      throw error;
    }
  }

  /**
   * Health check for Azure Key Vault connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to list secrets (doesn't require reading values)
      // This checks both connectivity and basic permissions
      const iterator = this.client.listPropertiesOfSecrets();
      await iterator.next();

      logger.debug('Azure Key Vault health check passed');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Azure Key Vault health check failed: ${message}`);
      return false;
    }
  }
}

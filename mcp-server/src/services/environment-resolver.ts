/**
 * Environment Resolver Service
 *
 * T053: Implement default environment resolver
 *
 * Reads DEFAULT_ENVIRONMENT from .env and allows explicit override.
 * Supports environment resolution from configuration with fallback to default.
 */

import { Environment, EnvironmentName } from '../types/entities.js';
import { loadEnvironmentConfig } from '../config/environment.js';

/**
 * Environment resolution service
 */
export class EnvironmentResolver {
  private environments: Map<EnvironmentName, Environment>;
  private defaultEnvironmentName: EnvironmentName;

  constructor(environments: Environment[], defaultEnvironmentName?: EnvironmentName) {
    // Build environment map
    this.environments = new Map();
    for (const env of environments) {
      this.environments.set(env.name, env);
    }

    // Determine default environment
    if (defaultEnvironmentName) {
      if (!this.environments.has(defaultEnvironmentName)) {
        throw new Error(`Default environment ${defaultEnvironmentName} not found in configuration`);
      }
      this.defaultEnvironmentName = defaultEnvironmentName;
    } else {
      // Find default from environment configurations
      const defaultEnv = environments.find(env => env.is_default);
      if (!defaultEnv) {
        throw new Error('No default environment found. Set is_default=true for one environment or specify DEFAULT_ENVIRONMENT');
      }
      this.defaultEnvironmentName = defaultEnv.name;
    }
  }

  /**
   * Resolve environment by name or use default
   */
  resolve(environmentName?: EnvironmentName): Environment {
    if (environmentName) {
      const env = this.environments.get(environmentName);
      if (!env) {
        throw new Error(
          `Environment ${environmentName} not found. Available: ${this.getAvailableEnvironments().join(', ')}`
        );
      }
      return env;
    }

    return this.getDefault();
  }

  /**
   * Get default environment
   */
  getDefault(): Environment {
    const env = this.environments.get(this.defaultEnvironmentName);
    if (!env) {
      throw new Error(`Default environment ${this.defaultEnvironmentName} not found`);
    }
    return env;
  }

  /**
   * Get environment by name
   */
  getByName(name: EnvironmentName): Environment | undefined {
    return this.environments.get(name);
  }

  /**
   * Get all available environment names
   */
  getAvailableEnvironments(): EnvironmentName[] {
    return Array.from(this.environments.keys());
  }

  /**
   * Check if environment exists
   */
  hasEnvironment(name: EnvironmentName): boolean {
    return this.environments.has(name);
  }

  /**
   * Get default environment name
   */
  getDefaultName(): EnvironmentName {
    return this.defaultEnvironmentName;
  }

  /**
   * Create resolver from environment configuration
   */
  static fromConfig(): EnvironmentResolver {
    const config = loadEnvironmentConfig();

    // Load environments from config
    // This would be loaded from environments.yaml in production
    // For now, we'll load from environment variables and configuration files

    const defaultEnvironmentName = (process.env.DEFAULT_ENVIRONMENT as EnvironmentName) || undefined;

    // In production, this would load from environments.yaml
    // For now, we create a minimal configuration
    const environments: Environment[] = [];

    // Load from environments.yaml or configuration
    // This is a placeholder - actual implementation would read from config files
    const envNames: EnvironmentName[] = ['Integration', 'UAT', 'UAT1', 'PROD'];

    for (const envName of envNames) {
      const isDefault = envName === defaultEnvironmentName;

      // Determine allowed release types based on environment
      const allowedReleaseTypes =
        envName === 'PROD'
          ? ['hotfix' as const]
          : ['regular' as const, 'hotfix' as const];

      environments.push({
        name: envName,
        display_name: envName,
        is_default: isDefault,
        allowed_release_types: allowedReleaseTypes,
        tenant_configurations: [], // Would be loaded from config
        git_base_url: process.env[`GIT_BASE_URL_${envName.toUpperCase()}`] || process.env.GIT_BASE_URL || '',
        jenkins_base_url: process.env[`JENKINS_BASE_URL_${envName.toUpperCase()}`] || process.env.JENKINS_BASE_URL || '',
        jira_base_url: process.env.JIRA_BASE_URL || '',
      });
    }

    return new EnvironmentResolver(environments, defaultEnvironmentName);
  }

  /**
   * Validate target environment for deployment
   */
  validateTargetEnvironment(
    targetEnvironment?: EnvironmentName
  ): { valid: boolean; error?: string; environment?: Environment } {
    try {
      const environment = this.resolve(targetEnvironment);
      return {
        valid: true,
        environment,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Singleton instance of environment resolver
 */
let environmentResolverInstance: EnvironmentResolver | null = null;

/**
 * Get or create environment resolver instance
 */
export function getEnvironmentResolver(): EnvironmentResolver {
  if (!environmentResolverInstance) {
    environmentResolverInstance = EnvironmentResolver.fromConfig();
  }
  return environmentResolverInstance;
}

/**
 * Reset environment resolver instance (for testing)
 */
export function resetEnvironmentResolver(): void {
  environmentResolverInstance = null;
}

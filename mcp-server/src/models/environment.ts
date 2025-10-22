/**
 * Environment Model
 *
 * T041: Environment entity type definition with tenant configuration
 *
 * Represents a deployment target environment (Integration, UAT, UAT1, PROD)
 * with configuration for allowed release types and tenant-specific Jenkins jobs.
 */

import {
  Environment,
  EnvironmentName,
  ReleaseType,
  TenantConfiguration,
} from '../types/entities.js';

/**
 * Environment model with validation and business logic
 */
export class EnvironmentModel {
  /**
   * Create a new Environment entity with validation
   */
  static create(params: {
    name: EnvironmentName;
    display_name: string;
    is_default: boolean;
    allowed_release_types: ReleaseType[];
    tenant_configurations: TenantConfiguration[];
    git_base_url: string;
    jenkins_base_url: string;
    jira_base_url: string;
  }): Environment {
    // Validate display name length
    if (params.display_name.length > 50) {
      throw new Error('Display name cannot exceed 50 characters');
    }

    // Validate allowed release types for PROD environment (Constitution II)
    if (params.name === 'PROD') {
      if (!params.allowed_release_types.includes('hotfix')) {
        throw new Error('PROD environment must allow hotfix releases');
      }

      if (params.allowed_release_types.includes('regular')) {
        throw new Error(
          'PROD environment cannot allow regular releases (Constitution II). Only hotfix releases are permitted'
        );
      }
    } else {
      // Non-PROD environments must allow regular releases
      if (!params.allowed_release_types.includes('regular')) {
        throw new Error(`${params.name} environment must allow regular releases`);
      }
    }

    // Validate at least one release type is allowed
    if (params.allowed_release_types.length === 0) {
      throw new Error('Environment must allow at least one release type');
    }

    // Validate tenant configurations
    if (params.tenant_configurations.length === 0) {
      throw new Error('Environment must have at least one tenant configuration');
    }

    // Validate unique tenant IDs within environment
    const tenantIds = params.tenant_configurations.map(tc => tc.tenant_id);
    const uniqueTenantIds = new Set(tenantIds);
    if (tenantIds.length !== uniqueTenantIds.size) {
      throw new Error('Tenant configurations must have unique tenant IDs');
    }

    // Validate all tenant configurations match this environment
    params.tenant_configurations.forEach(tc => {
      if (tc.environment_name !== params.name) {
        throw new Error(
          `Tenant configuration environment_name (${tc.environment_name}) does not match environment name (${params.name})`
        );
      }
    });

    // Validate URLs
    if (!EnvironmentModel.isValidUrl(params.git_base_url)) {
      throw new Error(`Invalid git_base_url: ${params.git_base_url}`);
    }

    if (!EnvironmentModel.isValidUrl(params.jenkins_base_url)) {
      throw new Error(`Invalid jenkins_base_url: ${params.jenkins_base_url}`);
    }

    if (!EnvironmentModel.isValidUrl(params.jira_base_url)) {
      throw new Error(`Invalid jira_base_url: ${params.jira_base_url}`);
    }

    return params;
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if environment allows a specific release type
   */
  static allowsReleaseType(
    environment: Environment,
    releaseType: ReleaseType
  ): boolean {
    return environment.allowed_release_types.includes(releaseType);
  }

  /**
   * Get tenant configuration for a specific tenant
   */
  static getTenantConfiguration(
    environment: Environment,
    tenantId: string
  ): TenantConfiguration | undefined {
    return environment.tenant_configurations.find(
      tc => tc.tenant_id === tenantId
    );
  }

  /**
   * Get all tenant IDs for this environment
   */
  static getTenantIds(environment: Environment): string[] {
    return environment.tenant_configurations.map(tc => tc.tenant_id);
  }

  /**
   * Add tenant configuration
   */
  static addTenantConfiguration(
    environment: Environment,
    tenantConfig: TenantConfiguration
  ): Environment {
    // Validate tenant config environment matches
    if (tenantConfig.environment_name !== environment.name) {
      throw new Error(
        `Tenant configuration environment_name (${tenantConfig.environment_name}) does not match environment name (${environment.name})`
      );
    }

    // Check if tenant already exists
    if (EnvironmentModel.getTenantConfiguration(environment, tenantConfig.tenant_id)) {
      throw new Error(
        `Tenant configuration for ${tenantConfig.tenant_id} already exists in ${environment.name}`
      );
    }

    // Validate tenant ID format
    if (!EnvironmentModel.isValidTenantId(tenantConfig.tenant_id)) {
      throw new Error(
        `Invalid tenant_id format: ${tenantConfig.tenant_id}. Must be alphanumeric, lowercase, with hyphens allowed`
      );
    }

    return {
      ...environment,
      tenant_configurations: [...environment.tenant_configurations, tenantConfig],
    };
  }

  /**
   * Validate tenant ID format (alphanumeric, lowercase, hyphens)
   */
  static isValidTenantId(tenantId: string): boolean {
    return /^[a-z0-9-]+$/.test(tenantId);
  }

  /**
   * Remove tenant configuration
   */
  static removeTenantConfiguration(
    environment: Environment,
    tenantId: string
  ): Environment {
    const filtered = environment.tenant_configurations.filter(
      tc => tc.tenant_id !== tenantId
    );

    if (filtered.length === environment.tenant_configurations.length) {
      throw new Error(`Tenant configuration for ${tenantId} not found`);
    }

    if (filtered.length === 0) {
      throw new Error('Cannot remove last tenant configuration');
    }

    return {
      ...environment,
      tenant_configurations: filtered,
    };
  }

  /**
   * Check if environment is PROD
   */
  static isProd(environment: Environment): boolean {
    return environment.name === 'PROD';
  }

  /**
   * Validate tenant exists in environment
   */
  static hasTenant(environment: Environment, tenantId: string): boolean {
    return EnvironmentModel.getTenantConfiguration(environment, tenantId) !== undefined;
  }

  /**
   * Validate all tenants exist in environment
   */
  static hasAllTenants(environment: Environment, tenantIds: string[]): boolean {
    return tenantIds.every(tenantId => EnvironmentModel.hasTenant(environment, tenantId));
  }
}

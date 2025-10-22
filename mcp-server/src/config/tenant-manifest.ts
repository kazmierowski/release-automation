import { readFileSync } from 'fs';
import YAML from 'yaml';
import { logger } from '../utils/logger.js';

/**
 * Tenant configuration structure
 */
export interface Tenant {
  id: string;
  name: string;
  description?: string;
  jenkins_jobs: {
    [environment: string]: string; // environment -> Jenkins job name
  };
  contact_email?: string;
  active: boolean;
}

/**
 * Environment configuration structure
 */
export interface Environment {
  name: string;
  allowed_release_types: Array<'regular' | 'hotfix'>;
  description?: string;
  restrictions?: string[];
  default?: boolean;
}

/**
 * Tenant manifest structure
 */
export interface TenantManifest {
  tenants: Tenant[];
}

/**
 * Environment manifest structure
 */
export interface EnvironmentManifest {
  environments: Environment[];
}

/**
 * Load and parse tenant manifest from YAML file
 *
 * @param filePath - Path to tenants.yaml file
 * @returns {TenantManifest} Parsed tenant manifest
 * @throws {Error} If file cannot be read or parsed
 */
export function loadTenantManifest(filePath: string): TenantManifest {
  try {
    logger.debug(`Loading tenant manifest from: ${filePath}`);

    const fileContent = readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(fileContent) as TenantManifest;

    // Validate structure
    if (!parsed || !Array.isArray(parsed.tenants)) {
      throw new Error('Invalid tenant manifest: missing "tenants" array');
    }

    // Validate each tenant
    for (const tenant of parsed.tenants) {
      if (!tenant.id || !tenant.name || !tenant.jenkins_jobs) {
        throw new Error(
          `Invalid tenant configuration: ${JSON.stringify(tenant)}`
        );
      }
    }

    logger.info(`Loaded ${parsed.tenants.length} tenants from manifest`);
    return parsed;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to load tenant manifest: ${errorMessage}`);
    throw new Error(`Failed to load tenant manifest from ${filePath}: ${errorMessage}`);
  }
}

/**
 * Load and parse environment manifest from YAML file
 *
 * @param filePath - Path to environments.yaml file
 * @returns {EnvironmentManifest} Parsed environment manifest
 * @throws {Error} If file cannot be read or parsed
 */
export function loadEnvironmentManifest(filePath: string): EnvironmentManifest {
  try {
    logger.debug(`Loading environment manifest from: ${filePath}`);

    const fileContent = readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(fileContent) as EnvironmentManifest;

    // Validate structure
    if (!parsed || !Array.isArray(parsed.environments)) {
      throw new Error(
        'Invalid environment manifest: missing "environments" array'
      );
    }

    // Validate each environment
    for (const env of parsed.environments) {
      if (
        !env.name ||
        !Array.isArray(env.allowed_release_types) ||
        env.allowed_release_types.length === 0
      ) {
        throw new Error(
          `Invalid environment configuration: ${JSON.stringify(env)}`
        );
      }
    }

    logger.info(
      `Loaded ${parsed.environments.length} environments from manifest`
    );
    return parsed;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to load environment manifest: ${errorMessage}`);
    throw new Error(
      `Failed to load environment manifest from ${filePath}: ${errorMessage}`
    );
  }
}

/**
 * Get tenant by ID
 *
 * @param manifest - Tenant manifest
 * @param tenantId - Tenant identifier
 * @returns {Tenant | undefined} Tenant configuration or undefined if not found
 */
export function getTenantById(
  manifest: TenantManifest,
  tenantId: string
): Tenant | undefined {
  return manifest.tenants.find((t) => t.id === tenantId);
}

/**
 * Get all active tenants
 *
 * @param manifest - Tenant manifest
 * @returns {Tenant[]} Array of active tenants
 */
export function getActiveTenants(manifest: TenantManifest): Tenant[] {
  return manifest.tenants.filter((t) => t.active);
}

/**
 * Get Jenkins job name for specific tenant and environment
 *
 * @param tenant - Tenant configuration
 * @param environment - Environment name
 * @returns {string | undefined} Jenkins job name or undefined if not configured
 */
export function getJenkinsJobName(
  tenant: Tenant,
  environment: string
): string | undefined {
  return tenant.jenkins_jobs[environment];
}

/**
 * Get environment by name
 *
 * @param manifest - Environment manifest
 * @param envName - Environment name
 * @returns {Environment | undefined} Environment configuration or undefined if not found
 */
export function getEnvironmentByName(
  manifest: EnvironmentManifest,
  envName: string
): Environment | undefined {
  return manifest.environments.find((e) => e.name === envName);
}

/**
 * Get default environment
 *
 * @param manifest - Environment manifest
 * @returns {Environment | undefined} Default environment or undefined if not found
 */
export function getDefaultEnvironment(
  manifest: EnvironmentManifest
): Environment | undefined {
  return manifest.environments.find((e) => e.default === true);
}

/**
 * Validate if release type is allowed for environment
 *
 * @param environment - Environment configuration
 * @param releaseType - Release type ('regular' or 'hotfix')
 * @returns {boolean} True if release type is allowed
 */
export function isReleaseTypeAllowed(
  environment: Environment,
  releaseType: 'regular' | 'hotfix'
): boolean {
  return environment.allowed_release_types.includes(releaseType);
}

/**
 * Validate tenant configuration for environment deployment
 *
 * @param tenant - Tenant configuration
 * @param environment - Environment name
 * @throws {Error} If tenant configuration is invalid for deployment
 */
export function validateTenantForDeployment(
  tenant: Tenant,
  environment: string
): void {
  if (!tenant.active) {
    throw new Error(
      `Tenant ${tenant.id} is not active - deployment blocked`
    );
  }

  const jobName = getJenkinsJobName(tenant, environment);
  if (!jobName) {
    throw new Error(
      `No Jenkins job configured for tenant ${tenant.id} in environment ${environment}`
    );
  }
}

/**
 * Validate environment for release type
 *
 * @param envManifest - Environment manifest
 * @param envName - Environment name
 * @param releaseType - Release type
 * @throws {Error} If release type not allowed for environment
 */
export function validateEnvironmentForRelease(
  envManifest: EnvironmentManifest,
  envName: string,
  releaseType: 'regular' | 'hotfix'
): void {
  const environment = getEnvironmentByName(envManifest, envName);

  if (!environment) {
    throw new Error(`Environment ${envName} not found in manifest`);
  }

  if (!isReleaseTypeAllowed(environment, releaseType)) {
    const allowedTypes = environment.allowed_release_types.join(', ');
    throw new Error(
      `${releaseType} releases are not allowed for environment ${envName}. Allowed types: ${allowedTypes}`
    );
  }

  logger.debug(
    `Environment ${envName} validated for ${releaseType} release`
  );
}

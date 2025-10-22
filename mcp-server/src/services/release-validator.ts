/**
 * Release Validator Service
 *
 * T052: Implement release type environment validator
 *
 * Enforces Constitution II rules:
 * - Regular releases CANNOT deploy to PROD
 * - Hotfix releases CAN deploy to any environment including PROD
 */

import {
  ReleaseType,
  EnvironmentName,
  Environment,
  validateReleaseTypeForEnvironment,
} from '../types/entities.js';
import { EnvironmentModel } from '../models/environment.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Release validation service
 */
export class ReleaseValidator {
  /**
   * Validate release type is allowed for target environment
   *
   * Constitution II rules:
   * - Regular releases → Integration/UAT/UAT1 only (no PROD)
   * - Hotfix releases → Any environment including PROD
   */
  static validateReleaseType(
    releaseType: ReleaseType,
    targetEnvironment: EnvironmentName
  ): ValidationResult {
    return validateReleaseTypeForEnvironment(releaseType, targetEnvironment);
  }

  /**
   * Validate release type against environment configuration
   *
   * Checks if the environment's allowed_release_types includes the release type
   */
  static validateReleaseTypeForEnvironmentConfig(
    releaseType: ReleaseType,
    environment: Environment
  ): ValidationResult {
    // First check Constitution rules
    const constitutionValidation = ReleaseValidator.validateReleaseType(
      releaseType,
      environment.name
    );

    if (!constitutionValidation.valid) {
      return constitutionValidation;
    }

    // Then check environment configuration
    if (!EnvironmentModel.allowsReleaseType(environment, releaseType)) {
      return {
        valid: false,
        error: `Environment ${environment.name} does not allow ${releaseType} releases. Allowed types: ${environment.allowed_release_types.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate tenants exist in environment
   */
  static validateTenants(
    environment: Environment,
    tenantIds: string[]
  ): ValidationResult {
    if (tenantIds.length === 0) {
      return {
        valid: false,
        error: 'Release must have at least one tenant',
      };
    }

    const missingTenants: string[] = [];

    for (const tenantId of tenantIds) {
      if (!EnvironmentModel.hasTenant(environment, tenantId)) {
        missingTenants.push(tenantId);
      }
    }

    if (missingTenants.length > 0) {
      return {
        valid: false,
        error: `Tenants not found in ${environment.name} environment: ${missingTenants.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate release version format
   */
  static validateVersion(
    version: string,
    releaseType: ReleaseType
  ): ValidationResult {
    const expectedFormat = releaseType === 'regular'
      ? 'vX.Y.Z (semantic versioning)'
      : 'hotfix/vX.Y.Z';

    if (releaseType === 'regular') {
      if (!/^v\d+\.\d+\.\d+$/.test(version)) {
        return {
          valid: false,
          error: `Invalid version format for regular release: ${version}. Expected format: ${expectedFormat}`,
        };
      }
    } else {
      if (!/^hotfix\/v\d+\.\d+\.\d+$/.test(version)) {
        return {
          valid: false,
          error: `Invalid version format for hotfix release: ${version}. Expected format: ${expectedFormat}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate JIRA ticket IDs format
   */
  static validateTicketIds(ticketIds: string[]): ValidationResult {
    if (ticketIds.length === 0) {
      return {
        valid: false,
        error: 'Release must have at least one ticket',
      };
    }

    const invalidTickets: string[] = [];

    for (const ticketId of ticketIds) {
      if (!/^[A-Z]+-\d+$/.test(ticketId)) {
        invalidTickets.push(ticketId);
      }
    }

    if (invalidTickets.length > 0) {
      return {
        valid: false,
        error: `Invalid JIRA ticket ID format: ${invalidTickets.join(', ')}. Expected format: PROJ-123`,
      };
    }

    return { valid: true };
  }

  /**
   * Comprehensive release validation
   */
  static validateRelease(params: {
    version: string;
    releaseType: ReleaseType;
    targetEnvironment: Environment;
    ticketIds: string[];
    tenantIds: string[];
  }): ValidationResult {
    // Validate version format
    const versionValidation = ReleaseValidator.validateVersion(
      params.version,
      params.releaseType
    );
    if (!versionValidation.valid) {
      return versionValidation;
    }

    // Validate release type for environment
    const releaseTypeValidation = ReleaseValidator.validateReleaseTypeForEnvironmentConfig(
      params.releaseType,
      params.targetEnvironment
    );
    if (!releaseTypeValidation.valid) {
      return releaseTypeValidation;
    }

    // Validate ticket IDs
    const ticketsValidation = ReleaseValidator.validateTicketIds(params.ticketIds);
    if (!ticketsValidation.valid) {
      return ticketsValidation;
    }

    // Validate tenants
    const tenantsValidation = ReleaseValidator.validateTenants(
      params.targetEnvironment,
      params.tenantIds
    );
    if (!tenantsValidation.valid) {
      return tenantsValidation;
    }

    return { valid: true };
  }
}

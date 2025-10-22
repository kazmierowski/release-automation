/**
 * Trigger Release Deployment MCP Tool
 *
 * T051: Implement trigger_release_deployment orchestration MCP tool
 *
 * Main orchestration tool that validates environment, release type restrictions,
 * and initiates the release workflow. Entry point for n8n workflows.
 */

import { Environment, EnvironmentName, ReleaseType, Release } from '../types/entities.js';
import { ReleaseModel } from '../models/release.js';
import { ReleaseValidator } from '../services/release-validator.js';
import { getEnvironmentResolver } from '../services/environment-resolver.js';
import { getAuditLogger } from '../services/audit-logger.js';
import { AuditEventModel } from '../models/audit-event.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for trigger_release_deployment tool
 */
export const TriggerReleaseInputSchema = z.object({
  release_version: z.string().describe('Release version (e.g., "v1.2.0" or "hotfix/v1.1.1")'),
  release_type: z.enum(['regular', 'hotfix']).describe('Release type'),
  target_environment: z.enum(['Integration', 'UAT', 'UAT1', 'PROD']).optional().describe('Target environment (uses default if not provided)'),
  ticket_ids: z.array(z.string()).describe('JIRA ticket IDs to include in release'),
  tenant_ids: z.array(z.string()).optional().describe('Tenant IDs to deploy (uses all tenants if not provided)'),
  created_by: z.string().describe('User or system triggering the release'),
});

export type TriggerReleaseInput = z.infer<typeof TriggerReleaseInputSchema>;

/**
 * Output schema for trigger_release_deployment tool
 */
export const TriggerReleaseOutputSchema = z.object({
  release_id: z.string(),
  release_version: z.string(),
  release_type: z.string(),
  target_environment: z.string(),
  ticket_ids: z.array(z.string()),
  tenant_ids: z.array(z.string()),
  validation: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
  }),
  created_at: z.string(),
});

export type TriggerReleaseOutput = z.infer<typeof TriggerReleaseOutputSchema>;

/**
 * Trigger release deployment
 */
export async function triggerReleaseDeployment(
  input: TriggerReleaseInput
): Promise<TriggerReleaseOutput> {
  const startTime = Date.now();

  try {
    logger.info('Triggering release deployment', {
      release_version: input.release_version,
      release_type: input.release_type,
      target_environment: input.target_environment,
      ticket_count: input.ticket_ids.length,
    });

    const validationErrors: string[] = [];

    // Resolve target environment
    const environmentResolver = getEnvironmentResolver();
    const environmentValidation = environmentResolver.validateTargetEnvironment(
      input.target_environment
    );

    if (!environmentValidation.valid) {
      validationErrors.push(environmentValidation.error!);

      logger.error('Environment validation failed', {
        error: environmentValidation.error,
      });

      return createErrorOutput(input, validationErrors);
    }

    const environment = environmentValidation.environment!;

    // Determine tenant IDs
    const tenantIds = input.tenant_ids || environment.tenant_configurations.map(tc => tc.tenant_id);

    if (tenantIds.length === 0) {
      validationErrors.push('No tenants specified or configured for environment');
    }

    // Validate release
    const releaseValidation = ReleaseValidator.validateRelease({
      version: input.release_version,
      releaseType: input.release_type,
      targetEnvironment: environment,
      ticketIds: input.ticket_ids,
      tenantIds,
    });

    if (!releaseValidation.valid) {
      validationErrors.push(releaseValidation.error!);
    }

    // If validation failed, return errors
    if (validationErrors.length > 0) {
      logger.error('Release validation failed', {
        errors: validationErrors,
      });

      return createErrorOutput(input, validationErrors);
    }

    // Create release entity
    const release = ReleaseModel.create({
      version: input.release_version,
      release_type: input.release_type,
      target_environment: environment.name,
      ticket_ids: input.ticket_ids,
      tenant_ids: tenantIds,
      created_by: input.created_by,
    });

    // Log release created audit event
    const auditLogger = await getAuditLogger();
    const auditEvent = AuditEventModel.createReleaseCreated(
      release.id,
      input.created_by,
      {
        version: release.version,
        release_type: release.release_type,
        target_environment: release.target_environment,
        ticket_count: release.ticket_ids.length,
        tenant_count: release.tenant_ids.length,
      }
    );
    await auditLogger.log(auditEvent);

    const output: TriggerReleaseOutput = {
      release_id: release.id,
      release_version: release.version,
      release_type: release.release_type,
      target_environment: release.target_environment,
      ticket_ids: release.ticket_ids,
      tenant_ids: release.tenant_ids,
      validation: {
        valid: true,
        errors: [],
      },
      created_at: release.created_at,
    };

    logger.info('Release deployment triggered successfully', {
      release_id: release.id,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to trigger release deployment', {
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Create error output for validation failures
 */
function createErrorOutput(
  input: TriggerReleaseInput,
  errors: string[]
): TriggerReleaseOutput {
  const environmentResolver = getEnvironmentResolver();
  const environment = input.target_environment || environmentResolver.getDefaultName();
  const tenantIds = input.tenant_ids || [];

  return {
    release_id: '',
    release_version: input.release_version,
    release_type: input.release_type,
    target_environment: environment,
    ticket_ids: input.ticket_ids,
    tenant_ids: tenantIds,
    validation: {
      valid: false,
      errors,
    },
    created_at: new Date().toISOString(),
  };
}

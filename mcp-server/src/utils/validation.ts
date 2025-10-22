import { z } from 'zod';
import { logger } from './logger.js';
import { buildMCPError } from './mcp-errors.js';

/**
 * Zod Schema Validation Utility
 *
 * Provides schema validation for MCP tool inputs/outputs using Zod
 * Ensures type safety and contract compliance
 */

/**
 * Common validation schemas
 */

// UUID v4 pattern
export const uuidSchema = z.string().uuid();

// JIRA ticket ID pattern (e.g., "PROJ-123")
export const jiraTicketIdSchema = z
  .string()
  .regex(/^[A-Z]+-\d+$/, 'Invalid JIRA ticket ID format (expected: PROJ-123)');

// Semantic version pattern (e.g., "v1.2.0")
export const semanticVersionSchema = z
  .string()
  .regex(
    /^v\d+\.\d+\.\d+$/,
    'Invalid semantic version format (expected: v1.2.0)'
  );

// Release version pattern (includes hotfix)
export const releaseVersionSchema = z
  .string()
  .regex(
    /^(v\d+\.\d+\.\d+|hotfix\/v\d+\.\d+\.\d+)$/,
    'Invalid release version format (expected: v1.2.0 or hotfix/v1.1.1)'
  );

// Email address
export const emailSchema = z.string().email('Invalid email address');

// URL
export const urlSchema = z.string().url('Invalid URL');

// ISO 8601 timestamp
export const iso8601Schema = z
  .string()
  .datetime({ message: 'Invalid ISO 8601 timestamp' });

// Environment enum
export const environmentSchema = z.enum(['Integration', 'UAT', 'UAT1', 'PROD'], {
  errorMap: () => ({
    message: 'Invalid environment (must be Integration, UAT, UAT1, or PROD)',
  }),
});

// Release type enum
export const releaseTypeSchema = z.enum(['regular', 'hotfix'], {
  errorMap: () => ({ message: 'Invalid release type (must be regular or hotfix)' }),
});

// Merge strategy enum
export const mergeStrategySchema = z.enum(['squash', 'merge'], {
  errorMap: () => ({ message: 'Invalid merge strategy (must be squash or merge)' }),
});

/**
 * MCP Tool Input Schemas
 */

// jira_get_release_tickets
export const jiraGetReleaseTicketsInputSchema = z.object({
  release_version: releaseVersionSchema,
  include_pr_details: z.boolean().default(true).optional(),
});

// git_check_pr_approvals
export const gitCheckPRApprovalsInputSchema = z.object({
  pr_id: z.string().min(1, 'PR ID is required'),
  repository: z.string().min(1, 'Repository is required'),
  min_approvals: z.number().int().min(1).default(2).optional(),
});

// git_merge_tickets_to_development
export const gitMergeTicketsInputSchema = z.object({
  tickets: z
    .array(
      z.object({
        ticket_id: jiraTicketIdSchema,
        pr_id: z.string().min(1),
        summary: z.string().min(1),
      })
    )
    .min(1, 'At least one ticket required'),
  target_branch: z.string().default('development').optional(),
});

// git_create_release_branch
export const gitCreateReleaseBranchInputSchema = z.object({
  release_version: semanticVersionSchema,
  source_branch: z.string().optional(),
  release_type: releaseTypeSchema.default('regular').optional(),
});

// jenkins_trigger_deployment
export const jenkinsTriggerDeploymentInputSchema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  environment: environmentSchema,
  release_version: z.string().min(1, 'Release version is required'),
  release_type: releaseTypeSchema,
});

// jenkins_get_job_status
export const jenkinsGetJobStatusInputSchema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  environment: z.string().min(1, 'Environment is required'),
  build_number: z.number().int().positive('Build number must be positive'),
});

// jenkins_rollback_tenant
export const jenkinsRollbackTenantInputSchema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  environment: z.string().min(1, 'Environment is required'),
  target_version: z.string().min(1, 'Target version is required'),
});

// jira_update_ticket_status
export const jiraUpdateTicketStatusInputSchema = z.object({
  ticket_ids: z.array(jiraTicketIdSchema).min(1, 'At least one ticket ID required'),
  status: z.string().min(1, 'Status is required'),
  comment: z.string().optional(),
});

// teams_notify_pr_owner
export const teamsNotifyPROwnerInputSchema = z.object({
  pr_owner_email: emailSchema,
  ticket_id: jiraTicketIdSchema,
  pr_url: urlSchema,
  conflict_details: z.string().min(1, 'Conflict details required'),
});

// teams_announce_deployment
export const teamsAnnounceDeploymentInputSchema = z.object({
  release_version: z.string().min(1, 'Release version is required'),
  environment: z.string().min(1, 'Environment is required'),
  status: z.enum(['success', 'partial', 'failed']),
  summary: z.string().min(1, 'Summary is required'),
});

// trigger_release_deployment
export const triggerReleaseDeploymentInputSchema = z.object({
  release_version: semanticVersionSchema,
  environment: environmentSchema.optional(),
  release_type: releaseTypeSchema.default('regular').optional(),
});

/**
 * Validate input against Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Input data to validate
 * @param toolName - MCP tool name (for error logging)
 * @returns Validated and parsed data
 * @throws MCP error response if validation fails
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  toolName: string
): T {
  try {
    const validated = schema.parse(data);
    logger.debug(`Validation passed for ${toolName}`);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));

      logger.error(`Validation failed for ${toolName}`, { errors });

      throw buildMCPError('ERR_VALIDATION_FAILED', `Validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`, {
        tool: toolName,
        validationErrors: errors,
      });
    }

    throw error;
  }
}

/**
 * Safe parse input without throwing errors
 *
 * @param schema - Zod schema to validate against
 * @param data - Input data to validate
 * @returns {success: true, data: T} | {success: false, error: ZodError}
 */
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Validate Constitution II: GitFlow compliance
 *
 * Ensures:
 * - Regular releases CANNOT deploy to PROD
 * - Only hotfix releases can deploy to PROD
 *
 * @param releaseType - Release type
 * @param environment - Target environment
 * @throws MCP error if validation fails
 */
export function validateGitFlowCompliance(
  releaseType: 'regular' | 'hotfix',
  environment: string
): void {
  if (releaseType === 'regular' && environment === 'PROD') {
    logger.error('GitFlow violation: Regular release to PROD blocked', {
      releaseType,
      environment,
    });

    throw buildMCPError(
      'ERR_ENV_RELEASE_TYPE_MISMATCH',
      'Regular releases are not allowed for PROD environment. Only hotfix releases can deploy to PROD (Constitution II)',
      { releaseType, environment }
    );
  }

  logger.debug('GitFlow compliance validated', { releaseType, environment });
}

/**
 * Validate squash commit message format: "[TICKET-ID] Summary"
 *
 * @param message - Commit message to validate
 * @param ticketId - Expected JIRA ticket ID
 * @returns True if valid
 */
export function validateSquashCommitMessage(
  message: string,
  ticketId: string
): boolean {
  const pattern = new RegExp(`^\\[${ticketId}\\]\\s+.+$`);
  return pattern.test(message);
}

/**
 * Build squash commit message in GitFlow format
 *
 * @param ticketId - JIRA ticket ID
 * @param summary - Ticket summary
 * @returns Formatted commit message: "[TICKET-ID] Summary"
 */
export function buildSquashCommitMessage(ticketId: string, summary: string): string {
  return `[${ticketId}] ${summary}`;
}

/**
 * Validate tenant configuration for deployment
 *
 * Ensures tenant is active and has Jenkins job configured for environment
 *
 * @param tenantId - Tenant identifier
 * @param environment - Target environment
 * @param tenantManifest - Tenant manifest data
 * @throws MCP error if validation fails
 */
export function validateTenantDeployment(
  tenantId: string,
  environment: string,
  tenantManifest: {
    tenants: Array<{
      id: string;
      active: boolean;
      jenkins_jobs: Record<string, string>;
    }>;
  }
): void {
  const tenant = tenantManifest.tenants.find((t) => t.id === tenantId);

  if (!tenant) {
    throw buildMCPError('ERR_TENANT_NOT_FOUND', `Tenant ${tenantId} not found in manifest`, {
      tenantId,
    });
  }

  if (!tenant.active) {
    throw buildMCPError('ERR_TENANT_INACTIVE', `Tenant ${tenantId} is not active for deployments`, {
      tenantId,
    });
  }

  if (!tenant.jenkins_jobs[environment]) {
    throw buildMCPError(
      'ERR_JENKINS_JOB_NOT_FOUND',
      `No Jenkins job configured for tenant ${tenantId} in environment ${environment}`,
      { tenantId, environment }
    );
  }

  logger.debug('Tenant deployment validated', { tenantId, environment });
}

/**
 * Validate minimum PR approvals (Constitution II)
 *
 * @param approvalCount - Current approval count
 * @param minRequired - Minimum required approvals (default: 2)
 * @throws MCP error if validation fails
 */
export function validatePRApprovals(
  approvalCount: number,
  minRequired: number = 2
): void {
  if (approvalCount < minRequired) {
    throw buildMCPError(
      'ERR_PR_NOT_APPROVED',
      `Pull request has ${approvalCount} approvals but requires ${minRequired}`,
      { approvalCount, minRequired }
    );
  }

  logger.debug('PR approvals validated', { approvalCount, minRequired });
}

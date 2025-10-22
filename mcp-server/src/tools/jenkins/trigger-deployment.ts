/**
 * Jenkins Trigger Deployment MCP Tool
 *
 * T047: Implement jenkins_trigger_deployment MCP tool
 *
 * Triggers Jenkins deployment jobs for all specified tenants in parallel.
 * Validates environment and passes tenant-specific parameters to Jenkins jobs.
 * Returns queue IDs for status polling.
 */

import Jenkins from 'jenkins';
import { EnvironmentName, TenantConfiguration } from '../../types/entities.js';
import { DeploymentModel } from '../../models/deployment.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for jenkins_trigger_deployment tool
 */
export const TriggerDeploymentInputSchema = z.object({
  tenant_ids: z.array(z.string()).describe('Tenant IDs to deploy'),
  release_branch: z.string().describe('Release branch name'),
  target_environment: z.enum(['Integration', 'UAT', 'UAT1', 'PROD']).describe('Target environment'),
  tenant_configurations: z.array(
    z.object({
      tenant_id: z.string(),
      jenkins_job_name: z.string(),
      jenkins_job_parameters: z.record(z.any()).optional(),
    })
  ).describe('Tenant-specific Jenkins job configurations'),
});

export type TriggerDeploymentInput = z.infer<typeof TriggerDeploymentInputSchema>;

/**
 * Output schema for jenkins_trigger_deployment tool
 */
export const TriggerDeploymentOutputSchema = z.object({
  triggered: z.array(
    z.object({
      tenant_id: z.string(),
      jenkins_queue_id: z.number(),
      jenkins_job_name: z.string(),
    })
  ),
  failed: z.array(
    z.object({
      tenant_id: z.string(),
      error: z.string(),
    })
  ),
});

export type TriggerDeploymentOutput = z.infer<typeof TriggerDeploymentOutputSchema>;

/**
 * Trigger deployment for tenants
 */
export async function triggerDeployment(
  input: TriggerDeploymentInput,
  jenkinsClient: Jenkins,
  releaseId?: string
): Promise<TriggerDeploymentOutput> {
  const startTime = Date.now();
  const actor = 'system';

  const triggered: TriggerDeploymentOutput['triggered'] = [];
  const failed: TriggerDeploymentOutput['failed'] = [];

  try {
    logger.info('Triggering deployments', {
      tenant_count: input.tenant_ids.length,
      environment: input.target_environment,
      release_branch: input.release_branch,
    });

    // Trigger jobs in parallel for all tenants
    const triggerPromises = input.tenant_ids.map(async (tenantId) => {
      try {
        // Find tenant configuration
        const config = input.tenant_configurations.find(c => c.tenant_id === tenantId);

        if (!config) {
          throw new Error(`Configuration not found for tenant ${tenantId}`);
        }

        logger.debug('Triggering Jenkins job', {
          tenant_id: tenantId,
          job_name: config.jenkins_job_name,
        });

        // Build job parameters
        const parameters = {
          RELEASE_BRANCH: input.release_branch,
          ENVIRONMENT: input.target_environment,
          TENANT_ID: tenantId,
          ...(config.jenkins_job_parameters || {}),
        };

        // Trigger Jenkins job
        const queueId = await jenkinsClient.job.build({
          name: config.jenkins_job_name,
          parameters,
        });

        triggered.push({
          tenant_id: tenantId,
          jenkins_queue_id: queueId,
          jenkins_job_name: config.jenkins_job_name,
        });

        // Log deployment triggered audit event
        if (releaseId) {
          const auditLogger = await getAuditLogger();
          const auditEvent = AuditEventModel.createDeploymentTriggered(
            releaseId,
            actor,
            {
              deployment_id: crypto.randomUUID(),
              tenant_id: tenantId,
              environment_name: input.target_environment,
              jenkins_job_name: config.jenkins_job_name,
              jenkins_queue_id: queueId,
            }
          );
          await auditLogger.log(auditEvent);
        }

        logger.info('Jenkins job triggered', {
          tenant_id: tenantId,
          queue_id: queueId,
          job_name: config.jenkins_job_name,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({
          tenant_id: tenantId,
          error: errorMessage,
        });

        logger.error('Failed to trigger Jenkins job', {
          tenant_id: tenantId,
          error: errorMessage,
        });
      }
    });

    await Promise.all(triggerPromises);

    const output: TriggerDeploymentOutput = {
      triggered,
      failed,
    };

    logger.info('Deployment trigger completed', {
      triggered_count: triggered.length,
      failed_count: failed.length,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to trigger deployments', {
      error: errorMessage,
    });

    throw error;
  }
}

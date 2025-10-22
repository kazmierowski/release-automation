/**
 * Jenkins Get Job Status MCP Tool
 *
 * T048: Implement jenkins_get_job_status MCP tool
 *
 * Polls Jenkins job status for multiple tenants.
 * Extracts cache_clear_status from Jenkins job metadata.
 * Returns per-tenant status, duration, and error messages.
 */

import Jenkins from 'jenkins';
import { DeploymentStatus, CacheClearStatus } from '../../types/entities.js';
import { DeploymentModel } from '../../models/deployment.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for jenkins_get_job_status tool
 */
export const GetJobStatusInputSchema = z.object({
  jobs: z.array(
    z.object({
      tenant_id: z.string(),
      jenkins_queue_id: z.number(),
      jenkins_job_name: z.string(),
    })
  ).describe('Jenkins jobs to check status for'),
});

export type GetJobStatusInput = z.infer<typeof GetJobStatusInputSchema>;

/**
 * Output schema for jenkins_get_job_status tool
 */
export const GetJobStatusOutputSchema = z.object({
  statuses: z.array(
    z.object({
      tenant_id: z.string(),
      status: z.enum(['queued', 'running', 'success', 'failed', 'cancelled', 'timeout']),
      jenkins_build_number: z.number().optional(),
      jenkins_job_url: z.string().optional(),
      duration_ms: z.number().optional(),
      cache_clear_status: z.enum(['cleared', 'skipped', 'failed', 'in_progress']).optional(),
      error_message: z.string().optional(),
      console_output_tail: z.string().optional(),
    })
  ),
});

export type GetJobStatusOutput = z.infer<typeof GetJobStatusOutputSchema>;

/**
 * Get job status for deployments
 */
export async function getJobStatus(
  input: GetJobStatusInput,
  jenkinsClient: Jenkins,
  releaseId?: string
): Promise<GetJobStatusOutput> {
  const startTime = Date.now();
  const actor = 'system';

  try {
    logger.info('Checking Jenkins job statuses', {
      job_count: input.jobs.length,
    });

    // Check status for all jobs in parallel
    const statusPromises = input.jobs.map(async (job) => {
      try {
        logger.debug('Checking job status', {
          tenant_id: job.tenant_id,
          queue_id: job.jenkins_queue_id,
        });

        // Get queue item to find build number
        const queueItem = await jenkinsClient.queue.item(job.jenkins_queue_id);

        // If still in queue
        if (!queueItem.executable) {
          return {
            tenant_id: job.tenant_id,
            status: 'queued' as DeploymentStatus,
          };
        }

        const buildNumber = queueItem.executable.number;
        const jobName = job.jenkins_job_name;

        // Get build information
        const build = await jenkinsClient.build.get(jobName, buildNumber);

        // Determine status
        let status: DeploymentStatus;
        if (build.building) {
          status = 'running';
        } else if (build.result === 'SUCCESS') {
          status = 'success';
        } else if (build.result === 'FAILURE') {
          status = 'failed';
        } else if (build.result === 'ABORTED') {
          status = 'cancelled';
        } else {
          status = 'timeout';
        }

        // Extract cache clear status from build metadata
        // This would typically come from environment variables set by Jenkins job
        const cacheClearStatus = extractCacheClearStatus(build);

        // Get console output tail for errors
        let consoleOutputTail: string | undefined;
        let errorMessage: string | undefined;

        if (status === 'failed') {
          try {
            const log = await jenkinsClient.build.log(jobName, buildNumber);
            const lines = log.split('\n');
            consoleOutputTail = lines.slice(-50).join('\n');

            // Extract error message from last few lines
            const errorLines = lines.slice(-10).filter(line =>
              line.toLowerCase().includes('error') ||
              line.toLowerCase().includes('failed')
            );
            errorMessage = errorLines.join('\n').substring(0, 1000);
          } catch (logError) {
            logger.warn('Failed to fetch console log', {
              tenant_id: job.tenant_id,
              error: logError,
            });
          }
        }

        const jobUrl = build.url;

        // Log deployment completed/failed audit event
        if (releaseId && (status === 'success' || status === 'failed')) {
          const auditLogger = await getAuditLogger();

          if (status === 'success') {
            const auditEvent = AuditEventModel.createDeploymentCompleted(
              releaseId,
              actor,
              {
                deployment_id: crypto.randomUUID(),
                tenant_id: job.tenant_id,
                environment_name: 'unknown', // Would be passed from input
                duration_ms: build.duration || 0,
                cache_clear_status: cacheClearStatus || 'pending',
              }
            );
            await auditLogger.log(auditEvent);
          } else {
            const auditEvent = AuditEventModel.createDeploymentFailed(
              releaseId,
              actor,
              {
                deployment_id: crypto.randomUUID(),
                tenant_id: job.tenant_id,
                environment_name: 'unknown',
                error: errorMessage || 'Deployment failed',
              }
            );
            await auditLogger.log(auditEvent);
          }
        }

        return {
          tenant_id: job.tenant_id,
          status,
          jenkins_build_number: buildNumber,
          jenkins_job_url: jobUrl,
          duration_ms: build.duration || undefined,
          cache_clear_status: cacheClearStatus,
          error_message: errorMessage,
          console_output_tail: consoleOutputTail?.substring(0, 5000),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to get job status', {
          tenant_id: job.tenant_id,
          error: errorMessage,
        });

        return {
          tenant_id: job.tenant_id,
          status: 'failed' as DeploymentStatus,
          error_message: errorMessage,
        };
      }
    });

    const statuses = await Promise.all(statusPromises);

    const output: GetJobStatusOutput = {
      statuses,
    };

    logger.info('Job status check completed', {
      total_jobs: statuses.length,
      queued: statuses.filter(s => s.status === 'queued').length,
      running: statuses.filter(s => s.status === 'running').length,
      success: statuses.filter(s => s.status === 'success').length,
      failed: statuses.filter(s => s.status === 'failed').length,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get job statuses', {
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Extract cache clear status from Jenkins build metadata
 *
 * Jenkins job should set environment variable: CACHE_CLEAR_STATUS
 * or include it in build description
 */
function extractCacheClearStatus(build: any): CacheClearStatus | undefined {
  try {
    // Check build actions for environment variables
    if (build.actions) {
      for (const action of build.actions) {
        if (action.parameters) {
          for (const param of action.parameters) {
            if (param.name === 'CACHE_CLEAR_STATUS') {
              const value = param.value?.toLowerCase();
              if (['cleared', 'skipped', 'failed', 'in_progress'].includes(value)) {
                return value as CacheClearStatus;
              }
            }
          }
        }
      }
    }

    // Check build description
    if (build.description) {
      const desc = build.description.toLowerCase();
      if (desc.includes('cache cleared')) return 'cleared';
      if (desc.includes('cache skipped')) return 'skipped';
      if (desc.includes('cache failed')) return 'failed';
      if (desc.includes('cache in progress')) return 'in_progress';
    }

    return 'pending';
  } catch (error) {
    logger.warn('Failed to extract cache clear status', { error });
    return 'pending';
  }
}

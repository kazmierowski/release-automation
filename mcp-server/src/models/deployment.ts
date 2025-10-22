/**
 * Deployment Model
 *
 * T040: Deployment entity type definition with status tracking and retry logic
 *
 * Represents a Jenkins deployment job for a specific tenant and release,
 * tracking status, duration, cache clearing status, and retry attempts.
 */

import {
  Deployment,
  DeploymentStatus,
  CacheClearStatus,
  EnvironmentName,
  createDeployment,
  canRetryDeployment,
  calculateDeploymentDuration,
} from '../types/entities.js';

/**
 * Deployment model with validation and business logic
 */
export class DeploymentModel {
  /**
   * Create a new Deployment entity with validation
   */
  static create(params: {
    release_id: string;
    tenant_id: string;
    environment_name: EnvironmentName;
    jenkins_job_name: string;
  }): Deployment {
    // Validate UUIDs
    if (!DeploymentModel.isValidUUID(params.release_id)) {
      throw new Error(`Invalid release_id UUID format: ${params.release_id}`);
    }

    // Validate tenant ID format (alphanumeric, lowercase, hyphens)
    if (!DeploymentModel.isValidTenantId(params.tenant_id)) {
      throw new Error(
        `Invalid tenant_id format: ${params.tenant_id}. Must be alphanumeric, lowercase, with hyphens allowed`
      );
    }

    // Validate Jenkins job name
    if (!params.jenkins_job_name || params.jenkins_job_name.trim().length === 0) {
      throw new Error('Jenkins job name cannot be empty');
    }

    return createDeployment(params);
  }

  /**
   * Validate UUID v4 format
   */
  static isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  }

  /**
   * Validate tenant ID format (alphanumeric, lowercase, hyphens)
   */
  static isValidTenantId(tenantId: string): boolean {
    return /^[a-z0-9-]+$/.test(tenantId);
  }

  /**
   * Update deployment status with validation
   */
  static updateStatus(
    deployment: Deployment,
    newStatus: DeploymentStatus,
    updates?: {
      error_message?: string;
      console_output_tail?: string;
      cache_clear_status?: CacheClearStatus;
    }
  ): Deployment {
    // Validate state transition
    if (!DeploymentModel.isValidStatusTransition(deployment.status, newStatus)) {
      throw new Error(
        `Invalid status transition from ${deployment.status} to ${newStatus}`
      );
    }

    const updatedDeployment: Deployment = {
      ...deployment,
      status: newStatus,
    };

    // Set timestamps based on status
    if (newStatus === 'running' && !deployment.started_at) {
      updatedDeployment.started_at = new Date().toISOString();
    }

    if (['success', 'failed', 'cancelled', 'timeout'].includes(newStatus) && !deployment.completed_at) {
      updatedDeployment.completed_at = new Date().toISOString();

      // Calculate duration
      if (deployment.started_at) {
        updatedDeployment.duration_ms = calculateDeploymentDuration({
          ...updatedDeployment,
          completed_at: updatedDeployment.completed_at,
        });
      }
    }

    // Add optional updates
    if (updates?.error_message) {
      updatedDeployment.error_message = updates.error_message.substring(0, 1000); // Max 1,000 chars
    }

    if (updates?.console_output_tail) {
      updatedDeployment.console_output_tail = updates.console_output_tail.substring(0, 5000); // Max 5,000 chars
    }

    if (updates?.cache_clear_status) {
      updatedDeployment.cache_clear_status = updates.cache_clear_status;
    }

    // Validate cache clear status for success
    if (newStatus === 'success' && !updatedDeployment.cache_clear_status) {
      updatedDeployment.cache_clear_status = 'pending'; // Will be updated by Jenkins
    }

    return updatedDeployment;
  }

  /**
   * Validate status transition according to state machine
   */
  static isValidStatusTransition(
    currentStatus: DeploymentStatus,
    newStatus: DeploymentStatus
  ): boolean {
    const transitions: Record<DeploymentStatus, DeploymentStatus[]> = {
      queued: ['running', 'cancelled'],
      running: ['success', 'failed', 'timeout', 'cancelled'],
      success: [],
      failed: ['running'], // Can retry once
      cancelled: [],
      timeout: [],
    };

    return transitions[currentStatus]?.includes(newStatus) ?? false;
  }

  /**
   * Set Jenkins queue information
   */
  static setJenkinsQueueInfo(
    deployment: Deployment,
    queueId: number
  ): Deployment {
    return {
      ...deployment,
      jenkins_queue_id: queueId,
    };
  }

  /**
   * Set Jenkins build information
   */
  static setJenkinsBuildInfo(
    deployment: Deployment,
    buildNumber: number,
    jobUrl: string
  ): Deployment {
    return {
      ...deployment,
      jenkins_build_number: buildNumber,
      jenkins_job_url: jobUrl,
    };
  }

  /**
   * Attempt retry (max 1 retry per Constitution)
   */
  static retry(deployment: Deployment): Deployment {
    if (!canRetryDeployment(deployment)) {
      throw new Error(
        `Cannot retry deployment: status=${deployment.status}, retry_count=${deployment.retry_count} (max 1)`
      );
    }

    return {
      ...deployment,
      status: 'queued',
      retry_count: deployment.retry_count + 1,
      error_message: undefined,
      console_output_tail: undefined,
      completed_at: undefined,
      duration_ms: undefined,
    };
  }

  /**
   * Check if deployment can be retried (max 1 retry)
   */
  static canRetry(deployment: Deployment): boolean {
    return canRetryDeployment(deployment);
  }

  /**
   * Check if deployment is in terminal state
   */
  static isTerminal(deployment: Deployment): boolean {
    return ['success', 'cancelled', 'timeout'].includes(deployment.status);
  }

  /**
   * Check if deployment failed
   */
  static isFailed(deployment: Deployment): boolean {
    return deployment.status === 'failed';
  }

  /**
   * Check if deployment succeeded
   */
  static isSuccessful(deployment: Deployment): boolean {
    return deployment.status === 'success';
  }

  /**
   * Get deployment duration in minutes (rounded)
   */
  static getDurationMinutes(deployment: Deployment): number | undefined {
    if (!deployment.duration_ms) {
      return undefined;
    }

    return Math.round(deployment.duration_ms / 1000 / 60);
  }

  /**
   * Check if deployment exceeds performance target (15 min per tenant)
   */
  static exceedsPerformanceTarget(deployment: Deployment): boolean {
    if (!deployment.duration_ms) {
      return false;
    }

    const targetMs = 15 * 60 * 1000; // 15 minutes
    return deployment.duration_ms > targetMs;
  }
}

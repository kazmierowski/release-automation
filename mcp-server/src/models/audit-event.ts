/**
 * AuditEvent Model
 *
 * T042: AuditEvent entity type definition with structured logging
 *
 * Represents a logged action or event in the system for compliance and debugging.
 * All events are structured with timestamps, actors, event types, and detailed context.
 */

import {
  AuditEvent,
  AuditEventType,
  createAuditEvent,
} from '../types/entities.js';

/**
 * AuditEvent model with validation and business logic
 */
export class AuditEventModel {
  /**
   * Create a new AuditEvent entity with validation
   */
  static create(params: {
    release_id: string;
    event_type: AuditEventType;
    actor: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details: Record<string, unknown>;
    status?: 'success' | 'failure' | 'in_progress';
    error_message?: string;
  }): AuditEvent {
    // Validate UUID
    if (!AuditEventModel.isValidUUID(params.release_id)) {
      throw new Error(`Invalid release_id UUID format: ${params.release_id}`);
    }

    // Validate action length
    if (params.action.length > 100) {
      throw new Error('Action cannot exceed 100 characters');
    }

    // Validate error message length
    if (params.error_message && params.error_message.length > 500) {
      throw new Error('Error message cannot exceed 500 characters');
    }

    // Validate status for error message
    if (params.error_message && params.status !== 'failure') {
      throw new Error('Error message can only be set when status is "failure"');
    }

    const event = createAuditEvent(
      params.release_id,
      params.event_type,
      params.actor,
      params.action,
      params.resource_type,
      params.resource_id,
      params.details,
      params.status
    );

    if (params.error_message) {
      event.error_message = params.error_message;
    }

    return event;
  }

  /**
   * Validate UUID v4 format
   */
  static isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
  }

  /**
   * Create release created event
   */
  static createReleaseCreated(
    releaseId: string,
    actor: string,
    releaseDetails: {
      version: string;
      release_type: string;
      target_environment: string;
      ticket_count: number;
      tenant_count: number;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'release_created',
      actor,
      action: 'Created new release',
      resource_type: 'release',
      resource_id: releaseId,
      details: releaseDetails,
      status: 'success',
    });
  }

  /**
   * Create release started event
   */
  static createReleaseStarted(
    releaseId: string,
    actor: string,
    releaseVersion: string
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'release_started',
      actor,
      action: `Started release ${releaseVersion}`,
      resource_type: 'release',
      resource_id: releaseId,
      details: { release_version: releaseVersion },
      status: 'in_progress',
    });
  }

  /**
   * Create PR merged event
   */
  static createPRMerged(
    releaseId: string,
    actor: string,
    prDetails: {
      ticket_id: string;
      pr_id: string;
      commit_sha: string;
      merge_strategy: string;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'pr_merged',
      actor,
      action: `Merged PR #${prDetails.pr_id} for ${prDetails.ticket_id}`,
      resource_type: 'ticket',
      resource_id: prDetails.ticket_id,
      details: prDetails,
      status: 'success',
    });
  }

  /**
   * Create conflict detected event
   */
  static createConflictDetected(
    releaseId: string,
    actor: string,
    conflictDetails: {
      ticket_id: string;
      pr_id: string;
      conflicted_files: string[];
      confidence_score?: number;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'conflict_detected',
      actor,
      action: `Detected merge conflict for ${conflictDetails.ticket_id}`,
      resource_type: 'ticket',
      resource_id: conflictDetails.ticket_id,
      details: conflictDetails,
      status: 'in_progress',
    });
  }

  /**
   * Create deployment triggered event
   */
  static createDeploymentTriggered(
    releaseId: string,
    actor: string,
    deploymentDetails: {
      deployment_id: string;
      tenant_id: string;
      environment_name: string;
      jenkins_job_name: string;
      jenkins_queue_id?: number;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'deployment_triggered',
      actor,
      action: `Triggered deployment for ${deploymentDetails.tenant_id} to ${deploymentDetails.environment_name}`,
      resource_type: 'deployment',
      resource_id: deploymentDetails.deployment_id,
      details: deploymentDetails,
      status: 'in_progress',
    });
  }

  /**
   * Create deployment completed event
   */
  static createDeploymentCompleted(
    releaseId: string,
    actor: string,
    deploymentDetails: {
      deployment_id: string;
      tenant_id: string;
      environment_name: string;
      duration_ms: number;
      cache_clear_status: string;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'deployment_completed',
      actor,
      action: `Completed deployment for ${deploymentDetails.tenant_id} to ${deploymentDetails.environment_name}`,
      resource_type: 'deployment',
      resource_id: deploymentDetails.deployment_id,
      details: deploymentDetails,
      status: 'success',
    });
  }

  /**
   * Create deployment failed event
   */
  static createDeploymentFailed(
    releaseId: string,
    actor: string,
    deploymentDetails: {
      deployment_id: string;
      tenant_id: string;
      environment_name: string;
      error: string;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'deployment_failed',
      actor,
      action: `Deployment failed for ${deploymentDetails.tenant_id} to ${deploymentDetails.environment_name}`,
      resource_type: 'deployment',
      resource_id: deploymentDetails.deployment_id,
      details: {
        tenant_id: deploymentDetails.tenant_id,
        environment_name: deploymentDetails.environment_name,
      },
      status: 'failure',
      error_message: deploymentDetails.error,
    });
  }

  /**
   * Create JIRA updated event
   */
  static createJIRAUpdated(
    releaseId: string,
    actor: string,
    jiraDetails: {
      ticket_ids: string[];
      new_status: string;
      updated_count: number;
      failed_count: number;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'jira_updated',
      actor,
      action: `Updated ${jiraDetails.updated_count} JIRA tickets to ${jiraDetails.new_status}`,
      resource_type: 'tickets',
      resource_id: jiraDetails.ticket_ids.join(','),
      details: jiraDetails,
      status: jiraDetails.failed_count === 0 ? 'success' : 'failure',
      error_message: jiraDetails.failed_count > 0 ? `${jiraDetails.failed_count} tickets failed to update` : undefined,
    });
  }

  /**
   * Create notification sent event
   */
  static createNotificationSent(
    releaseId: string,
    actor: string,
    notificationDetails: {
      notification_type: string;
      recipient: string;
      teams_message_id?: string;
    }
  ): AuditEvent {
    return AuditEventModel.create({
      release_id: releaseId,
      event_type: 'notification_sent',
      actor,
      action: `Sent ${notificationDetails.notification_type} notification to ${notificationDetails.recipient}`,
      resource_type: 'notification',
      resource_id: notificationDetails.teams_message_id || 'pending',
      details: notificationDetails,
      status: 'success',
    });
  }

  /**
   * Sanitize details to remove sensitive information
   */
  static sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      // Skip sensitive keys
      if (EnvironmentModel.isSensitiveKey(key)) {
        sanitized[key] = '***REDACTED***';
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = AuditEventModel.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if key contains sensitive information
   */
  private static isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /auth/i,
      /credential/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(key));
  }

  /**
   * Format event for logging
   */
  static formatForLog(event: AuditEvent): string {
    return JSON.stringify({
      timestamp: event.timestamp,
      event_type: event.event_type,
      actor: event.actor,
      action: event.action,
      resource: `${event.resource_type}:${event.resource_id}`,
      status: event.status,
      details: AuditEventModel.sanitizeDetails(event.details),
    });
  }
}

/**
 * Helper class for environment model detection in AuditEventModel
 * This is a workaround to avoid circular dependency
 */
class EnvironmentModel {
  static isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /auth/i,
      /credential/i,
    ];

    return sensitivePatterns.some(pattern => pattern.test(key));
  }
}

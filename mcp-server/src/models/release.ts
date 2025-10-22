/**
 * Release Model
 *
 * T038: Release entity type definition with validation and business logic
 *
 * Represents a deployment bundle with associated tickets, target environment,
 * and deployment status tracking throughout the release workflow.
 */

import {
  Release,
  ReleaseType,
  EnvironmentName,
  ReleaseStatus,
  AuditEvent,
  createRelease,
  validateReleaseTypeForEnvironment,
} from '../types/entities.js';

/**
 * Release model with validation and business logic
 */
export class ReleaseModel {
  /**
   * Create a new Release entity with validation
   */
  static create(params: {
    version: string;
    release_type: ReleaseType;
    target_environment: EnvironmentName;
    ticket_ids: string[];
    tenant_ids: string[];
    created_by: string;
  }): Release {
    // Validate release type for environment (Constitution II)
    const validation = validateReleaseTypeForEnvironment(
      params.release_type,
      params.target_environment
    );

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Validate version format
    if (!ReleaseModel.isValidVersion(params.version, params.release_type)) {
      throw new Error(
        `Invalid version format: ${params.version}. ` +
        `Expected ${params.release_type === 'regular' ? 'vX.Y.Z' : 'hotfix/vX.Y.Z'}`
      );
    }

    // Validate ticket IDs
    if (params.ticket_ids.length === 0) {
      throw new Error('Release must have at least one ticket');
    }

    params.ticket_ids.forEach(ticketId => {
      if (!ReleaseModel.isValidJIRATicketId(ticketId)) {
        throw new Error(`Invalid JIRA ticket ID format: ${ticketId}`);
      }
    });

    // Validate tenant IDs
    if (params.tenant_ids.length === 0) {
      throw new Error('Release must have at least one tenant');
    }

    return createRelease(params);
  }

  /**
   * Validate version format based on release type
   */
  static isValidVersion(version: string, releaseType: ReleaseType): boolean {
    if (releaseType === 'regular') {
      // Regular: vX.Y.Z (semantic versioning)
      return /^v\d+\.\d+\.\d+$/.test(version);
    } else {
      // Hotfix: hotfix/vX.Y.Z
      return /^hotfix\/v\d+\.\d+\.\d+$/.test(version);
    }
  }

  /**
   * Validate JIRA ticket ID format (e.g., "PROJ-123")
   */
  static isValidJIRATicketId(ticketId: string): boolean {
    return /^[A-Z]+-\d+$/.test(ticketId);
  }

  /**
   * Update release status with validation
   */
  static updateStatus(
    release: Release,
    newStatus: ReleaseStatus,
    errorMessage?: string
  ): Release {
    // Validate state transitions
    if (!ReleaseModel.isValidStatusTransition(release.status, newStatus)) {
      throw new Error(
        `Invalid status transition from ${release.status} to ${newStatus}`
      );
    }

    const updates: Partial<Release> = {
      status: newStatus,
    };

    // Set timestamps based on status
    if (newStatus === 'in_progress' && !release.started_at) {
      updates.started_at = new Date().toISOString();
    }

    if (['completed', 'failed', 'partially_completed'].includes(newStatus) && !release.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage.substring(0, 500); // Max 500 chars
    }

    return {
      ...release,
      ...updates,
    };
  }

  /**
   * Validate status transition according to state machine
   */
  static isValidStatusTransition(
    currentStatus: ReleaseStatus,
    newStatus: ReleaseStatus
  ): boolean {
    const transitions: Record<ReleaseStatus, ReleaseStatus[]> = {
      pending: ['in_progress'],
      in_progress: ['completed', 'failed', 'partially_completed', 'blocked'],
      blocked: ['in_progress', 'failed'],
      completed: [],
      failed: [],
      partially_completed: [],
    };

    return transitions[currentStatus]?.includes(newStatus) ?? false;
  }

  /**
   * Add audit event to release
   */
  static addAuditEvent(release: Release, event: AuditEvent): Release {
    return {
      ...release,
      audit_trail: [...release.audit_trail, event],
    };
  }

  /**
   * Calculate release duration in milliseconds
   */
  static getDuration(release: Release): number | undefined {
    if (!release.started_at || !release.completed_at) {
      return undefined;
    }

    const start = new Date(release.started_at).getTime();
    const end = new Date(release.completed_at).getTime();

    return end - start;
  }

  /**
   * Check if release is in terminal state (completed, failed, partially_completed)
   */
  static isTerminal(release: Release): boolean {
    return ['completed', 'failed', 'partially_completed'].includes(release.status);
  }

  /**
   * Check if release is blocked
   */
  static isBlocked(release: Release): boolean {
    return release.status === 'blocked';
  }
}

/**
 * Ticket Model
 *
 * T039: Ticket entity type definition with PR approval validation
 *
 * Represents a JIRA ticket with associated pull request information,
 * approval status, merge status, and conflict detection.
 */

import {
  Ticket,
  MergeStatus,
  MergeStrategy,
  ConflictInfo,
} from '../types/entities.js';

/**
 * Ticket model with validation and business logic
 */
export class TicketModel {
  /**
   * Create a new Ticket entity with validation
   */
  static create(params: {
    id: string;
    summary: string;
    pr_id: string;
    pr_url: string;
    pr_owner_email: string;
    approval_count: number;
    required_approvals?: number;
    approvers: string[];
    potential_reviewers?: string[];
  }): Ticket {
    // Validate ticket ID format
    if (!TicketModel.isValidJIRATicketId(params.id)) {
      throw new Error(`Invalid JIRA ticket ID format: ${params.id}`);
    }

    // Validate email format
    if (!TicketModel.isValidEmail(params.pr_owner_email)) {
      throw new Error(`Invalid email format: ${params.pr_owner_email}`);
    }

    // Validate approval count
    if (params.approval_count < 0) {
      throw new Error('Approval count cannot be negative');
    }

    const required_approvals = params.required_approvals ?? 2;

    // Validate approvers count matches approval_count
    if (params.approvers.length !== params.approval_count) {
      throw new Error(
        `Approvers count (${params.approvers.length}) does not match approval_count (${params.approval_count})`
      );
    }

    return {
      id: params.id,
      summary: params.summary.substring(0, 255), // Max 255 chars
      pr_id: params.pr_id,
      pr_url: params.pr_url,
      pr_owner_email: params.pr_owner_email,
      approval_count: params.approval_count,
      required_approvals,
      approved: params.approval_count >= required_approvals,
      approvers: params.approvers,
      potential_reviewers: params.potential_reviewers,
      merge_status: 'pending',
      conflicts_detected: false,
    };
  }

  /**
   * Validate JIRA ticket ID format (e.g., "PROJ-123")
   */
  static isValidJIRATicketId(ticketId: string): boolean {
    return /^[A-Z]+-\d+$/.test(ticketId);
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Update approval status
   */
  static updateApprovals(
    ticket: Ticket,
    approvalCount: number,
    approvers: string[]
  ): Ticket {
    if (approvalCount < 0) {
      throw new Error('Approval count cannot be negative');
    }

    return {
      ...ticket,
      approval_count: approvalCount,
      approvers,
      approved: approvalCount >= ticket.required_approvals,
    };
  }

  /**
   * Mark ticket as merged
   */
  static markAsMerged(
    ticket: Ticket,
    commitSha: string,
    mergeStrategy: MergeStrategy,
    squashCommitMessage?: string
  ): Ticket {
    // Validate squash commit message format if using squash strategy
    if (mergeStrategy === 'squash') {
      if (!squashCommitMessage) {
        throw new Error('Squash commit message is required for squash merge strategy');
      }

      if (!TicketModel.isValidSquashCommitMessage(ticket.id, squashCommitMessage)) {
        throw new Error(
          `Invalid squash commit message format. Expected: [${ticket.id}] Summary, got: ${squashCommitMessage}`
        );
      }
    }

    return {
      ...ticket,
      merge_status: 'merged',
      merge_commit_sha: commitSha,
      merge_strategy: mergeStrategy,
      squash_commit_message: squashCommitMessage,
    };
  }

  /**
   * Validate squash commit message format: "[TICKET-ID] Summary"
   */
  static isValidSquashCommitMessage(ticketId: string, message: string): boolean {
    const pattern = new RegExp(`^\\[${ticketId}\\] .+$`);
    return pattern.test(message);
  }

  /**
   * Mark ticket as having conflicts
   */
  static markAsConflicted(
    ticket: Ticket,
    conflictInfo: ConflictInfo
  ): Ticket {
    if (conflictInfo.conflicted_files.length === 0) {
      throw new Error('Conflict info must have at least one conflicted file');
    }

    return {
      ...ticket,
      merge_status: 'blocked',
      conflicts_detected: true,
      conflict_details: conflictInfo,
    };
  }

  /**
   * Mark conflict as resolved
   */
  static resolveConflict(ticket: Ticket): Ticket {
    if (!ticket.conflicts_detected) {
      throw new Error('No conflicts to resolve');
    }

    const updatedConflictDetails = ticket.conflict_details
      ? {
          ...ticket.conflict_details,
          resolved_at: new Date().toISOString(),
        }
      : undefined;

    return {
      ...ticket,
      conflicts_detected: false,
      conflict_details: updatedConflictDetails,
      merge_status: 'pending',
    };
  }

  /**
   * Mark ticket merge as failed
   */
  static markAsFailed(ticket: Ticket, errorMessage: string): Ticket {
    return {
      ...ticket,
      merge_status: 'failed',
    };
  }

  /**
   * Check if ticket is ready for merge (approved and no conflicts)
   */
  static isReadyForMerge(ticket: Ticket): boolean {
    return (
      ticket.approved &&
      !ticket.conflicts_detected &&
      ticket.merge_status === 'pending'
    );
  }

  /**
   * Check if ticket needs approvals
   */
  static needsApprovals(ticket: Ticket): boolean {
    return ticket.approval_count < ticket.required_approvals;
  }

  /**
   * Get remaining approvals needed
   */
  static getRemainingApprovals(ticket: Ticket): number {
    return Math.max(0, ticket.required_approvals - ticket.approval_count);
  }
}

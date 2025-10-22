/**
 * Git Check PR Approvals MCP Tool
 *
 * T044: Implement git_check_pr_approvals MCP tool
 *
 * Checks PR approval status using Git provider abstraction.
 * Returns approval count, approvers, and potential reviewers if insufficient.
 * Enforces minimum 2 approvals per Constitution II.
 */

import { IGitProvider } from '../../providers/git/base.js';
import { Ticket } from '../../types/entities.js';
import { TicketModel } from '../../models/ticket.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for git_check_pr_approvals tool
 */
export const CheckPRApprovalsInputSchema = z.object({
  pr_id: z.string().describe('Pull request ID or number'),
  required_approvals: z.number().optional().default(2).describe('Required number of approvals (default: 2)'),
});

export type CheckPRApprovalsInput = z.infer<typeof CheckPRApprovalsInputSchema>;

/**
 * Output schema for git_check_pr_approvals tool
 */
export const CheckPRApprovalsOutputSchema = z.object({
  pr_id: z.string(),
  approval_count: z.number(),
  required_approvals: z.number(),
  approved: z.boolean(),
  approvers: z.array(z.string()),
  pr_owner: z.string(),
  pr_owner_email: z.string(),
  potential_reviewers: z.array(z.string()),
});

export type CheckPRApprovalsOutput = z.infer<typeof CheckPRApprovalsOutputSchema>;

/**
 * Check PR approvals using Git provider
 */
export async function checkPRApprovals(
  input: CheckPRApprovalsInput,
  gitProvider: IGitProvider,
  releaseId?: string
): Promise<CheckPRApprovalsOutput> {
  const startTime = Date.now();
  const actor = 'system';

  try {
    logger.info('Checking PR approvals', {
      pr_id: input.pr_id,
      required_approvals: input.required_approvals,
    });

    // Call Git provider to get PR approval status
    const approvalStatus = await gitProvider.checkPRApprovals(input.pr_id);

    const output: CheckPRApprovalsOutput = {
      pr_id: input.pr_id,
      approval_count: approvalStatus.approvalCount,
      required_approvals: input.required_approvals,
      approved: approvalStatus.approvalCount >= input.required_approvals,
      approvers: approvalStatus.approvers,
      pr_owner: approvalStatus.prOwner,
      pr_owner_email: approvalStatus.prOwnerEmail,
      potential_reviewers: approvalStatus.potentialReviewers || [],
    };

    // Log audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.create({
        release_id: releaseId,
        event_type: 'pr_approved',
        actor,
        action: `Checked PR #${input.pr_id} approvals: ${output.approval_count}/${input.required_approvals}`,
        resource_type: 'pr',
        resource_id: input.pr_id,
        details: {
          pr_id: input.pr_id,
          approval_count: output.approval_count,
          required_approvals: input.required_approvals,
          approved: output.approved,
          approvers: output.approvers,
          pr_owner: output.pr_owner,
          duration_ms: Date.now() - startTime,
        },
        status: 'success',
      });
      await auditLogger.log(auditEvent);
    }

    logger.info('PR approval check completed', {
      pr_id: input.pr_id,
      approved: output.approved,
      approval_count: output.approval_count,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to check PR approvals', {
      error: errorMessage,
      pr_id: input.pr_id,
    });

    // Log failure audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.create({
        release_id: releaseId,
        event_type: 'pr_approved',
        actor,
        action: `Failed to check PR #${input.pr_id} approvals`,
        resource_type: 'pr',
        resource_id: input.pr_id,
        details: {
          pr_id: input.pr_id,
          duration_ms: Date.now() - startTime,
        },
        status: 'failure',
        error_message: errorMessage,
      });
      await auditLogger.log(auditEvent);
    }

    throw error;
  }
}

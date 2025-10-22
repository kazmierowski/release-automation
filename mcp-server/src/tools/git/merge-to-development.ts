/**
 * Git Merge Tickets to Development MCP Tool
 *
 * T045: Implement git_merge_tickets_to_development MCP tool
 *
 * Merges approved PRs to development branch using squash merge strategy.
 * Validates squash commit message format: "[TICKET-ID] Summary"
 * Detects conflicts and returns conflict details for escalation.
 */

import { IGitProvider } from '../../providers/git/base.js';
import { Ticket } from '../../types/entities.js';
import { TicketModel } from '../../models/ticket.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for git_merge_tickets_to_development tool
 */
export const MergeToDevInputSchema = z.object({
  tickets: z.array(
    z.object({
      ticket_id: z.string(),
      pr_id: z.string(),
      squash_commit_message: z.string(),
    })
  ).describe('Tickets to merge with their PR IDs and commit messages'),
  target_branch: z.string().optional().default('development').describe('Target branch name'),
  auto_resolve_conflicts: z.boolean().optional().default(false).describe('Attempt AI-powered conflict resolution'),
});

export type MergeToDevInput = z.infer<typeof MergeToDevInputSchema>;

/**
 * Output schema for git_merge_tickets_to_development tool
 */
export const MergeToDevOutputSchema = z.object({
  merged: z.array(
    z.object({
      ticket_id: z.string(),
      pr_id: z.string(),
      commit_sha: z.string(),
    })
  ),
  conflicts: z.array(
    z.object({
      ticket_id: z.string(),
      pr_id: z.string(),
      conflicted_files: z.array(z.string()),
      resolution_suggestion: z.string().optional(),
    })
  ),
  failed: z.array(
    z.object({
      ticket_id: z.string(),
      pr_id: z.string(),
      error: z.string(),
    })
  ),
});

export type MergeToDevOutput = z.infer<typeof MergeToDevOutputSchema>;

/**
 * Merge tickets to development branch
 */
export async function mergeTicketsToDevelopment(
  input: MergeToDevInput,
  gitProvider: IGitProvider,
  releaseId?: string
): Promise<MergeToDevOutput> {
  const startTime = Date.now();
  const actor = 'system';

  const merged: MergeToDevOutput['merged'] = [];
  const conflicts: MergeToDevOutput['conflicts'] = [];
  const failed: MergeToDevOutput['failed'] = [];

  try {
    logger.info('Starting merge to development', {
      ticket_count: input.tickets.length,
      target_branch: input.target_branch,
    });

    for (const ticket of input.tickets) {
      try {
        // Validate squash commit message format
        if (!TicketModel.isValidSquashCommitMessage(ticket.ticket_id, ticket.squash_commit_message)) {
          failed.push({
            ticket_id: ticket.ticket_id,
            pr_id: ticket.pr_id,
            error: `Invalid squash commit message format. Expected: [${ticket.ticket_id}] Summary`,
          });
          continue;
        }

        logger.debug('Merging PR', {
          ticket_id: ticket.ticket_id,
          pr_id: ticket.pr_id,
        });

        // Attempt merge with squash strategy
        const mergeResult = await gitProvider.mergePR(
          ticket.pr_id,
          'squash',
          ticket.squash_commit_message
        );

        if (mergeResult.success) {
          merged.push({
            ticket_id: ticket.ticket_id,
            pr_id: ticket.pr_id,
            commit_sha: mergeResult.commitSha!,
          });

          // Log successful merge audit event
          if (releaseId) {
            const auditLogger = await getAuditLogger();
            const auditEvent = AuditEventModel.createPRMerged(
              releaseId,
              actor,
              {
                ticket_id: ticket.ticket_id,
                pr_id: ticket.pr_id,
                commit_sha: mergeResult.commitSha!,
                merge_strategy: 'squash',
              }
            );
            await auditLogger.log(auditEvent);
          }

          logger.info('PR merged successfully', {
            ticket_id: ticket.ticket_id,
            pr_id: ticket.pr_id,
            commit_sha: mergeResult.commitSha,
          });
        } else if (mergeResult.conflict) {
          // Conflict detected
          conflicts.push({
            ticket_id: ticket.ticket_id,
            pr_id: ticket.pr_id,
            conflicted_files: mergeResult.conflict.conflictedFiles,
            resolution_suggestion: mergeResult.conflict.resolutionSuggestion,
          });

          // Log conflict detected audit event
          if (releaseId) {
            const auditLogger = await getAuditLogger();
            const auditEvent = AuditEventModel.createConflictDetected(
              releaseId,
              actor,
              {
                ticket_id: ticket.ticket_id,
                pr_id: ticket.pr_id,
                conflicted_files: mergeResult.conflict.conflictedFiles,
              }
            );
            await auditLogger.log(auditEvent);
          }

          logger.warn('Merge conflict detected', {
            ticket_id: ticket.ticket_id,
            pr_id: ticket.pr_id,
            conflicted_files: mergeResult.conflict.conflictedFiles,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({
          ticket_id: ticket.ticket_id,
          pr_id: ticket.pr_id,
          error: errorMessage,
        });

        logger.error('Failed to merge PR', {
          ticket_id: ticket.ticket_id,
          pr_id: ticket.pr_id,
          error: errorMessage,
        });
      }
    }

    const output: MergeToDevOutput = {
      merged,
      conflicts,
      failed,
    };

    logger.info('Merge to development completed', {
      merged_count: merged.length,
      conflicts_count: conflicts.length,
      failed_count: failed.length,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to merge tickets to development', {
      error: errorMessage,
    });

    throw error;
  }
}

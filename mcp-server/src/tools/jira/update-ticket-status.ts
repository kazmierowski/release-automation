/**
 * JIRA Update Ticket Status MCP Tool
 *
 * T049: Implement jira_update_ticket_status MCP tool
 *
 * Updates JIRA ticket status in batch (chunks of 10 per FR-022).
 * Validates transition availability before executing.
 * Returns updated and failed ticket lists.
 */

import { Version3Client } from 'jira.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for jira_update_ticket_status tool
 */
export const UpdateTicketStatusInputSchema = z.object({
  ticket_ids: z.array(z.string()).describe('JIRA ticket IDs to update'),
  new_status: z.string().describe('Target status (e.g., "Deployed", "Partially Deployed")'),
  comment: z.string().optional().describe('Optional comment to add to tickets'),
});

export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusInputSchema>;

/**
 * Output schema for jira_update_ticket_status tool
 */
export const UpdateTicketStatusOutputSchema = z.object({
  updated: z.array(z.string()),
  failed: z.array(
    z.object({
      ticket_id: z.string(),
      error: z.string(),
    })
  ),
});

export type UpdateTicketStatusOutput = z.infer<typeof UpdateTicketStatusOutputSchema>;

/**
 * Update ticket status in JIRA
 */
export async function updateTicketStatus(
  input: UpdateTicketStatusInput,
  jiraClient: Version3Client,
  releaseId?: string
): Promise<UpdateTicketStatusOutput> {
  const startTime = Date.now();
  const actor = 'system';

  const updated: string[] = [];
  const failed: UpdateTicketStatusOutput['failed'] = [];

  try {
    logger.info('Updating JIRA ticket statuses', {
      ticket_count: input.ticket_ids.length,
      new_status: input.new_status,
    });

    // Process in chunks of 10 to respect rate limits
    const chunks = chunkArray(input.ticket_ids, 10);

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (ticketId) => {
          try {
            logger.debug('Updating ticket status', {
              ticket_id: ticketId,
              new_status: input.new_status,
            });

            // Get available transitions for this ticket
            const transitions = await jiraClient.issues.getTransitions({
              issueIdOrKey: ticketId,
            });

            // Find target transition
            const targetTransition = transitions.transitions?.find(
              (t) => t.name === input.new_status
            );

            if (!targetTransition) {
              throw new Error(
                `Transition to "${input.new_status}" not available for ${ticketId}. ` +
                `Available: ${transitions.transitions?.map(t => t.name).join(', ')}`
              );
            }

            // Execute transition
            await jiraClient.issues.doTransition({
              issueIdOrKey: ticketId,
              transition: {
                id: targetTransition.id!,
              },
            });

            // Add comment if provided
            if (input.comment) {
              await jiraClient.issueComments.addComment({
                issueIdOrKey: ticketId,
                body: input.comment,
              });
            }

            updated.push(ticketId);

            logger.info('Ticket status updated', {
              ticket_id: ticketId,
              new_status: input.new_status,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            failed.push({
              ticket_id: ticketId,
              error: errorMessage,
            });

            logger.error('Failed to update ticket status', {
              ticket_id: ticketId,
              error: errorMessage,
            });
          }
        })
      );
    }

    const output: UpdateTicketStatusOutput = {
      updated,
      failed,
    };

    // Log JIRA updated audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.createJIRAUpdated(
        releaseId,
        actor,
        {
          ticket_ids: input.ticket_ids,
          new_status: input.new_status,
          updated_count: updated.length,
          failed_count: failed.length,
        }
      );
      await auditLogger.log(auditEvent);
    }

    logger.info('Ticket status update completed', {
      updated_count: updated.length,
      failed_count: failed.length,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to update ticket statuses', {
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

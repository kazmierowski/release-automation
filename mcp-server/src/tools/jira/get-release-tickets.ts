/**
 * JIRA Get Release Tickets MCP Tool
 *
 * T043: Implement jira_get_release_tickets MCP tool
 *
 * Fetches all JIRA tickets for a specific release version using JQL query.
 * Returns ticket details including PR information for approval checking.
 */

import { Version3Client } from 'jira.js';
import { Ticket } from '../../types/entities.js';
import { TicketModel } from '../../models/ticket.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for jira_get_release_tickets tool
 */
export const GetReleaseTicketsInputSchema = z.object({
  release_version: z.string().describe('Release version to fetch tickets for (e.g., "v1.2.0")'),
  jira_statuses: z
    .array(z.string())
    .optional()
    .default(['Ready for Deployment', 'Approved'])
    .describe('JIRA statuses to filter tickets by'),
});

export type GetReleaseTicketsInput = z.infer<typeof GetReleaseTicketsInputSchema>;

/**
 * Output schema for jira_get_release_tickets tool
 */
export const GetReleaseTicketsOutputSchema = z.object({
  tickets: z.array(
    z.object({
      id: z.string(),
      summary: z.string(),
      pr_id: z.string(),
      pr_url: z.string(),
      pr_owner_email: z.string(),
      status: z.string(),
    })
  ),
  total_count: z.number(),
});

export type GetReleaseTicketsOutput = z.infer<typeof GetReleaseTicketsOutputSchema>;

/**
 * Get release tickets from JIRA
 */
export async function getReleaseTickets(
  input: GetReleaseTicketsInput,
  jiraClient: Version3Client,
  releaseId?: string
): Promise<GetReleaseTicketsOutput> {
  const startTime = Date.now();
  const actor = 'system'; // Will be replaced with actual actor from MCP context

  try {
    logger.info('Fetching release tickets from JIRA', {
      release_version: input.release_version,
      statuses: input.jira_statuses,
    });

    // Build JQL query
    const statusClause = input.jira_statuses.map(s => `"${s}"`).join(', ');
    const jql = `fixVersion = "${input.release_version}" AND status in (${statusClause})`;

    logger.debug('Executing JQL query', { jql });

    // Execute JIRA search
    const response = await jiraClient.issueSearch.searchForIssuesUsingJql({
      jql,
      fields: ['summary', 'status', 'customfield_10050'], // customfield_10050 = PR URL
      maxResults: 100, // Limit to 100 tickets per release
      startAt: 0,
    });

    logger.info('JIRA search completed', {
      total: response.total,
      returned: response.issues?.length || 0,
    });

    // Transform JIRA issues to tickets
    const tickets: GetReleaseTicketsOutput['tickets'] = [];

    for (const issue of response.issues || []) {
      try {
        const prUrl = issue.fields.customfield_10050 as string | undefined;

        if (!prUrl) {
          logger.warn('Ticket missing PR URL', { ticket_id: issue.key });
          continue;
        }

        // Extract PR ID from URL (depends on Git platform)
        const prId = extractPRIdFromUrl(prUrl);

        if (!prId) {
          logger.warn('Failed to extract PR ID from URL', {
            ticket_id: issue.key,
            pr_url: prUrl,
          });
          continue;
        }

        // Extract PR owner email (this would typically come from Git API)
        // For now, we'll use a placeholder that will be populated by git_check_pr_approvals
        const prOwnerEmail = 'unknown@example.com';

        tickets.push({
          id: issue.key,
          summary: issue.fields.summary || '',
          pr_id: prId,
          pr_url: prUrl,
          pr_owner_email: prOwnerEmail,
          status: issue.fields.status?.name || 'Unknown',
        });
      } catch (error) {
        logger.error('Failed to process JIRA issue', {
          issue_key: issue.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const output: GetReleaseTicketsOutput = {
      tickets,
      total_count: tickets.length,
    };

    // Log audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.create({
        release_id: releaseId,
        event_type: 'jira_updated',
        actor,
        action: `Fetched ${tickets.length} tickets from JIRA for ${input.release_version}`,
        resource_type: 'tickets',
        resource_id: tickets.map(t => t.id).join(','),
        details: {
          release_version: input.release_version,
          ticket_count: tickets.length,
          jira_statuses: input.jira_statuses,
          duration_ms: Date.now() - startTime,
        },
        status: 'success',
      });
      await auditLogger.log(auditEvent);
    }

    logger.info('Release tickets fetched successfully', {
      ticket_count: tickets.length,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch release tickets', {
      error: errorMessage,
      release_version: input.release_version,
    });

    // Log failure audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.create({
        release_id: releaseId,
        event_type: 'jira_updated',
        actor,
        action: `Failed to fetch tickets from JIRA for ${input.release_version}`,
        resource_type: 'tickets',
        resource_id: 'unknown',
        details: {
          release_version: input.release_version,
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

/**
 * Extract PR ID from PR URL
 *
 * Supports:
 * - Bitbucket: https://bitbucket.org/workspace/repo/pull-requests/123
 * - GitHub: https://github.com/org/repo/pull/123
 * - GitLab: https://gitlab.com/org/repo/-/merge_requests/123
 */
function extractPRIdFromUrl(prUrl: string): string | null {
  try {
    const url = new URL(prUrl);

    // Bitbucket pattern
    if (url.hostname.includes('bitbucket')) {
      const match = url.pathname.match(/\/pull-requests\/(\d+)/);
      return match ? match[1] : null;
    }

    // GitHub pattern
    if (url.hostname.includes('github')) {
      const match = url.pathname.match(/\/pull\/(\d+)/);
      return match ? match[1] : null;
    }

    // GitLab pattern
    if (url.hostname.includes('gitlab')) {
      const match = url.pathname.match(/\/merge_requests\/(\d+)/);
      return match ? match[1] : null;
    }

    return null;
  } catch {
    return null;
  }
}

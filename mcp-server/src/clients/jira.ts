import { Version3Client } from 'jira.js';
import { logger } from '../utils/logger.js';
import { retry, JIRA_RETRY_OPTIONS } from '../utils/retry.js';

/**
 * JIRA client configuration
 */
export interface JiraConfig {
  host: string; // e.g., "your-domain.atlassian.net"
  email: string;
  apiToken: string;
  projectKey: string;
}

/**
 * JIRA ticket with PR information
 */
export interface JiraTicketWithPR {
  id: string; // Ticket key (e.g., "PROJ-123")
  summary: string;
  status: string;
  fix_version?: string;
  pr_url?: string;
  pr_id?: string;
  pr_owner_email?: string;
}

/**
 * JIRA update result
 */
export interface JiraUpdateResult {
  ticket_id: string;
  success: boolean;
  updated_at: string;
  error?: string;
}

/**
 * JIRA API Client Factory
 *
 * Provides JIRA REST API integration with:
 * - Exponential backoff retry (1s, 2s, 4s)
 * - Ticket retrieval by fix version
 * - Bulk status updates
 * - Comment addition
 */
export class JiraClient {
  private client: Version3Client;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;

    // Initialize JIRA client
    this.client = new Version3Client({
      host: config.host,
      authentication: {
        basic: {
          email: config.email,
          apiToken: config.apiToken,
        },
      },
    });

    logger.info('JIRA client initialized', {
      host: config.host,
      projectKey: config.projectKey,
    });
  }

  /**
   * Get all tickets for a release version
   *
   * Searches for tickets with "Fix Version" field matching release version
   *
   * @param releaseVersion - Release version (e.g., "v1.2.0")
   * @param includePRDetails - Whether to extract PR details from ticket (default: true)
   * @returns {Promise<JiraTicketWithPR[]>} Array of tickets
   */
  async getTicketsByFixVersion(
    releaseVersion: string,
    includePRDetails: boolean = true
  ): Promise<JiraTicketWithPR[]> {
    const operation = async (): Promise<JiraTicketWithPR[]> => {
      try {
        logger.info(`Fetching JIRA tickets for release: ${releaseVersion}`);

        // JQL query for tickets with specific fix version
        const jql = `project = ${this.config.projectKey} AND fixVersion = "${releaseVersion}" ORDER BY key ASC`;

        const response = await this.client.issueSearch.searchForIssuesUsingJql({
          jql,
          fields: [
            'summary',
            'status',
            'fixVersions',
            'description',
            'customfield_10000', // Example: PR URL custom field
          ],
          maxResults: 100, // Adjust as needed
        });

        const tickets: JiraTicketWithPR[] = (response.issues || []).map((issue) => {
          const ticket: JiraTicketWithPR = {
            id: issue.key,
            summary: issue.fields.summary || '',
            status: issue.fields.status?.name || '',
            fix_version: releaseVersion,
          };

          // Extract PR details if requested
          if (includePRDetails) {
            const prDetails = this.extractPRDetails(issue);
            Object.assign(ticket, prDetails);
          }

          return ticket;
        });

        logger.info(`Found ${tickets.length} JIRA tickets for ${releaseVersion}`);

        return tickets;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to fetch JIRA tickets: ${message}`);
        throw new Error(`Failed to fetch JIRA tickets for ${releaseVersion}: ${message}`);
      }
    };

    return retry(operation, JIRA_RETRY_OPTIONS);
  }

  /**
   * Update ticket status
   *
   * @param ticketId - JIRA ticket ID (e.g., "PROJ-123")
   * @param status - Target status (e.g., "Deployed", "Failed")
   * @param comment - Optional comment to add
   * @returns {Promise<JiraUpdateResult>} Update result
   */
  async updateTicketStatus(
    ticketId: string,
    status: string,
    comment?: string
  ): Promise<JiraUpdateResult> {
    const operation = async (): Promise<JiraUpdateResult> => {
      try {
        logger.info(`Updating JIRA ticket ${ticketId} to status: ${status}`);

        // Get available transitions for this ticket
        const transitions = await this.client.issues.getTransitions({
          issueIdOrKey: ticketId,
        });

        // Find transition ID for target status
        const transition = transitions.transitions?.find(
          (t) => t.name?.toLowerCase() === status.toLowerCase()
        );

        if (!transition || !transition.id) {
          throw new Error(
            `No transition found for status "${status}" on ticket ${ticketId}`
          );
        }

        // Perform transition
        await this.client.issues.doTransition({
          issueIdOrKey: ticketId,
          transition: {
            id: transition.id,
          },
        });

        // Add comment if provided
        if (comment) {
          await this.client.issueComments.addComment({
            issueIdOrKey: ticketId,
            comment: comment,
          } as any);
        }

        logger.info(`Successfully updated JIRA ticket ${ticketId}`);

        return {
          ticket_id: ticketId,
          success: true,
          updated_at: new Date().toISOString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to update JIRA ticket ${ticketId}: ${message}`);

        return {
          ticket_id: ticketId,
          success: false,
          updated_at: new Date().toISOString(),
          error: message,
        };
      }
    };

    return retry(operation, JIRA_RETRY_OPTIONS);
  }

  /**
   * Bulk update ticket statuses
   *
   * @param ticketIds - Array of JIRA ticket IDs
   * @param status - Target status
   * @param comment - Optional comment to add to all tickets
   * @returns {Promise<JiraUpdateResult[]>} Array of update results
   */
  async bulkUpdateTicketStatus(
    ticketIds: string[],
    status: string,
    comment?: string
  ): Promise<JiraUpdateResult[]> {
    logger.info(`Bulk updating ${ticketIds.length} JIRA tickets to status: ${status}`);

    // Update tickets in parallel
    const updatePromises = ticketIds.map((ticketId) =>
      this.updateTicketStatus(ticketId, status, comment)
    );

    const results = await Promise.all(updatePromises);

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    logger.info(`Bulk update complete: ${successCount} succeeded, ${failureCount} failed`);

    return results;
  }

  /**
   * Get ticket details
   *
   * @param ticketId - JIRA ticket ID
   * @returns {Promise<JiraTicketWithPR>} Ticket details
   */
  async getTicket(ticketId: string): Promise<JiraTicketWithPR> {
    const operation = async (): Promise<JiraTicketWithPR> => {
      try {
        const issue = await this.client.issues.getIssue({
          issueIdOrKey: ticketId,
          fields: [
            'summary',
            'status',
            'fixVersions',
            'description',
            'customfield_10000',
          ],
        });

        const fixVersion = issue.fields.fixVersions?.[0]?.name;
        const prDetails = this.extractPRDetails(issue);

        return {
          id: issue.key,
          summary: issue.fields.summary || '',
          status: issue.fields.status?.name || '',
          fix_version: fixVersion,
          ...prDetails,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to get JIRA ticket ${ticketId}: ${message}`);
      }
    };

    return retry(operation, JIRA_RETRY_OPTIONS);
  }

  /**
   * Extract PR details from JIRA ticket
   *
   * Looks for PR URL in:
   * - Custom field (customfield_10000 - adjust based on your JIRA config)
   * - Description (pattern matching)
   *
   * @param issue - JIRA issue object
   * @returns PR details
   */
  private extractPRDetails(issue: any): {
    pr_url?: string;
    pr_id?: string;
    pr_owner_email?: string;
  } {
    // Try custom field first (adjust field ID as needed)
    const customFieldValue = issue.fields.customfield_10000;
    if (customFieldValue) {
      return this.parsePRDetails(customFieldValue);
    }

    // Try description
    const description = issue.fields.description?.content?.[0]?.content?.[0]?.text || '';
    const prUrlMatch = description.match(/https?:\/\/[^\s]+\/pull-requests\/\d+/i);

    if (prUrlMatch) {
      return this.parsePRDetails(prUrlMatch[0]);
    }

    return {};
  }

  /**
   * Parse PR details from URL or text
   *
   * @param text - Text containing PR information
   * @returns Parsed PR details
   */
  private parsePRDetails(text: string): {
    pr_url?: string;
    pr_id?: string;
    pr_owner_email?: string;
  } {
    const urlMatch = text.match(/https?:\/\/[^\s]+\/pull-requests\/(\d+)/i);

    if (urlMatch) {
      return {
        pr_url: urlMatch[0],
        pr_id: urlMatch[1],
        // pr_owner_email would need to be fetched from Git provider
      };
    }

    return {};
  }
}

/**
 * Create JIRA client from environment configuration
 *
 * @param config - JIRA configuration
 * @returns {JiraClient} Initialized JIRA client
 */
export function createJiraClient(config: JiraConfig): JiraClient {
  return new JiraClient(config);
}

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { logger } from '../utils/logger.js';
import { retry, TEAMS_RETRY_OPTIONS } from '../utils/retry.js';

/**
 * Microsoft Teams client configuration
 */
export interface TeamsConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  channelId: string; // Default Teams channel for announcements
}

/**
 * Teams notification message
 */
export interface TeamsMessage {
  recipient?: string; // User email for direct messages
  channelId?: string; // Channel ID for channel messages
  subject: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Teams notification result
 */
export interface TeamsNotificationResult {
  success: boolean;
  message_id?: string;
  sent_at: string;
  error?: string;
}

/**
 * Microsoft Teams API Client Factory
 *
 * Provides Microsoft Graph API integration for Teams with:
 * - OAuth 2.0 client credentials flow
 * - Direct messaging to users
 * - Channel message posting
 * - Adaptive card support
 */
export class TeamsClient {
  private graphClient: Client;
  private config: TeamsConfig;

  constructor(config: TeamsConfig) {
    this.config = config;

    // Create Azure credential
    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    );

    // Initialize Graph client with auth
    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const tokenResponse = await credential.getToken(
            'https://graph.microsoft.com/.default'
          );
          return tokenResponse?.token || '';
        },
      },
    });

    logger.info('Teams client initialized', {
      tenantId: config.tenantId,
      clientId: config.clientId,
    });
  }

  /**
   * Send direct message to user via Teams
   *
   * @param userEmail - User email address
   * @param subject - Message subject
   * @param message - Message body
   * @param severity - Message severity (affects formatting)
   * @returns {Promise<TeamsNotificationResult>} Notification result
   */
  async sendDirectMessage(
    userEmail: string,
    subject: string,
    message: string,
    severity: 'info' | 'warning' | 'critical' = 'info'
  ): Promise<TeamsNotificationResult> {
    const operation = async (): Promise<TeamsNotificationResult> => {
      try {
        logger.info(`Sending Teams message to: ${userEmail}`, { subject });

        // Get user ID from email
        const user = await this.graphClient
          .api('/users')
          .filter(`mail eq '${userEmail}'`)
          .select('id,displayName')
          .get();

        if (!user.value || user.value.length === 0) {
          throw new Error(`Teams user not found: ${userEmail}`);
        }

        const userId = user.value[0].id;

        // Create chat message with adaptive card
        const chatMessage = {
          body: {
            contentType: 'html',
            content: this.formatMessageWithSeverity(message, severity),
          },
          subject,
        };

        // Send message via Graph API
        const response = await this.graphClient
          .api(`/users/${userId}/chats`)
          .post(chatMessage);

        logger.info(`Teams message sent successfully to: ${userEmail}`);

        return {
          success: true,
          message_id: response.id,
          sent_at: new Date().toISOString(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to send Teams message to ${userEmail}: ${errorMessage}`);

        return {
          success: false,
          sent_at: new Date().toISOString(),
          error: errorMessage,
        };
      }
    };

    return retry(operation, TEAMS_RETRY_OPTIONS);
  }

  /**
   * Send message to Teams channel
   *
   * @param message - Message details
   * @returns {Promise<TeamsNotificationResult>} Notification result
   */
  async sendChannelMessage(
    message: TeamsMessage
  ): Promise<TeamsNotificationResult> {
    const operation = async (): Promise<TeamsNotificationResult> => {
      try {
        const channelId = message.channelId || this.config.channelId;

        logger.info(`Sending Teams channel message`, {
          channelId,
          subject: message.subject,
        });

        // Extract team ID and channel ID from channelId
        // Format: teamId:channelId or just channelId
        const [teamId, actualChannelId] = channelId.includes(':')
          ? channelId.split(':')
          : [channelId, channelId];

        // Create channel message
        const chatMessage = {
          body: {
            contentType: 'html',
            content: this.formatMessageWithSeverity(message.message, message.severity),
          },
          subject: message.subject,
        };

        // Post to channel
        const response = await this.graphClient
          .api(`/teams/${teamId}/channels/${actualChannelId}/messages`)
          .post(chatMessage);

        logger.info(`Teams channel message sent successfully`);

        return {
          success: true,
          message_id: response.id,
          sent_at: new Date().toISOString(),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to send Teams channel message: ${errorMessage}`);

        return {
          success: false,
          sent_at: new Date().toISOString(),
          error: errorMessage,
        };
      }
    };

    return retry(operation, TEAMS_RETRY_OPTIONS);
  }

  /**
   * Notify PR owner about conflict resolution needed
   *
   * @param prOwnerEmail - PR owner email
   * @param ticketId - JIRA ticket ID
   * @param prUrl - Pull request URL
   * @param conflictDetails - Conflict description
   * @returns {Promise<TeamsNotificationResult>} Notification result
   */
  async notifyPROwner(
    prOwnerEmail: string,
    ticketId: string,
    prUrl: string,
    conflictDetails: string
  ): Promise<TeamsNotificationResult> {
    const subject = `⚠️ Merge Conflict Detected: ${ticketId}`;
    const message = `
<h3>Merge Conflict Requires Your Attention</h3>
<p><strong>Ticket:</strong> ${ticketId}</p>
<p><strong>Pull Request:</strong> <a href="${prUrl}">${prUrl}</a></p>

<h4>Conflict Details:</h4>
<p>${conflictDetails}</p>

<h4>Next Steps:</h4>
<ol>
  <li>Review the conflicts in your pull request</li>
  <li>Resolve conflicts manually in your branch</li>
  <li>Push updated code to trigger re-validation</li>
</ol>

<p><em>This is an automated message from the Release Automation system.</em></p>
    `.trim();

    return this.sendDirectMessage(prOwnerEmail, subject, message, 'warning');
  }

  /**
   * Announce deployment completion to channel
   *
   * @param releaseVersion - Release version
   * @param environment - Environment name
   * @param status - Deployment status
   * @param summary - Deployment summary
   * @param channelId - Optional channel ID (uses default if not provided)
   * @returns {Promise<TeamsNotificationResult>} Notification result
   */
  async announceDeployment(
    releaseVersion: string,
    environment: string,
    status: 'success' | 'partial' | 'failed',
    summary: string,
    channelId?: string
  ): Promise<TeamsNotificationResult> {
    const emoji = status === 'success' ? '✅' : status === 'partial' ? '⚠️' : '❌';
    const severity = status === 'success' ? 'info' : status === 'partial' ? 'warning' : 'critical';

    const subject = `${emoji} Deployment ${status.toUpperCase()}: ${releaseVersion} → ${environment}`;
    const message = `
<h3>${emoji} Deployment ${status === 'success' ? 'Completed' : status === 'partial' ? 'Partially Completed' : 'Failed'}</h3>
<p><strong>Release Version:</strong> ${releaseVersion}</p>
<p><strong>Environment:</strong> ${environment}</p>
<p><strong>Status:</strong> ${status.toUpperCase()}</p>

<h4>Summary:</h4>
<p>${summary}</p>

<p><em>Timestamp: ${new Date().toISOString()}</em></p>
    `.trim();

    return this.sendChannelMessage({
      channelId,
      subject,
      message,
      severity,
    });
  }

  /**
   * Format message with severity-based styling
   *
   * @param message - Message content
   * @param severity - Message severity
   * @returns Formatted HTML message
   */
  private formatMessageWithSeverity(
    message: string,
    severity: 'info' | 'warning' | 'critical'
  ): string {
    const colors = {
      info: '#0078D4', // Blue
      warning: '#FF8C00', // Orange
      critical: '#D13438', // Red
    };

    const color = colors[severity];

    return `
<div style="border-left: 4px solid ${color}; padding-left: 12px;">
  ${message}
</div>
    `.trim();
  }

  /**
   * Get user by email
   *
   * @param email - User email address
   * @returns User details
   */
  async getUserByEmail(email: string): Promise<{
    id: string;
    displayName: string;
    email: string;
  } | null> {
    try {
      const response = await this.graphClient
        .api('/users')
        .filter(`mail eq '${email}'`)
        .select('id,displayName,mail')
        .get();

      if (response.value && response.value.length > 0) {
        const user = response.value[0];
        return {
          id: user.id,
          displayName: user.displayName,
          email: user.mail,
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get user by email: ${email}`);
      return null;
    }
  }
}

/**
 * Create Teams client from environment configuration
 *
 * @param config - Teams configuration
 * @returns {TeamsClient} Initialized Teams client
 */
export function createTeamsClient(config: TeamsConfig): TeamsClient {
  return new TeamsClient(config);
}

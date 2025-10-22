/**
 * Teams Announce Deployment MCP Tool
 *
 * T050: Implement teams_announce_deployment MCP tool
 *
 * Sends deployment announcement to Teams channel with adaptive card.
 * Includes release version, environment, tenant status, cache status, duration.
 * Uses Microsoft Graph API for Teams messaging.
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for teams_announce_deployment tool
 */
export const AnnounceDeploymentInputSchema = z.object({
  release_version: z.string().describe('Release version'),
  target_environment: z.string().describe('Target environment name'),
  summary: z.object({
    ticket_count: z.number(),
    duration_minutes: z.number(),
    successful_tenants: z.array(z.string()),
    failed_tenants: z.array(z.string()),
    cache_cleared_count: z.number(),
    total_tenants: z.number(),
  }).describe('Deployment summary statistics'),
  channel_id: z.string().optional().describe('Teams channel ID (uses default if not provided)'),
});

export type AnnounceDeploymentInput = z.infer<typeof AnnounceDeploymentInputSchema>;

/**
 * Output schema for teams_announce_deployment tool
 */
export const AnnounceDeploymentOutputSchema = z.object({
  message_id: z.string(),
  delivered: z.boolean(),
  channel_id: z.string(),
});

export type AnnounceDeploymentOutput = z.infer<typeof AnnounceDeploymentOutputSchema>;

/**
 * Announce deployment to Teams
 */
export async function announceDeployment(
  input: AnnounceDeploymentInput,
  graphClient: Client,
  releaseId?: string
): Promise<AnnounceDeploymentOutput> {
  const startTime = Date.now();
  const actor = 'system';

  try {
    const channelId = input.channel_id || process.env.TEAMS_DEPLOYMENT_CHANNEL_ID!;
    const teamId = process.env.TEAMS_TEAM_ID!;

    logger.info('Announcing deployment to Teams', {
      release_version: input.release_version,
      environment: input.target_environment,
      channel_id: channelId,
    });

    // Build adaptive card
    const adaptiveCard = buildDeploymentCard(input);

    // Build Teams message
    const success = input.summary.failed_tenants.length === 0;
    const messageText = success
      ? `🚀 Deployment Complete: ${input.release_version} to ${input.target_environment}`
      : `⚠️ Deployment Completed with Failures: ${input.release_version} to ${input.target_environment}`;

    const message = {
      body: {
        contentType: 'html',
        content: messageText,
      },
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: adaptiveCard,
        },
      ],
    };

    // Send message to Teams channel
    const response = await graphClient
      .api(`/teams/${teamId}/channels/${channelId}/messages`)
      .post(message);

    const output: AnnounceDeploymentOutput = {
      message_id: response.id,
      delivered: true,
      channel_id: channelId,
    };

    // Log notification sent audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.createNotificationSent(
        releaseId,
        actor,
        {
          notification_type: 'deployment_complete',
          recipient: channelId,
          teams_message_id: response.id,
        }
      );
      await auditLogger.log(auditEvent);
    }

    logger.info('Deployment announcement sent', {
      message_id: response.id,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to announce deployment', {
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Build adaptive card for deployment announcement
 */
function buildDeploymentCard(input: AnnounceDeploymentInput): any {
  const success = input.summary.failed_tenants.length === 0;

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: success ? '🚀 Deployment Complete' : '⚠️ Deployment Completed with Failures',
        weight: 'Bolder',
        size: 'Large',
        color: success ? 'Good' : 'Warning',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Release Version', value: input.release_version },
          { title: 'Environment', value: input.target_environment },
          { title: 'Tickets Deployed', value: input.summary.ticket_count.toString() },
          { title: 'Duration', value: `${input.summary.duration_minutes} minutes` },
          {
            title: 'Successful Tenants',
            value: input.summary.successful_tenants.length > 0
              ? input.summary.successful_tenants.join(', ')
              : 'None',
          },
          {
            title: 'Failed Tenants',
            value: input.summary.failed_tenants.length > 0
              ? input.summary.failed_tenants.join(', ')
              : 'None',
          },
          {
            title: 'Cache Clearing',
            value: `${input.summary.cache_cleared_count}/${input.summary.total_tenants} tenants`,
          },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: process.env.DASHBOARD_URL || 'http://localhost:3001',
      },
    ],
  };
}

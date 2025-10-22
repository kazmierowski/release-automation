import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { loadEnvironmentConfig } from './config/environment.js';

/**
 * Release Automation MCP Server
 *
 * Exposes 11 MCP tools for automated release deployment orchestration
 * integrating with Bitbucket, Jenkins, JIRA, and Microsoft Teams.
 *
 * Architecture:
 * - MCP-first design: All automation via versioned MCP tools
 * - Provider abstraction: Git (Bitbucket/GitHub/GitLab), Secrets (Azure KV/Vault/AWS)
 * - Multi-tenant: Parallel Jenkins deployment across tenants
 * - GitFlow compliance: Squash merge feature→dev, full history dev→release
 *
 * Constitution Principles:
 * I.   Automated Conflict Resolution (95% confidence threshold)
 * II.  GitFlow Compliance (2 approvals, squash merge, PROD restrictions)
 * III. Multi-Tenant Orchestration (parallel deployment, isolation)
 * IV.  AI Agent Communication (severity-calibrated, context-aware)
 * V.   End-to-End Observability (audit trail, real-time dashboard)
 * VI.  MCP-First Architecture (no direct AI-to-system integration)
 */

class ReleaseAutomationServer {
  private server: Server;
  private config: ReturnType<typeof loadEnvironmentConfig>;

  constructor() {
    this.server = new Server(
      {
        name: 'release-automation-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Load configuration
    this.config = loadEnvironmentConfig();

    // Setup request handlers
    this.setupHandlers();

    // Setup error handlers
    this.setupErrorHandlers();
  }

  /**
   * Register MCP protocol request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('Received list_tools request');

      return {
        tools: [
          {
            name: 'jira_get_release_tickets',
            description:
              'Fetches all JIRA tickets tagged for a specific release version with PR information, approval status, and merge status',
            inputSchema: {
              type: 'object',
              properties: {
                release_version: {
                  type: 'string',
                  description:
                    "Release version identifier (e.g., 'v1.2.0' or 'hotfix/v1.1.1')",
                  pattern: '^(v\\d+\\.\\d+\\.\\d+|hotfix/v\\d+\\.\\d+\\.\\d+)$',
                },
                include_pr_details: {
                  type: 'boolean',
                  description:
                    'Whether to fetch detailed PR information including approvals and conflicts',
                  default: true,
                },
              },
              required: ['release_version'],
            },
          },
          {
            name: 'git_check_pr_approvals',
            description:
              'Checks if a pull request has minimum required approvals (default: 2) for merge',
            inputSchema: {
              type: 'object',
              properties: {
                pr_id: {
                  type: 'string',
                  description:
                    'Pull request ID in platform-specific format (e.g., Bitbucket PR number)',
                },
                repository: {
                  type: 'string',
                  description: "Repository identifier (e.g., 'project/repo')",
                },
                min_approvals: {
                  type: 'number',
                  description: 'Minimum required approvals (default: 2)',
                  default: 2,
                },
              },
              required: ['pr_id', 'repository'],
            },
          },
          {
            name: 'git_merge_tickets_to_development',
            description:
              'Merges all approved PRs for tickets to development branch using squash strategy with [TICKET-ID] Summary format',
            inputSchema: {
              type: 'object',
              properties: {
                tickets: {
                  type: 'array',
                  description: 'Array of ticket objects to merge',
                  items: {
                    type: 'object',
                    properties: {
                      ticket_id: { type: 'string' },
                      pr_id: { type: 'string' },
                      summary: { type: 'string' },
                    },
                    required: ['ticket_id', 'pr_id', 'summary'],
                  },
                },
                target_branch: {
                  type: 'string',
                  description: 'Target branch (default: development)',
                  default: 'development',
                },
              },
              required: ['tickets'],
            },
          },
          {
            name: 'git_create_release_branch',
            description:
              'Creates a release branch (release/vX.Y.Z or hotfix/vX.Y.Z) from development or main',
            inputSchema: {
              type: 'object',
              properties: {
                release_version: {
                  type: 'string',
                  description: "Release version (e.g., 'v1.2.0')",
                  pattern: '^v\\d+\\.\\d+\\.\\d+$',
                },
                source_branch: {
                  type: 'string',
                  description:
                    'Source branch (default: development for regular releases, main for hotfixes)',
                },
                release_type: {
                  type: 'string',
                  description: 'Release type: regular or hotfix',
                  enum: ['regular', 'hotfix'],
                  default: 'regular',
                },
              },
              required: ['release_version'],
            },
          },
          {
            name: 'jenkins_trigger_deployment',
            description:
              'Triggers Jenkins deployment job for a specific tenant and environment',
            inputSchema: {
              type: 'object',
              properties: {
                tenant_id: {
                  type: 'string',
                  description: 'Tenant identifier',
                },
                environment: {
                  type: 'string',
                  description: 'Target environment',
                  enum: ['Integration', 'UAT', 'UAT1', 'PROD'],
                },
                release_version: {
                  type: 'string',
                  description: 'Release version to deploy',
                },
                release_type: {
                  type: 'string',
                  description: 'Release type for environment validation',
                  enum: ['regular', 'hotfix'],
                },
              },
              required: [
                'tenant_id',
                'environment',
                'release_version',
                'release_type',
              ],
            },
          },
          {
            name: 'jenkins_get_job_status',
            description:
              'Polls Jenkins job status for a specific build, includes cache clear status as reported by Jenkins',
            inputSchema: {
              type: 'object',
              properties: {
                tenant_id: {
                  type: 'string',
                  description: 'Tenant identifier',
                },
                environment: {
                  type: 'string',
                  description: 'Environment name',
                },
                build_number: {
                  type: 'number',
                  description: 'Jenkins build number',
                },
              },
              required: ['tenant_id', 'environment', 'build_number'],
            },
          },
          {
            name: 'jenkins_rollback_tenant',
            description:
              'Triggers rollback to previous version for a specific tenant',
            inputSchema: {
              type: 'object',
              properties: {
                tenant_id: {
                  type: 'string',
                  description: 'Tenant identifier',
                },
                environment: {
                  type: 'string',
                  description: 'Environment to rollback',
                },
                target_version: {
                  type: 'string',
                  description: 'Version to rollback to',
                },
              },
              required: ['tenant_id', 'environment', 'target_version'],
            },
          },
          {
            name: 'jira_update_ticket_status',
            description:
              'Updates JIRA ticket status (e.g., "Deployed", "Failed") and adds deployment comment',
            inputSchema: {
              type: 'object',
              properties: {
                ticket_ids: {
                  type: 'array',
                  description: 'Array of JIRA ticket IDs',
                  items: { type: 'string' },
                },
                status: {
                  type: 'string',
                  description: 'Target status',
                },
                comment: {
                  type: 'string',
                  description: 'Deployment comment to add',
                },
              },
              required: ['ticket_ids', 'status'],
            },
          },
          {
            name: 'teams_notify_pr_owner',
            description:
              'Sends Teams notification to PR owner for manual conflict resolution',
            inputSchema: {
              type: 'object',
              properties: {
                pr_owner_email: {
                  type: 'string',
                  description: 'PR owner email address',
                },
                ticket_id: {
                  type: 'string',
                  description: 'JIRA ticket ID',
                },
                pr_url: {
                  type: 'string',
                  description: 'Pull request URL',
                },
                conflict_details: {
                  type: 'string',
                  description: 'Conflict description',
                },
              },
              required: [
                'pr_owner_email',
                'ticket_id',
                'pr_url',
                'conflict_details',
              ],
            },
          },
          {
            name: 'teams_announce_deployment',
            description:
              'Announces deployment completion or failure to Teams channel',
            inputSchema: {
              type: 'object',
              properties: {
                release_version: {
                  type: 'string',
                  description: 'Release version',
                },
                environment: {
                  type: 'string',
                  description: 'Environment name',
                },
                status: {
                  type: 'string',
                  description: 'Deployment status',
                  enum: ['success', 'partial', 'failed'],
                },
                summary: {
                  type: 'string',
                  description: 'Deployment summary message',
                },
              },
              required: ['release_version', 'environment', 'status', 'summary'],
            },
          },
          {
            name: 'trigger_release_deployment',
            description:
              'Orchestrates complete release deployment workflow (merge → branch → deploy → notify)',
            inputSchema: {
              type: 'object',
              properties: {
                release_version: {
                  type: 'string',
                  description: 'Release version',
                  pattern: '^v\\d+\\.\\d+\\.\\d+$',
                },
                environment: {
                  type: 'string',
                  description: 'Target environment (default from .env)',
                  enum: ['Integration', 'UAT', 'UAT1', 'PROD'],
                },
                release_type: {
                  type: 'string',
                  description: 'Release type',
                  enum: ['regular', 'hotfix'],
                  default: 'regular',
                },
              },
              required: ['release_version'],
            },
          },
        ],
      };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.info(`Received tool call: ${request.params.name}`);

      try {
        // Tool implementations will be added in subsequent tasks
        return {
          content: [
            {
              type: 'text',
              text: `Tool ${request.params.name} not yet implemented`,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Tool ${request.params.name} failed: ${errorMessage}`);

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    logger.info('Starting Release Automation MCP Server v1.0.0');
    logger.info(`Default environment: ${this.config.DEFAULT_ENVIRONMENT}`);
    logger.info(`Git platform: ${this.config.GIT_PLATFORM}`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('MCP Server started successfully - awaiting requests');
  }
}

// Bootstrap server
const server = new ReleaseAutomationServer();
server.start().catch((error) => {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
});

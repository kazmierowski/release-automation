/**
 * TypeScript type definitions for Release Automation data model entities
 *
 * Based on: specs/001-release-automation-mcp/data-model.md
 * All entities align with MCP tool schemas and monitoring dashboard requirements
 */

/**
 * Release type enum
 */
export type ReleaseType = 'regular' | 'hotfix';

/**
 * Environment enum
 */
export type EnvironmentName = 'Integration' | 'UAT' | 'UAT1' | 'PROD';

/**
 * Release status enum with state machine transitions
 */
export type ReleaseStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'partially_completed'
  | 'blocked';

/**
 * Merge status enum
 */
export type MergeStatus = 'pending' | 'merged' | 'blocked' | 'failed';

/**
 * Merge strategy enum
 */
export type MergeStrategy = 'squash' | 'merge';

/**
 * Deployment status enum
 */
export type DeploymentStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Cache clear status enum (tracked, not executed by MCP server)
 */
export type CacheClearStatus = 'cleared' | 'skipped' | 'failed' | 'in_progress';

/**
 * Notification severity enum
 */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

/**
 * Notification type enum
 */
export type NotificationType =
  | 'approval_needed'
  | 'conflict_detected'
  | 'deployment_complete'
  | 'deployment_failed'
  | 'rollback_initiated';

/**
 * 1. Release Entity
 *
 * Represents a deployment bundle with associated tickets,
 * target environment, and deployment status
 */
export interface Release {
  id: string; // UUID v4
  version: string; // e.g., "v1.2.0" or "hotfix/v1.1.1"
  release_type: ReleaseType;
  target_environment: EnvironmentName;
  ticket_ids: string[]; // JIRA ticket IDs
  tenant_ids: string[]; // Tenant identifiers
  status: ReleaseStatus;
  created_at: string; // ISO 8601 UTC
  created_by: string; // Email or system identifier
  started_at?: string; // ISO 8601 UTC
  completed_at?: string; // ISO 8601 UTC
  audit_trail: AuditEvent[];
  error_message?: string; // Max 500 chars
}

/**
 * 2. Environment Entity
 *
 * Represents a deployment target environment with configuration
 */
export interface Environment {
  name: EnvironmentName;
  display_name: string; // Max 50 chars
  is_default: boolean;
  allowed_release_types: ReleaseType[];
  tenant_configurations: TenantConfiguration[];
  git_base_url: string;
  jenkins_base_url: string;
  jira_base_url: string;
}

/**
 * 3. TenantConfiguration Entity
 *
 * Represents environment-specific configuration for a single tenant
 */
export interface TenantConfiguration {
  tenant_id: string; // Alphanumeric, lowercase, hyphens
  environment_name: EnvironmentName;
  jenkins_job_name: string;
  jenkins_job_parameters?: Record<string, string | number | boolean>;
  cache_endpoint?: string; // Deprecated - handled by Jenkins
}

/**
 * 4. Ticket Entity
 *
 * Represents a JIRA ticket with associated pull request information
 */
export interface Ticket {
  id: string; // JIRA pattern (e.g., "PROJ-123")
  summary: string; // Max 255 chars
  pr_id: string;
  pr_url: string;
  pr_owner_email: string;
  approval_count: number; // >= 0
  required_approvals: number; // Default: 2
  approved: boolean; // approval_count >= required_approvals
  approvers: string[];
  potential_reviewers?: string[];
  merge_status: MergeStatus;
  merge_commit_sha?: string;
  merge_strategy?: MergeStrategy;
  squash_commit_message?: string; // Format: "[TICKET-ID] Summary"
  conflicts_detected: boolean;
  conflict_details?: ConflictInfo;
}

/**
 * 5. ConflictInfo Entity
 *
 * Represents merge conflict details for a ticket's pull request
 */
export interface ConflictInfo {
  ticket_id: string; // JIRA pattern
  conflicted_files: string[]; // Non-empty array
  conflict_analysis?: ConflictAnalysis;
  resolution_suggestion?: string; // Max 500 chars
  escalated_at?: string; // ISO 8601 UTC
  resolved_at?: string; // ISO 8601 UTC
}

/**
 * 6. ConflictAnalysis Entity
 *
 * Represents AI-powered conflict analysis results
 */
export interface ConflictAnalysis {
  confidence_score: number; // 0.0 to 100.0
  recommended_resolution?: string; // Max 10,000 chars
  reasoning: string; // Max 1,000 chars
  risk_factors: string[]; // Each max 200 chars
  should_escalate: boolean; // confidence_score < 95.0
}

/**
 * 7. Tenant Entity
 *
 * Represents a platform tenant with deployment configuration
 */
export interface Tenant {
  id: string; // Alphanumeric, lowercase, hyphens
  display_name: string; // Max 100 chars
  description?: string; // Max 500 chars
  active: boolean; // Default: true
  rollback_supported: boolean; // Default: true
}

/**
 * 8. Deployment Entity
 *
 * Represents a Jenkins deployment job for a specific tenant and release
 */
export interface Deployment {
  id: string; // UUID v4
  release_id: string; // UUID v4
  tenant_id: string;
  environment_name: EnvironmentName;
  jenkins_job_name: string;
  jenkins_queue_id?: number;
  jenkins_build_number?: number;
  jenkins_job_url?: string;
  status: DeploymentStatus;
  started_at?: string; // ISO 8601 UTC
  completed_at?: string; // ISO 8601 UTC
  duration_ms?: number; // >= 0
  error_message?: string; // Max 1,000 chars
  console_output_tail?: string; // Max 5,000 chars
  cache_clear_status?: CacheClearStatus; // Tracked from Jenkins
  retry_count: number; // Default: 0, max: 1
}

/**
 * 9. MCPTool Entity
 *
 * Represents an MCP tool definition with execution metrics
 */
export interface MCPTool {
  name: string; // snake_case (e.g., "jira_get_release_tickets")
  version: string; // Semantic version (e.g., "1.0.0")
  description: string;
  idempotent: boolean;
  input_schema: Record<string, unknown>; // JSON Schema
  output_schema: Record<string, unknown>; // JSON Schema
  error_codes: ErrorCodeDefinition[];
  execution_count: number; // Total executions
  success_count: number; // Successful executions
  failure_count: number; // Failed executions
  avg_duration_ms: number; // Average execution time
  last_executed_at?: string; // ISO 8601 UTC
}

/**
 * Error code definition for MCP tools
 */
export interface ErrorCodeDefinition {
  code: string; // e.g., "ERR_PR_NOT_APPROVED"
  message: string; // Human-readable error message
  retryable: boolean;
  http_status: number; // HTTP status code equivalent
}

/**
 * 10. WorkflowExecution Entity
 *
 * Represents n8n workflow execution state for a release
 */
export interface WorkflowExecution {
  id: string; // UUID v4
  release_id: string; // UUID v4
  workflow_id: string; // n8n workflow ID
  execution_id: string; // n8n execution ID
  status: WorkflowExecutionStatus;
  started_at: string; // ISO 8601 UTC
  completed_at?: string; // ISO 8601 UTC
  duration_ms?: number; // >= 0
  current_phase: WorkflowPhase;
  phases_completed: WorkflowPhase[];
  error_message?: string; // Max 1,000 chars
  input_data: Record<string, unknown>; // n8n workflow input
  output_data?: Record<string, unknown>; // n8n workflow output
}

/**
 * Workflow execution status enum
 */
export type WorkflowExecutionStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting'
  | 'cancelled';

/**
 * Workflow phase enum
 */
export type WorkflowPhase =
  | 'merge'
  | 'branch_creation'
  | 'deployment'
  | 'jira_update'
  | 'notification';

/**
 * 11. Notification Entity
 *
 * Represents a Teams notification sent during deployment workflow
 */
export interface Notification {
  id: string; // UUID v4
  release_id: string; // UUID v4
  type: NotificationType;
  severity: NotificationSeverity;
  recipient_email: string;
  channel_id?: string; // Teams channel ID
  subject: string; // Max 200 chars
  message: string; // Max 2,000 chars
  sent_at: string; // ISO 8601 UTC
  delivery_status: NotificationDeliveryStatus;
  teams_message_id?: string; // Microsoft Teams message ID
  error_message?: string; // Max 500 chars
}

/**
 * Notification delivery status enum
 */
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'retrying';

/**
 * 12. AuditEvent Entity
 *
 * Represents an audit trail event for compliance and debugging
 */
export interface AuditEvent {
  id: string; // UUID v4
  release_id: string; // UUID v4
  timestamp: string; // ISO 8601 UTC
  event_type: AuditEventType;
  actor: string; // User email, system identifier, or "n8n-workflow"
  action: string; // Max 100 chars (e.g., "PR merged", "Deployment triggered")
  resource_type: string; // e.g., "release", "deployment", "ticket"
  resource_id: string; // ID of affected resource
  details: Record<string, unknown>; // Structured event data
  status: 'success' | 'failure' | 'in_progress';
  error_message?: string; // Max 500 chars
}

/**
 * Audit event type enum
 */
export type AuditEventType =
  | 'release_created'
  | 'release_started'
  | 'release_completed'
  | 'release_failed'
  | 'pr_approved'
  | 'pr_merged'
  | 'conflict_detected'
  | 'conflict_escalated'
  | 'branch_created'
  | 'deployment_triggered'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'rollback_initiated'
  | 'rollback_completed'
  | 'jira_updated'
  | 'notification_sent';

/**
 * Helper: Create new Release entity with defaults
 */
export function createRelease(
  partial: Partial<Release> & Pick<Release, 'version' | 'release_type' | 'target_environment' | 'ticket_ids' | 'tenant_ids' | 'created_by'>
): Release {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    created_at: new Date().toISOString(),
    audit_trail: [],
    ...partial,
  };
}

/**
 * Helper: Create new Deployment entity with defaults
 */
export function createDeployment(
  partial: Partial<Deployment> & Pick<Deployment, 'release_id' | 'tenant_id' | 'environment_name' | 'jenkins_job_name'>
): Deployment {
  return {
    id: crypto.randomUUID(),
    status: 'queued',
    retry_count: 0,
    ...partial,
  };
}

/**
 * Helper: Create new AuditEvent entity
 */
export function createAuditEvent(
  releaseId: string,
  eventType: AuditEventType,
  actor: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  status: 'success' | 'failure' | 'in_progress' = 'success'
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    release_id: releaseId,
    timestamp: new Date().toISOString(),
    event_type: eventType,
    actor,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    status,
  };
}

/**
 * Helper: Validate release type for environment (Constitution II)
 */
export function validateReleaseTypeForEnvironment(
  releaseType: ReleaseType,
  environment: EnvironmentName
): { valid: boolean; error?: string } {
  // Regular releases MUST NOT deploy to PROD
  if (releaseType === 'regular' && environment === 'PROD') {
    return {
      valid: false,
      error: 'Regular releases are not allowed for PROD environment. Only hotfix releases can deploy to PROD (Constitution II).',
    };
  }

  return { valid: true };
}

/**
 * Helper: Check if deployment can retry
 */
export function canRetryDeployment(deployment: Deployment): boolean {
  return deployment.retry_count < 1 && deployment.status === 'failed';
}

/**
 * Helper: Calculate deployment duration
 */
export function calculateDeploymentDuration(deployment: Deployment): number | undefined {
  if (!deployment.started_at || !deployment.completed_at) {
    return undefined;
  }

  const start = new Date(deployment.started_at).getTime();
  const end = new Date(deployment.completed_at).getTime();

  return end - start;
}

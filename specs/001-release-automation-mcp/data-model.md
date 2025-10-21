# Data Model: Release Automation MCP Server

**Feature**: Release Automation MCP Server
**Date**: 2025-10-19
**Phase**: 1 (Design & Contracts)

## Overview

This document defines all entities, their fields, relationships, validation rules, and state transitions for the release automation system. The data model is designed to support MCP tool operations, n8n workflow state persistence, and monitoring dashboard visualization.

---

## Entity Definitions

### 1. Release

Represents a deployment bundle with associated tickets, target environment, and deployment status.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string (UUID) | Yes | Unique release identifier | UUID v4 format |
| `version` | string | Yes | Release version number | Semantic versioning (e.g., `v1.2.0`) or hotfix pattern (e.g., `hotfix/v1.1.1`) |
| `release_type` | enum | Yes | Type of release | `regular` or `hotfix` |
| `target_environment` | enum | Yes | Deployment target environment | `Integration`, `UAT`, `UAT1`, or `PROD` |
| `ticket_ids` | string[] | Yes | JIRA ticket IDs included in this release | Non-empty array, each element matches JIRA ticket pattern (e.g., `PROJ-123`) |
| `tenant_ids` | string[] | Yes | Target tenant IDs for deployment | Non-empty array, each element exists in tenant manifest |
| `status` | enum | Yes | Current deployment status | See state machine below |
| `created_at` | timestamp (ISO 8601) | Yes | Release creation timestamp | UTC timezone |
| `created_by` | string | Yes | User or system that triggered release | Email or system identifier |
| `started_at` | timestamp (ISO 8601) | No | Deployment start timestamp | UTC timezone, set when status → `in_progress` |
| `completed_at` | timestamp (ISO 8601) | No | Deployment completion timestamp | UTC timezone, set when status → `completed` or `failed` |
| `audit_trail` | AuditEvent[] | Yes | List of all events for this release | See AuditEvent entity |
| `error_message` | string | No | Error description if deployment failed | Max 500 characters |

**Validation Rules**:
- If `release_type = regular`, `target_environment` MUST NOT be `PROD`
- If `release_type = hotfix`, `target_environment` can be any value
- `target_environment` must match default from `.env` or be explicitly provided
- `ticket_ids` must all have approved PRs with >= 2 approvals before merge phase
- `tenant_ids` must exist in tenant manifest for the specified `target_environment`

**State Machine**:

```
pending → in_progress → completed
                     ↘ failed
                     ↘ partially_completed (some tenants failed)
                     ↘ blocked (waiting for approvals or conflict resolution)
```

**State Transitions**:
- `pending → in_progress`: When n8n workflow starts merge phase
- `in_progress → blocked`: When PR approvals < 2 or conflicts detected
- `blocked → in_progress`: When approvals obtained or conflicts resolved
- `in_progress → completed`: When all tenants deployed successfully
- `in_progress → partially_completed`: When some tenants deployed, some failed
- `in_progress → failed`: When all tenants failed or workflow error occurred

**Relationships**:
- **Has Many** Tickets (via `ticket_ids`)
- **Has Many** Tenants (via `tenant_ids`)
- **Has Many** Deployments (one per tenant)
- **Has Many** AuditEvents

---

### 2. Environment

Represents a deployment target environment with configuration for tenants and Jenkins jobs.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `name` | enum | Yes | Environment identifier | `Integration`, `UAT`, `UAT1`, or `PROD` |
| `display_name` | string | Yes | Human-readable name | Max 50 characters |
| `is_default` | boolean | Yes | Whether this is the default environment from `.env` | Only one environment can be default |
| `allowed_release_types` | enum[] | Yes | Release types permitted in this environment | `regular` and/or `hotfix` |
| `tenant_configurations` | TenantConfiguration[] | Yes | Per-tenant Jenkins job mappings | Non-empty array |
| `git_base_url` | string | Yes | Git platform base URL for this environment | Valid URL |
| `jenkins_base_url` | string | Yes | Jenkins base URL for this environment | Valid URL |
| `jira_base_url` | string | Yes | JIRA base URL | Valid URL |

**Validation Rules**:
- `PROD` environment: `allowed_release_types` MUST include only `hotfix`
- Non-PROD environments: `allowed_release_types` MUST include `regular` and MAY include `hotfix`
- Each tenant in `tenant_configurations` must have unique `tenant_id`

**Relationships**:
- **Has Many** TenantConfigurations

---

### 3. TenantConfiguration

Represents environment-specific configuration for a single tenant.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `tenant_id` | string | Yes | Unique tenant identifier | Alphanumeric, lowercase, hyphens allowed (e.g., `tenant-a`) |
| `environment_name` | enum | Yes | Associated environment | `Integration`, `UAT`, `UAT1`, or `PROD` |
| `jenkins_job_name` | string | Yes | Jenkins job name for this tenant + environment | Non-empty string |
| `jenkins_job_parameters` | object | No | Additional Jenkins job parameters | Key-value pairs |
| `cache_endpoint` | string | No | Cache invalidation endpoint (if applicable) | Valid URL (deprecated - handled by Jenkins job) |

**Validation Rules**:
- `tenant_id` + `environment_name` must be unique (composite key)
- `jenkins_job_name` must exist in Jenkins instance

**Relationships**:
- **Belongs To** Environment
- **Has Many** Deployments (across different releases)

---

### 4. Ticket

Represents a JIRA ticket with associated pull request information.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string | Yes | JIRA ticket ID (key) | Matches JIRA pattern (e.g., `PROJ-123`) |
| `summary` | string | Yes | Ticket summary/title | Max 255 characters |
| `pr_id` | string | Yes | Pull request ID or number | Non-empty string |
| `pr_url` | string | Yes | Full URL to pull request | Valid URL |
| `pr_owner_email` | string | Yes | Email of PR author | Valid email format |
| `approval_count` | integer | Yes | Current number of PR approvals | >= 0 |
| `required_approvals` | integer | Yes | Required approval count | Default: 2 |
| `approved` | boolean | Yes | Whether PR meets approval threshold | `approval_count >= required_approvals` |
| `approvers` | string[] | Yes | List of approver names | Can be empty array |
| `potential_reviewers` | string[] | No | Suggested reviewers if approvals insufficient | Empty if `approved = true` |
| `merge_status` | enum | Yes | Merge status | `pending`, `merged`, `blocked`, `failed` |
| `merge_commit_sha` | string | No | Commit SHA after successful merge | Set when `merge_status = merged` |
| `merge_strategy` | enum | No | Merge strategy used | `squash` or `merge` |
| `squash_commit_message` | string | No | Commit message for squash merge | Required if `merge_strategy = squash`, format: `[TICKET-ID] Summary` |
| `conflicts_detected` | boolean | Yes | Whether merge conflicts exist | Default: false |
| `conflict_details` | ConflictInfo | No | Conflict information if detected | Set when `conflicts_detected = true` |

**Validation Rules**:
- `approval_count` must be <= total number of team members
- If `merge_status = merged`, `merge_commit_sha` MUST be set
- If `merge_strategy = squash`, `squash_commit_message` MUST match format `[{ticket_id}] {summary}`
- If `conflicts_detected = true`, `conflict_details` MUST be provided

**Relationships**:
- **Belongs To** Release (via `ticket_ids` in Release)
- **Has One** ConflictInfo (optional)

---

### 5. ConflictInfo

Represents merge conflict details for a ticket's pull request.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `ticket_id` | string | Yes | Associated JIRA ticket ID | Matches JIRA pattern |
| `conflicted_files` | string[] | Yes | List of file paths with conflicts | Non-empty array |
| `conflict_analysis` | ConflictAnalysis | No | AI analysis of conflicts | Set when auto-resolution attempted |
| `resolution_suggestion` | string | No | Suggested resolution approach | Max 500 characters |
| `escalated_at` | timestamp (ISO 8601) | No | When conflict was escalated to PR owner | UTC timezone |
| `resolved_at` | timestamp (ISO 8601) | No | When conflict was manually resolved | UTC timezone |

**Validation Rules**:
- `conflicted_files` must be non-empty
- If `escalated_at` is set, `resolved_at` must be later or null

**Relationships**:
- **Belongs To** Ticket

---

### 6. ConflictAnalysis

Represents AI-powered conflict analysis results.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `confidence_score` | float | Yes | AI confidence in auto-resolution safety (0-100) | 0.0 to 100.0 |
| `recommended_resolution` | string | No | Auto-resolved content if confidence >= 95% | Max 10,000 characters |
| `reasoning` | string | Yes | AI explanation for decision | Max 1,000 characters |
| `risk_factors` | string[] | Yes | Identified risk factors (can be empty) | Each max 200 characters |
| `should_escalate` | boolean | Yes | Whether to escalate to human (confidence < 95%) | Computed: `confidence_score < 95.0` |

**Validation Rules**:
- If `confidence_score >= 95.0`, `recommended_resolution` MUST be provided
- If `should_escalate = true`, `recommended_resolution` should be null

**Relationships**:
- **Belongs To** ConflictInfo

---

### 7. Tenant

Represents a platform tenant with deployment configuration.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string | Yes | Unique tenant identifier | Alphanumeric, lowercase, hyphens allowed |
| `display_name` | string | Yes | Human-readable tenant name | Max 100 characters |
| `description` | string | No | Tenant description | Max 500 characters |
| `active` | boolean | Yes | Whether tenant is active for deployments | Default: true |
| `rollback_supported` | boolean | Yes | Whether tenant supports automated rollback | Default: true |

**Validation Rules**:
- `id` must be unique across all tenants
- Inactive tenants (`active = false`) should not be included in new deployments

**Relationships**:
- **Has Many** TenantConfigurations (one per environment)
- **Has Many** Deployments (across different releases)

---

### 8. Deployment

Represents a Jenkins deployment job for a specific tenant and release.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string (UUID) | Yes | Unique deployment identifier | UUID v4 format |
| `release_id` | string (UUID) | Yes | Associated release ID | Foreign key to Release |
| `tenant_id` | string | Yes | Target tenant ID | Foreign key to Tenant |
| `environment_name` | enum | Yes | Deployment environment | `Integration`, `UAT`, `UAT1`, or `PROD` |
| `jenkins_job_name` | string | Yes | Jenkins job name | From tenant configuration |
| `jenkins_queue_id` | integer | No | Jenkins queue item ID | Set when job triggered |
| `jenkins_build_number` | integer | No | Jenkins build number | Set when job starts executing |
| `jenkins_job_url` | string | No | URL to Jenkins job console | Valid URL |
| `status` | enum | Yes | Deployment status | See state machine below |
| `started_at` | timestamp (ISO 8601) | No | Job start timestamp | UTC timezone |
| `completed_at` | timestamp (ISO 8601) | No | Job completion timestamp | UTC timezone |
| `duration_ms` | integer | No | Deployment duration in milliseconds | >= 0 |
| `error_message` | string | No | Error description if failed | Max 1,000 characters |
| `console_output_tail` | string | No | Last 50 lines of console output (for debugging) | Max 5,000 characters |
| `cache_clear_status` | enum | Yes | Cache clearing status as reported by Jenkins | See enum values below |
| `retry_count` | integer | Yes | Number of retry attempts | Default: 0, max: 1 (per FR-015) |

**Enum Values**:
- **status**: `queued`, `running`, `success`, `failed`, `error`
- **cache_clear_status**: `cleared`, `skipped`, `failed`, `pending` (pending = not yet reported by Jenkins)

**Validation Rules**:
- If `status = success`, `completed_at` and `duration_ms` MUST be set
- If `status = failed`, `error_message` SHOULD be set
- If `status = error`, `error_message` MUST be set
- `retry_count` must be <= 1 (max one retry per Constitution)
- `cache_clear_status` must be `cleared` or `skipped` for `status = success`

**State Machine**:

```
queued → running → success
                ↘ failed (retry once) → running → success
                                                 ↘ failed (final)
                ↘ error (no retry - system error)
```

**State Transitions**:
- `queued → running`: When Jenkins starts executing build
- `running → success`: When Jenkins job completes with SUCCESS result
- `running → failed`: When Jenkins job completes with FAILURE result (retry once)
- `failed → running`: When retry is attempted (max once)
- `running → error`: When system error occurs (e.g., Jenkins API unreachable)

**Relationships**:
- **Belongs To** Release
- **Belongs To** Tenant
- **Belongs To** TenantConfiguration (via tenant_id + environment_name)

---

### 9. MCPTool

Represents an MCP server tool with schema and versioning.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `name` | string | Yes | Tool name (snake_case) | Matches pattern `[a-z]+_[a-z_]+` (e.g., `git_merge_to_development`) |
| `version` | string | Yes | Tool schema version | Semantic versioning (e.g., `1.2.0`) |
| `description` | string | Yes | Tool purpose and behavior | Max 500 characters |
| `input_schema` | JSON Schema | Yes | JSON schema for input parameters | Valid JSON Schema Draft 7 |
| `output_schema` | JSON Schema | Yes | JSON schema for output response | Valid JSON Schema Draft 7 |
| `idempotent` | boolean | Yes | Whether tool is idempotent | Default: false |
| `deprecated` | boolean | Yes | Whether tool is deprecated | Default: false |
| `deprecated_in_favor_of` | string | No | Replacement tool name if deprecated | Valid tool name |

**Validation Rules**:
- `name` must be unique
- `version` must follow semantic versioning
- If `deprecated = true`, `deprecated_in_favor_of` SHOULD be set
- Breaking schema changes require MAJOR version bump

**Relationships**:
- **Has Many** Tool Invocations (tracked in audit trail)

---

### 10. WorkflowExecution

Represents an n8n workflow run with state snapshot for recovery.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string (UUID) | Yes | Unique workflow execution identifier | UUID v4 format |
| `release_id` | string (UUID) | Yes | Associated release ID | Foreign key to Release |
| `workflow_name` | string | Yes | n8n workflow name | E.g., `release-deployment` |
| `current_phase` | enum | Yes | Current execution phase | `merge`, `deployment`, `post_deployment`, `completed`, `failed` |
| `state_snapshot` | object | Yes | Workflow state for recovery | JSON object with phase-specific data |
| `started_at` | timestamp (ISO 8601) | Yes | Workflow start timestamp | UTC timezone |
| `completed_at` | timestamp (ISO 8601) | No | Workflow completion timestamp | UTC timezone |
| `paused` | boolean | Yes | Whether workflow is paused (waiting for approvals/conflict resolution) | Default: false |
| `paused_reason` | string | No | Reason for pause | Max 500 characters |
| `paused_at` | timestamp (ISO 8601) | No | When workflow was paused | UTC timezone |
| `resumed_at` | timestamp (ISO 8601) | No | When workflow was resumed | UTC timezone |
| `recovery_options` | string[] | No | Available recovery actions (manual resume, rollback, cancel) | Each max 50 characters |

**Validation Rules**:
- If `paused = true`, `paused_reason` and `paused_at` MUST be set
- If `resumed_at` is set, `paused_at` must be set and earlier
- `state_snapshot` must include at least `{ current_node, ticket_progress, tenant_progress }`

**State Snapshot Structure**:
```json
{
  "current_node": "MergeTickets",
  "ticket_progress": {
    "total": 10,
    "merged": 5,
    "pending": 3,
    "blocked": 2
  },
  "tenant_progress": {
    "total": 5,
    "deployed": 3,
    "running": 1,
    "failed": 1
  },
  "last_successful_checkpoint": "merge_phase_complete"
}
```

**Relationships**:
- **Belongs To** Release

---

### 11. Notification

Represents a Microsoft Teams message sent by the system.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string (UUID) | Yes | Unique notification identifier | UUID v4 format |
| `release_id` | string (UUID) | No | Associated release ID (if applicable) | Foreign key to Release |
| `notification_type` | enum | Yes | Type of notification | See enum values below |
| `severity` | enum | Yes | Message severity | `info`, `warning`, `critical` |
| `recipient` | string | Yes | Recipient identifier (email, Teams user ID, or channel ID) | Non-empty string |
| `recipient_type` | enum | Yes | Type of recipient | `user` (DM), `channel` |
| `subject` | string | Yes | Notification subject/title | Max 200 characters |
| `message_content` | string | Yes | Message body (HTML or plain text) | Max 5,000 characters |
| `adaptive_card_json` | object | No | Adaptive card payload if used | Valid Adaptive Card schema |
| `teams_message_id` | string | No | Teams API message ID after delivery | Set when delivery confirmed |
| `delivery_status` | enum | Yes | Delivery status | `pending`, `delivered`, `failed` |
| `delivery_timestamp` | timestamp (ISO 8601) | No | When message was delivered | UTC timezone |
| `error_message` | string | No | Error if delivery failed | Max 500 characters |

**Enum Values**:
- **notification_type**: `approval_required`, `conflict_detected`, `deployment_started`, `deployment_completed`, `deployment_failed`, `rollback_initiated`
- **severity**: `info`, `warning`, `critical`
- **recipient_type**: `user`, `channel`
- **delivery_status**: `pending`, `delivered`, `failed`

**Validation Rules**:
- If `delivery_status = delivered`, `teams_message_id` and `delivery_timestamp` MUST be set
- If `delivery_status = failed`, `error_message` MUST be set
- If `recipient_type = channel`, `recipient` must be Teams channel ID format

**Relationships**:
- **Belongs To** Release (optional)

---

### 12. AuditEvent

Represents a logged action or event in the system for compliance and debugging.

**Fields**:

| Field Name | Type | Required | Description | Validation Rules |
|-----------|------|----------|-------------|------------------|
| `id` | string (UUID) | Yes | Unique event identifier | UUID v4 format |
| `release_id` | string (UUID) | No | Associated release ID (if applicable) | Foreign key to Release |
| `timestamp` | timestamp (ISO 8601) | Yes | Event occurrence timestamp | UTC timezone |
| `event_type` | enum | Yes | Type of event | See enum values below |
| `actor` | string | Yes | Who/what triggered the event | User email or `system` |
| `actor_type` | enum | Yes | Type of actor | `human`, `system`, `ai_agent` |
| `affected_entities` | object | Yes | Entities affected by this event | E.g., `{ "ticket_id": "PROJ-123", "tenant_id": "tenant-a" }` |
| `target_environment` | enum | No | Environment where event occurred | `Integration`, `UAT`, `UAT1`, `PROD` |
| `action_details` | object | Yes | Event-specific details | JSON object with action metadata |
| `status` | enum | Yes | Event outcome status | `success`, `failed`, `in_progress` |
| `error_message` | string | No | Error description if failed | Max 1,000 characters |
| `diagnostic_context` | object | No | Additional debugging information | JSON object (logs, stack traces, API responses) |

**Enum Values**:
- **event_type**: `release_created`, `merge_initiated`, `merge_completed`, `conflict_detected`, `conflict_resolved`, `deployment_triggered`, `deployment_completed`, `cache_cleared`, `jira_updated`, `notification_sent`, `rollback_initiated`
- **actor_type**: `human`, `system`, `ai_agent`
- **status**: `success`, `failed`, `in_progress`

**Validation Rules**:
- If `status = failed`, `error_message` SHOULD be set
- `affected_entities` must be a non-empty object
- `diagnostic_context` should be sanitized (no credentials, tokens)

**Action Details Examples**:

**Merge Event**:
```json
{
  "ticket_id": "PROJ-123",
  "pr_id": "456",
  "merge_strategy": "squash",
  "commit_sha": "abc123def456",
  "conflicts_detected": false
}
```

**Deployment Event**:
```json
{
  "tenant_id": "tenant-a",
  "jenkins_job_name": "deploy-tenant-a-uat",
  "jenkins_build_number": 789,
  "duration_ms": 450000,
  "cache_clear_status": "cleared"
}
```

**Notification Event**:
```json
{
  "notification_type": "deployment_completed",
  "recipient": "release-team@example.com",
  "teams_message_id": "msg-123",
  "delivery_status": "delivered"
}
```

**Relationships**:
- **Belongs To** Release (optional)

---

## Entity Relationships Diagram

```
┌─────────────┐
│   Release   │ 1──────┐
└─────────────┘        │
      │ 1              │ *
      │                │
      │ *              ▼
┌─────────────┐   ┌──────────────┐
│   Ticket    │   │ AuditEvent   │
└─────────────┘   └──────────────┘
      │ 1
      │
      │ 0..1
      ▼
┌──────────────┐
│ ConflictInfo │
└──────────────┘
      │ 1
      │
      │ 0..1
      ▼
┌──────────────────┐
│ConflictAnalysis  │
└──────────────────┘

┌─────────────┐
│   Release   │ 1──────┐
└─────────────┘        │
      │                │
      │ *              │ *
      ▼                ▼
┌─────────────┐   ┌──────────────┐
│ Deployment  │   │Notification  │
└─────────────┘   └──────────────┘
      │ *
      │
      │ 1
      ▼
┌─────────────┐
│   Tenant    │
└─────────────┘
      │ 1
      │
      │ *
      ▼
┌──────────────────────┐
│TenantConfiguration   │
└──────────────────────┘
      │ *
      │
      │ 1
      ▼
┌─────────────┐
│Environment  │
└─────────────┘

┌─────────────┐
│   Release   │ 1──────┐
└─────────────┘        │
                       │ 1
                       ▼
               ┌──────────────────┐
               │WorkflowExecution │
               └──────────────────┘
```

---

## Storage Strategy

### Primary Storage
- **Release, Ticket, Deployment, Tenant, Environment, TenantConfiguration**: File-based JSON or YAML (version-controlled in Git repository)
- **WorkflowExecution**: n8n database (SQLite or PostgreSQL depending on deployment)
- **AuditEvent**: Append-only log files (structured JSON lines) + optional external log aggregation (e.g., Elasticsearch)
- **Notification**: Transient (logged in AuditEvent, not persisted separately)

### Caching
- **MCPTool schemas**: In-memory cache (loaded at server startup)
- **Secrets**: In-memory cache with 5-minute TTL (retrieved from Azure Key Vault)
- **Tenant configurations**: In-memory cache (reloaded on file change)

### State Persistence for Recovery
- **WorkflowExecution.state_snapshot**: Persisted in n8n database after each phase completion
- **Release.status**: Updated in real-time (file-based or database)

---

## Validation Rules Summary

### Cross-Entity Validation
1. **Release environment validation**: Regular releases cannot target PROD environment (Constitution II)
2. **PR approval threshold**: All tickets in a release must have >= 2 PR approvals before merge (Constitution II)
3. **Tenant existence**: All `tenant_ids` in a Release must exist in the Tenant manifest for the target environment
4. **Deployment retry limit**: `Deployment.retry_count` must be <= 1 (FR-015)
5. **Conflict resolution confidence**: `ConflictAnalysis.confidence_score` must be >= 95.0 for auto-resolution (Constitution I)

### Data Integrity
1. **Timestamps**: All timestamps use UTC timezone (ISO 8601 format)
2. **Unique identifiers**: All entity IDs use UUID v4 format
3. **Foreign key integrity**: All foreign keys must reference valid entities
4. **State machine compliance**: Status transitions must follow defined state machines

---

## Next Steps (Contracts Generation)

With the data model defined, the next phase will generate:

1. **MCP tool schemas** (contracts/mcp-tools.json): JSON schemas for all 15+ MCP tools
2. **Git provider interface** (contracts/git-api.yaml): OpenAPI spec for `IGitProvider` abstraction
3. **Secrets provider interface** (contracts/secrets-api.yaml): OpenAPI spec for `ISecretsProvider` abstraction
4. **n8n workflow definition** (contracts/n8n-workflow.json): Complete workflow structure with MCP tool call sequences

All contracts will align with the entities and validation rules defined in this data model.

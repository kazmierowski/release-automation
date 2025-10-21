# Quickstart Guide: Release Automation MCP Server Testing

**Feature**: Release Automation MCP Server
**Date**: 2025-10-19
**Purpose**: Step-by-step test scenarios for validating each user story

---

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Test Data Fixtures](#test-data-fixtures)
3. [MCP Tool Testing](#mcp-tool-testing)
4. [User Story 1: Automated Release Deployment](#user-story-1-automated-release-deployment)
5. [User Story 2: Intelligent Conflict and Approval Management](#user-story-2-intelligent-conflict-and-approval-management)
6. [User Story 3: Multi-Tenant Deployment Orchestration](#user-story-3-multi-tenant-deployment-orchestration)
7. [User Story 4: Real-Time Monitoring and Observability](#user-story-4-real-time-monitoring-and-observability)
8. [User Story 5: Documentation and Integration Extensibility](#user-story-5-documentation-and-integration-extensibility)
9. [Edge Case Scenarios](#edge-case-scenarios)
10. [Troubleshooting](#troubleshooting)

---

## Environment Setup

### Prerequisites

- **Docker** 20.10+ and **Docker Compose** 2.x
- **Node.js** 20.x LTS
- **Git** 2.40+
- **Azure Key Vault** access (or configured secrets provider)
- Access to **staging instances** of:
  - Bitbucket (or configured Git platform)
  - Jenkins
  - JIRA
  - Microsoft Teams

### Local Development Environment

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd release-automation
```

#### 2. Configure Environment Variables

Copy the example environment file and customize it:

```bash
cp config/.env.example config/.env
```

**Edit `config/.env`:**

```env
# Default deployment environment (Integration, UAT, UAT1, PROD)
DEFAULT_ENVIRONMENT=Integration

# Git Platform Configuration (Bitbucket initial implementation)
GIT_PLATFORM=bitbucket
GIT_BASE_URL=https://bitbucket-staging.example.com
GIT_API_TOKEN_VAULT_KEY=git-api-token

# Jenkins Configuration
JENKINS_BASE_URL=https://jenkins-staging.example.com
JENKINS_USER_VAULT_KEY=jenkins-username
JENKINS_TOKEN_VAULT_KEY=jenkins-api-token

# JIRA Configuration
JIRA_BASE_URL=https://jira-staging.example.com
JIRA_API_TOKEN_VAULT_KEY=jira-api-token

# Microsoft Teams Configuration
TEAMS_TENANT_ID=<your-tenant-id>
TEAMS_CLIENT_ID_VAULT_KEY=teams-client-id
TEAMS_CLIENT_SECRET_VAULT_KEY=teams-client-secret
TEAMS_CHANNEL_ID=<release-channel-id>

# Azure Key Vault Configuration
AZURE_KEY_VAULT_URL=https://<your-vault>.vault.azure.net/
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=<your-tenant-id>

# MCP Server Configuration
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost

# Dashboard Configuration
DASHBOARD_PORT=3001
DASHBOARD_WS_PORT=3002
```

#### 3. Configure Tenant Manifest

**Edit `config/tenants.yaml`:**

```yaml
tenants:
  - id: tenant-a
    display_name: Tenant A (Staging)
    description: First test tenant
    active: true
    rollback_supported: true

  - id: tenant-b
    display_name: Tenant B (Staging)
    description: Second test tenant
    active: true
    rollback_supported: true

  - id: tenant-c
    display_name: Tenant C (Staging)
    description: Third test tenant
    active: true
    rollback_supported: true

  - id: tenant-d
    display_name: Tenant D (Staging)
    description: Fourth test tenant
    active: true
    rollback_supported: true

  - id: tenant-e
    display_name: Tenant E (Staging)
    description: Fifth test tenant
    active: true
    rollback_supported: true
```

#### 4. Configure Environment Settings

**Edit `config/environments.yaml`:**

```yaml
environments:
  - name: Integration
    display_name: Integration Environment
    is_default: true
    allowed_release_types:
      - regular
      - hotfix
    git_base_url: https://bitbucket-staging.example.com
    jenkins_base_url: https://jenkins-staging.example.com/integration
    jira_base_url: https://jira-staging.example.com
    tenant_configurations:
      - tenant_id: tenant-a
        jenkins_job_name: deploy-tenant-a-integration
        jenkins_job_parameters:
          environment: integration
      - tenant_id: tenant-b
        jenkins_job_name: deploy-tenant-b-integration
        jenkins_job_parameters:
          environment: integration
      - tenant_id: tenant-c
        jenkins_job_name: deploy-tenant-c-integration
        jenkins_job_parameters:
          environment: integration
      - tenant_id: tenant-d
        jenkins_job_name: deploy-tenant-d-integration
        jenkins_job_parameters:
          environment: integration
      - tenant_id: tenant-e
        jenkins_job_name: deploy-tenant-e-integration
        jenkins_job_parameters:
          environment: integration

  - name: UAT
    display_name: UAT Environment
    is_default: false
    allowed_release_types:
      - regular
      - hotfix
    git_base_url: https://bitbucket-staging.example.com
    jenkins_base_url: https://jenkins-staging.example.com/uat
    jira_base_url: https://jira-staging.example.com
    tenant_configurations:
      - tenant_id: tenant-a
        jenkins_job_name: deploy-tenant-a-uat
        jenkins_job_parameters:
          environment: uat
      - tenant_id: tenant-b
        jenkins_job_name: deploy-tenant-b-uat
        jenkins_job_parameters:
          environment: uat
      - tenant_id: tenant-c
        jenkins_job_name: deploy-tenant-c-uat
        jenkins_job_parameters:
          environment: uat
      - tenant_id: tenant-d
        jenkins_job_name: deploy-tenant-d-uat
        jenkins_job_parameters:
          environment: uat
      - tenant_id: tenant-e
        jenkins_job_name: deploy-tenant-e-uat
        jenkins_job_parameters:
          environment: uat

  - name: UAT1
    display_name: UAT1 Environment
    is_default: false
    allowed_release_types:
      - regular
      - hotfix
    git_base_url: https://bitbucket-staging.example.com
    jenkins_base_url: https://jenkins-staging.example.com/uat1
    jira_base_url: https://jira-staging.example.com
    tenant_configurations:
      - tenant_id: tenant-a
        jenkins_job_name: deploy-tenant-a-uat1
        jenkins_job_parameters:
          environment: uat1
      - tenant_id: tenant-b
        jenkins_job_name: deploy-tenant-b-uat1
        jenkins_job_parameters:
          environment: uat1
      - tenant_id: tenant-c
        jenkins_job_name: deploy-tenant-c-uat1
        jenkins_job_parameters:
          environment: uat1
      - tenant_id: tenant-d
        jenkins_job_name: deploy-tenant-d-uat1
        jenkins_job_parameters:
          environment: uat1
      - tenant_id: tenant-e
        jenkins_job_name: deploy-tenant-e-uat1
        jenkins_job_parameters:
          environment: uat1

  - name: PROD
    display_name: Production Environment
    is_default: false
    allowed_release_types:
      - hotfix  # Regular releases NOT allowed
    git_base_url: https://bitbucket.example.com
    jenkins_base_url: https://jenkins.example.com/prod
    jira_base_url: https://jira.example.com
    tenant_configurations:
      - tenant_id: tenant-a
        jenkins_job_name: deploy-tenant-a-prod
        jenkins_job_parameters:
          environment: production
      - tenant_id: tenant-b
        jenkins_job_name: deploy-tenant-b-prod
        jenkins_job_parameters:
          environment: production
      - tenant_id: tenant-c
        jenkins_job_name: deploy-tenant-c-prod
        jenkins_job_parameters:
          environment: production
      - tenant_id: tenant-d
        jenkins_job_name: deploy-tenant-d-prod
        jenkins_job_parameters:
          environment: production
      - tenant_id: tenant-e
        jenkins_job_name: deploy-tenant-e-prod
        jenkins_job_parameters:
          environment: production
```

#### 5. Start Services with Docker Compose

```bash
docker-compose up -d
```

**Verify services are running:**

```bash
docker-compose ps
```

Expected output:
```
NAME                    STATUS          PORTS
mcp-server              Up 10 seconds   0.0.0.0:3000->3000/tcp
dashboard               Up 10 seconds   0.0.0.0:3001->3001/tcp
n8n                     Up 10 seconds   0.0.0.0:5678->5678/tcp
```

#### 6. Import n8n Workflows

Access n8n at `http://localhost:5678` and import workflows:

```bash
# Navigate to Workflows → Import from File
# Import each workflow:
# - n8n-workflows/release-deployment.json
# - n8n-workflows/pr-approval-monitor.json
# - n8n-workflows/rollback-tenant.json
```

#### 7. Verify MCP Server Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-10-19T12:00:00.000Z",
  "services": {
    "git": "connected",
    "jenkins": "connected",
    "jira": "connected",
    "teams": "connected",
    "secrets": "connected"
  }
}
```

---

## Test Data Fixtures

### JIRA Test Tickets

Create the following test tickets in JIRA staging:

#### Release v1.2.0 (Regular Release)

1. **TEST-101**: Add user authentication endpoint
   - Assignee: dev1@example.com
   - PR: #201 (feature/TEST-101-auth-endpoint)
   - Approvals: 2 (approved by reviewer1@example.com, reviewer2@example.com)
   - Status: Ready for Merge
   - Fix Version: v1.2.0

2. **TEST-102**: Update database schema for users table
   - Assignee: dev2@example.com
   - PR: #202 (feature/TEST-102-db-schema)
   - Approvals: 2 (approved by reviewer1@example.com, reviewer3@example.com)
   - Status: Ready for Merge
   - Fix Version: v1.2.0

3. **TEST-103**: Fix pagination bug in search API
   - Assignee: dev3@example.com
   - PR: #203 (feature/TEST-103-pagination-fix)
   - Approvals: 2 (approved by reviewer2@example.com, reviewer3@example.com)
   - Status: Ready for Merge
   - Fix Version: v1.2.0

4. **TEST-104**: Add logging to payment processing
   - Assignee: dev4@example.com
   - PR: #204 (feature/TEST-104-payment-logging)
   - Approvals: 2 (approved by reviewer1@example.com, reviewer2@example.com)
   - Status: Ready for Merge
   - Fix Version: v1.2.0

5. **TEST-105**: Update API documentation for v1.2.0
   - Assignee: dev5@example.com
   - PR: #205 (feature/TEST-105-api-docs)
   - Approvals: 2 (approved by reviewer2@example.com, reviewer3@example.com)
   - Status: Ready for Merge
   - Fix Version: v1.2.0

#### Hotfix v1.1.1 (Emergency Production Fix)

1. **TEST-201**: Critical security patch for auth bypass
   - Assignee: dev1@example.com
   - PR: #301 (hotfix/TEST-201-security-patch)
   - Approvals: 2 (approved by security-lead@example.com, tech-lead@example.com)
   - Status: Ready for Merge
   - Fix Version: hotfix/v1.1.1

### Bitbucket Pull Requests

Ensure the following PRs exist in Bitbucket staging:

```bash
# PR #201: feature/TEST-101-auth-endpoint → development
# - 2 approvals
# - No conflicts
# - Ready to merge

# PR #202: feature/TEST-102-db-schema → development
# - 2 approvals
# - No conflicts
# - Ready to merge

# PR #203: feature/TEST-103-pagination-fix → development
# - 2 approvals
# - No conflicts
# - Ready to merge

# PR #204: feature/TEST-104-payment-logging → development
# - 2 approvals
# - No conflicts
# - Ready to merge

# PR #205: feature/TEST-105-api-docs → development
# - 2 approvals
# - No conflicts
# - Ready to merge

# PR #301: hotfix/TEST-201-security-patch → main
# - 2 approvals
# - No conflicts
# - Ready to merge
```

### Jenkins Job Configuration

Ensure Jenkins staging has jobs configured:

```bash
# Integration Environment Jobs
deploy-tenant-a-integration
deploy-tenant-b-integration
deploy-tenant-c-integration
deploy-tenant-d-integration
deploy-tenant-e-integration

# UAT Environment Jobs
deploy-tenant-a-uat
deploy-tenant-b-uat
deploy-tenant-c-uat
deploy-tenant-d-uat
deploy-tenant-e-uat

# UAT1 Environment Jobs
deploy-tenant-a-uat1
deploy-tenant-b-uat1
deploy-tenant-c-uat1
deploy-tenant-d-uat1
deploy-tenant-e-uat1

# PROD Environment Jobs (hotfix only)
deploy-tenant-a-prod
deploy-tenant-b-prod
deploy-tenant-c-prod
deploy-tenant-d-prod
deploy-tenant-e-prod
```

**Each job should accept parameters:**
- `RELEASE_VERSION` (string): Release version to deploy
- `TENANT_ID` (string): Target tenant ID
- `ENVIRONMENT` (string): Environment name

**Job success criteria:**
- Exit code 0 for success
- Set environment variable `CACHE_CLEAR_STATUS=cleared` or `CACHE_CLEAR_STATUS=skipped`
- Duration: 2-5 minutes per job

---

## MCP Tool Testing

### Testing Individual MCP Tools via CLI

Before running full workflows, test each MCP tool individually using the MCP CLI client.

#### Install MCP CLI Client

```bash
npm install -g @modelcontextprotocol/cli
```

#### Configure MCP CLI

Create `~/.mcp/config.json`:

```json
{
  "servers": {
    "release-automation": {
      "url": "http://localhost:3000",
      "transport": "http"
    }
  }
}
```

#### Test Tool: jira_get_release_tickets

```bash
mcp call release-automation jira_get_release_tickets \
  --input '{
    "release_version": "v1.2.0",
    "include_pr_details": true
  }'
```

**Expected Output:**

```json
{
  "release_version": "v1.2.0",
  "tickets": [
    {
      "id": "TEST-101",
      "summary": "Add user authentication endpoint",
      "pr_id": "201",
      "pr_url": "https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/201",
      "pr_owner_email": "dev1@example.com",
      "approval_count": 2,
      "required_approvals": 2,
      "approved": true,
      "approvers": ["reviewer1@example.com", "reviewer2@example.com"],
      "merge_status": "pending",
      "conflicts_detected": false
    }
    // ... other tickets
  ],
  "total_count": 5
}
```

**Validation:**
- [ ] `total_count` equals 5
- [ ] All tickets have `approved: true`
- [ ] All tickets have `merge_status: "pending"`
- [ ] No tickets have `conflicts_detected: true`

#### Test Tool: git_check_pr_approvals

```bash
mcp call release-automation git_check_pr_approvals \
  --input '{
    "pr_id": "201",
    "required_approvals": 2
  }'
```

**Expected Output:**

```json
{
  "pr_id": "201",
  "approval_count": 2,
  "required_approvals": 2,
  "approved": true,
  "approvers": ["reviewer1@example.com", "reviewer2@example.com"],
  "pr_owner": "dev1",
  "pr_owner_email": "dev1@example.com",
  "potential_reviewers": [],
  "pr_url": "https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/201"
}
```

**Validation:**
- [ ] `approved: true`
- [ ] `approval_count >= required_approvals`
- [ ] `potential_reviewers` is empty array (PR already approved)

#### Test Tool: git_merge_tickets_to_development

```bash
mcp call release-automation git_merge_tickets_to_development \
  --input '{
    "ticket_ids": ["TEST-101"],
    "merge_strategy": "squash",
    "squash_commit_messages": {
      "TEST-101": "[TEST-101] Add user authentication endpoint"
    },
    "auto_resolve_conflicts": true,
    "target_branch": "development"
  }'
```

**Expected Output:**

```json
{
  "merged": [
    {
      "ticket_id": "TEST-101",
      "commit_sha": "abc123def456",
      "squashed": true,
      "commit_message": "[TEST-101] Add user authentication endpoint"
    }
  ],
  "conflicts": [],
  "total_requested": 1,
  "total_merged": 1,
  "total_conflicts": 0
}
```

**Validation:**
- [ ] `total_merged` equals `total_requested`
- [ ] `conflicts` array is empty
- [ ] Each merge has a valid `commit_sha`
- [ ] `commit_message` matches required format `[TICKET-ID] Summary`

#### Test Tool: git_create_release_branch

```bash
mcp call release-automation git_create_release_branch \
  --input '{
    "version": "v1.2.0",
    "source_branch": "development",
    "release_type": "regular"
  }'
```

**Expected Output:**

```json
{
  "branch_name": "release/v1.2.0",
  "commit_sha": "def789abc012",
  "source_branch": "development",
  "created": true,
  "ticket_count": 5
}
```

**Validation:**
- [ ] `branch_name` follows pattern `release/v1.2.0` (regular) or `hotfix/v1.1.1` (hotfix)
- [ ] `created: true` (branch was newly created)
- [ ] `ticket_count` matches expected number of commits

#### Test Tool: jenkins_trigger_deployment

```bash
mcp call release-automation jenkins_trigger_deployment \
  --input '{
    "tenant_id": "tenant-a",
    "release_version": "v1.2.0",
    "environment": "Integration",
    "release_type": "regular",
    "jenkins_job_parameters": {
      "environment": "integration"
    }
  }'
```

**Expected Output:**

```json
{
  "deployment_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-a",
  "jenkins_queue_id": 12345,
  "jenkins_job_name": "deploy-tenant-a-integration",
  "jenkins_job_url": "https://jenkins-staging.example.com/integration/job/deploy-tenant-a-integration/12345/",
  "status": "queued",
  "triggered_at": "2025-10-19T12:00:00.000Z"
}
```

**Validation:**
- [ ] `deployment_id` is valid UUID
- [ ] `status` is `queued` or `running`
- [ ] `jenkins_job_url` is accessible
- [ ] `triggered_at` is ISO 8601 UTC timestamp

#### Test Tool: jenkins_get_job_status

```bash
mcp call release-automation jenkins_get_job_status \
  --input '{
    "deployment_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "include_console_output": false
  }'
```

**Expected Output:**

```json
{
  "deployments": [
    {
      "deployment_id": "550e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "tenant-a",
      "jenkins_build_number": 456,
      "jenkins_job_url": "https://jenkins-staging.example.com/integration/job/deploy-tenant-a-integration/456/",
      "status": "success",
      "started_at": "2025-10-19T12:01:00.000Z",
      "completed_at": "2025-10-19T12:05:30.000Z",
      "duration_ms": 270000,
      "error_message": null,
      "cache_clear_status": "cleared",
      "retry_count": 0
    }
  ],
  "total_queried": 1
}
```

**Validation:**
- [ ] `status` is one of: `queued`, `running`, `success`, `failed`, `error`
- [ ] If `status: "success"`, `completed_at` and `duration_ms` are set
- [ ] `cache_clear_status` is one of: `cleared`, `skipped`, `failed`, `pending`
- [ ] `retry_count` is 0 or 1

#### Test Tool: jira_update_ticket_status

```bash
mcp call release-automation jira_update_ticket_status \
  --input '{
    "ticket_ids": ["TEST-101"],
    "new_status": "Deployed",
    "deployment_details": {
      "environment": "Integration",
      "release_version": "v1.2.0",
      "deployed_tenants": ["tenant-a", "tenant-b", "tenant-c", "tenant-d", "tenant-e"],
      "failed_tenants": [],
      "deployment_timestamp": "2025-10-19T12:10:00.000Z"
    },
    "add_comment": true
  }'
```

**Expected Output:**

```json
{
  "updated": [
    {
      "ticket_id": "TEST-101",
      "previous_status": "Ready for Merge",
      "new_status": "Deployed",
      "comment_added": true
    }
  ],
  "failed": [],
  "total_requested": 1,
  "total_updated": 1,
  "total_failed": 0
}
```

**Validation:**
- [ ] `total_updated` equals `total_requested`
- [ ] `failed` array is empty
- [ ] `comment_added: true` if `add_comment: true`

#### Test Tool: teams_notify_pr_owner

```bash
mcp call release-automation teams_notify_pr_owner \
  --input '{
    "pr_id": "201",
    "pr_owner_email": "dev1@example.com",
    "notification_type": "approval_required",
    "severity": "warning",
    "approval_details": {
      "current_approvals": 1,
      "required_approvals": 2,
      "potential_reviewers": ["reviewer1@example.com", "reviewer2@example.com", "reviewer3@example.com"],
      "pr_url": "https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/201"
    }
  }'
```

**Expected Output:**

```json
{
  "notification_id": "660e8400-e29b-41d4-a716-446655440001",
  "pr_id": "201",
  "recipient": "dev1@example.com",
  "teams_message_id": "msg-abc123",
  "delivery_status": "delivered",
  "delivery_timestamp": "2025-10-19T12:00:05.000Z",
  "error_message": null
}
```

**Validation:**
- [ ] `delivery_status: "delivered"`
- [ ] `teams_message_id` is set
- [ ] `delivery_timestamp` is ISO 8601 UTC
- [ ] Check Teams channel/DM for message receipt

#### Test Tool: teams_announce_deployment

```bash
mcp call release-automation teams_announce_deployment \
  --input '{
    "release_version": "v1.2.0",
    "environment": "Integration",
    "ticket_ids": ["TEST-101", "TEST-102", "TEST-103", "TEST-104", "TEST-105"],
    "tenant_statuses": [
      {
        "tenant_id": "tenant-a",
        "status": "success",
        "cache_clear_status": "cleared",
        "duration_ms": 270000
      },
      {
        "tenant_id": "tenant-b",
        "status": "success",
        "cache_clear_status": "cleared",
        "duration_ms": 280000
      },
      {
        "tenant_id": "tenant-c",
        "status": "success",
        "cache_clear_status": "cleared",
        "duration_ms": 265000
      },
      {
        "tenant_id": "tenant-d",
        "status": "success",
        "cache_clear_status": "cleared",
        "duration_ms": 290000
      },
      {
        "tenant_id": "tenant-e",
        "status": "success",
        "cache_clear_status": "cleared",
        "duration_ms": 275000
      }
    ],
    "deployment_summary": "All 5 tenants deployed successfully to Integration in 12 minutes",
    "severity": "info"
  }'
```

**Expected Output:**

```json
{
  "notification_id": "770e8400-e29b-41d4-a716-446655440002",
  "release_version": "v1.2.0",
  "channel_id": "release-channel-id",
  "teams_message_id": "msg-def456",
  "delivery_status": "delivered",
  "delivery_timestamp": "2025-10-19T12:10:10.000Z",
  "error_message": null
}
```

**Validation:**
- [ ] `delivery_status: "delivered"`
- [ ] Teams channel receives announcement message
- [ ] Message includes: release version, environment, tenant statuses, cache statuses

---

## User Story 1: Automated Release Deployment

**Priority**: P1
**Goal**: Trigger release deployment with a single action, with automatic handling of merge operations, deployment orchestration, and notifications.

### Test Scenario 1.1: Regular Release to Default Environment (Integration)

**Prerequisites:**
- 5 JIRA tickets (TEST-101 to TEST-105) tagged for v1.2.0
- All PRs have 2+ approvals
- No merge conflicts
- Default environment is `Integration` (from `.env`)

**Test Procedure:**

1. **Trigger Release via MCP Tool**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

2. **Verify Initial Response**

Expected output:
```json
{
  "release_id": "880e8400-e29b-41d4-a716-446655440003",
  "release_version": "v1.2.0",
  "release_type": "regular",
  "target_environment": "Integration",
  "status": "in_progress",
  "workflow_execution_id": "990e8400-e29b-41d4-a716-446655440004",
  "ticket_count": 5,
  "tenant_count": 5,
  "created_at": "2025-10-19T12:00:00.000Z",
  "created_by": "tester@example.com",
  "estimated_duration_minutes": 15
}
```

**Validation Checklist:**
- [ ] `release_id` is valid UUID
- [ ] `target_environment: "Integration"` (default from `.env`)
- [ ] `ticket_count: 5`
- [ ] `tenant_count: 5`
- [ ] `status: "in_progress"`

3. **Monitor Workflow Execution in n8n**

Access n8n at `http://localhost:5678/executions`

**Validation Checklist:**
- [ ] Workflow execution ID matches `workflow_execution_id` from response
- [ ] Current node progresses through: `MergePhase` → `DeploymentPhase` → `PostDeploymentPhase`

4. **Verify Merge Phase Completion**

Check Git repository:

```bash
git fetch origin
git log origin/development --oneline -5
```

**Expected Output:**
```
abc1234 [TEST-105] Update API documentation for v1.2.0
def5678 [TEST-104] Add logging to payment processing
ghi9012 [TEST-103] Fix pagination bug in search API
jkl3456 [TEST-102] Update database schema for users table
mno7890 [TEST-101] Add user authentication endpoint
```

**Validation Checklist:**
- [ ] All 5 tickets merged to `development` branch
- [ ] Squash merge strategy used (1 commit per ticket)
- [ ] Commit messages follow format `[TICKET-ID] Summary`

5. **Verify Release Branch Creation**

```bash
git fetch origin
git branch -r | grep release/v1.2.0
```

**Expected Output:**
```
origin/release/v1.2.0
```

**Validation Checklist:**
- [ ] Release branch `release/v1.2.0` exists
- [ ] Branch created from `development` with full commit history (no squash)

6. **Verify Jenkins Deployment Status**

Check monitoring dashboard at `http://localhost:3001`

**Validation Checklist:**
- [ ] All 5 tenants show status `success`
- [ ] Cache clear status for all tenants: `cleared`
- [ ] Deployment duration < 15 minutes per tenant
- [ ] No errors reported

7. **Verify JIRA Ticket Updates**

Check JIRA tickets TEST-101 through TEST-105:

**Validation Checklist:**
- [ ] All tickets status changed to `Deployed`
- [ ] Comment added with deployment details:
  - Environment: Integration
  - Release version: v1.2.0
  - Deployed tenants: tenant-a, tenant-b, tenant-c, tenant-d, tenant-e
  - Deployment timestamp

8. **Verify Teams Notification**

Check Teams channel for deployment announcement:

**Expected Message Content:**
```
Release v1.2.0 Deployed to Integration

Status: SUCCESS
Tickets: 5 (TEST-101, TEST-102, TEST-103, TEST-104, TEST-105)
Environment: Integration
Tenants: 5/5 successful

Tenant Status:
✓ tenant-a: deployed (4m 30s) - cache cleared
✓ tenant-b: deployed (4m 40s) - cache cleared
✓ tenant-c: deployed (4m 25s) - cache cleared
✓ tenant-d: deployed (4m 50s) - cache cleared
✓ tenant-e: deployed (4m 35s) - cache cleared

Total Duration: 12 minutes
Completed: 2025-10-19 12:12:00 UTC
```

**Validation Checklist:**
- [ ] Teams message received in main release channel
- [ ] Message includes all required information
- [ ] Severity: `info` (green badge)

9. **Verify Monitoring Dashboard Audit Trail**

Access dashboard at `http://localhost:3001` → Audit Log tab

**Expected Events:**
```
2025-10-19 12:00:00 UTC | release_created | tester@example.com | Release v1.2.0 created for Integration
2025-10-19 12:00:05 UTC | merge_initiated | system | Merging 5 tickets to development
2025-10-19 12:02:00 UTC | merge_completed | system | All 5 tickets merged successfully
2025-10-19 12:02:05 UTC | deployment_triggered | system | Jenkins jobs triggered for 5 tenants in Integration
2025-10-19 12:06:30 UTC | deployment_completed | system | tenant-a deployed successfully - cache cleared
2025-10-19 12:06:40 UTC | deployment_completed | system | tenant-b deployed successfully - cache cleared
... (all tenants)
2025-10-19 12:10:00 UTC | jira_updated | system | 5 tickets updated to Deployed status
2025-10-19 12:10:05 UTC | notification_sent | system | Deployment announcement sent to Teams
```

**Validation Checklist:**
- [ ] All events logged with timestamps
- [ ] Events show correct actor (`system` or user email)
- [ ] Environment (Integration) included in event details
- [ ] Cache clear status tracked per tenant

**Success Criteria (from spec):**
- [x] Release completes in under 30 minutes (Target: 12-15 minutes)
- [x] All tickets merged using squash merge with correct format
- [x] Release branch created with full commit history
- [x] All 5 tenants deployed successfully in parallel
- [x] Cache cleared by Jenkins jobs (status: cleared)
- [x] JIRA tickets updated to "Deployed"
- [x] Teams notification sent with environment information
- [x] Complete audit trail available

**Cleanup:**

```bash
# Delete release branch
git push origin --delete release/v1.2.0

# Reset JIRA tickets to original status
# (Manual step in JIRA staging)

# Rollback tenants (optional)
mcp call release-automation jenkins_rollback_tenant \
  --input '{
    "tenant_id": "tenant-a",
    "environment": "Integration",
    "previous_version": "v1.1.0",
    "rollback_reason": "Test cleanup"
  }'
# Repeat for tenant-b through tenant-e
```

---

### Test Scenario 1.2: Regular Release to Explicit Environment (UAT)

**Prerequisites:**
- Same as Scenario 1.1
- Clean state (no active deployments)

**Test Procedure:**

1. **Trigger Release with Explicit Environment**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "target_environment": "UAT",
    "triggered_by": "tester@example.com"
  }'
```

**Validation Checklist:**
- [ ] `target_environment: "UAT"` (overrides default Integration)
- [ ] Deployment proceeds to UAT Jenkins jobs
- [ ] Teams notification shows "Environment: UAT"
- [ ] JIRA comments include "Environment: UAT"

---

### Test Scenario 1.3: Regular Release Blocked from PROD (Negative Test)

**Prerequisites:**
- 1 JIRA ticket (TEST-101) tagged for v1.2.0
- PR has 2+ approvals

**Test Procedure:**

1. **Attempt to Deploy Regular Release to PROD**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "target_environment": "PROD",
    "triggered_by": "tester@example.com"
  }'
```

2. **Verify Error Response**

Expected output:
```json
{
  "error": {
    "code": "ENVIRONMENT_NOT_ALLOWED",
    "message": "Regular releases cannot deploy to PROD. Use hotfix branch for production deployments.",
    "retryable": false,
    "details": {
      "release_version": "v1.2.0",
      "release_type": "regular",
      "attempted_environment": "PROD",
      "allowed_environments": ["Integration", "UAT", "UAT1"]
    }
  }
}
```

**Validation Checklist:**
- [ ] Error code: `ENVIRONMENT_NOT_ALLOWED`
- [ ] Error message clearly states restriction
- [ ] `retryable: false`
- [ ] No deployment started
- [ ] No Git changes made

3. **Verify Teams Notification to Release Manager**

Expected message:
```
Deployment Rejected: Regular Release to PROD Not Allowed

Release: v1.2.0 (regular)
Attempted Environment: PROD
Triggered By: tester@example.com

Error: Regular releases cannot deploy to PROD. Use hotfix branch for production deployments.

Next Steps:
- Deploy to Integration, UAT, or UAT1 instead, OR
- Create hotfix branch if emergency production deployment is needed
```

**Validation Checklist:**
- [ ] Teams notification sent to release manager
- [ ] Severity: `warning`
- [ ] Clear instructions provided

**Success Criteria:**
- [x] Regular release blocked from PROD deployment
- [x] Clear error message returned
- [x] Release manager notified via Teams
- [x] No unintended side effects (no merges, no branch creation)

---

### Test Scenario 1.4: Hotfix Release to PROD

**Prerequisites:**
- 1 JIRA ticket (TEST-201) tagged for hotfix/v1.1.1
- PR has 2+ approvals from security-lead and tech-lead
- No merge conflicts

**Test Procedure:**

1. **Trigger Hotfix Release to PROD**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "hotfix/v1.1.1",
    "release_type": "hotfix",
    "target_environment": "PROD",
    "triggered_by": "security-lead@example.com"
  }'
```

**Validation Checklist:**
- [ ] `release_type: "hotfix"`
- [ ] `target_environment: "PROD"` (allowed for hotfix)
- [ ] Deployment proceeds successfully
- [ ] Teams notification shows "HOTFIX - PROD Deployment"
- [ ] Severity: `critical` (due to PROD deployment)

**Success Criteria:**
- [x] Hotfix release allowed to deploy to PROD
- [x] Deployment completes successfully
- [x] Teams notification emphasizes PROD deployment
- [x] Audit trail includes PROD environment marker

**Cleanup:**

```bash
# Rollback PROD tenants
mcp call release-automation jenkins_rollback_tenant \
  --input '{
    "tenant_id": "tenant-a",
    "environment": "PROD",
    "previous_version": "v1.1.0",
    "rollback_reason": "Test cleanup"
  }'
# Repeat for all PROD tenants
```

---

## User Story 2: Intelligent Conflict and Approval Management

**Priority**: P2
**Goal**: Automatically detect and notify PR owners when approvals are insufficient or merge conflicts exist.

### Test Scenario 2.1: Insufficient PR Approvals

**Prerequisites:**
- 2 JIRA tickets:
  - TEST-101: PR #201 with 2 approvals (approved)
  - TEST-102: PR #202 with only 1 approval (insufficient)

**Test Procedure:**

1. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

2. **Verify Workflow Pause**

Access n8n workflow execution at `http://localhost:5678/executions/<workflow_execution_id>`

**Validation Checklist:**
- [ ] Workflow status: `paused`
- [ ] Current node: `CheckApprovals`
- [ ] Pause reason: "PR #202 has insufficient approvals (1/2 required)"

3. **Verify Teams Notification to PR Owner**

Check Teams DM to `dev2@example.com` (owner of TEST-102):

Expected message:
```
Approval Required: PR #202 Blocking Release v1.2.0

Your pull request needs additional approval before it can be merged.

PR: #202 - Update database schema for users table
Current Approvals: 1/2 required
Approved By: reviewer1@example.com

Suggested Reviewers:
- reviewer2@example.com
- reviewer3@example.com
- reviewer4@example.com

Action Required:
Please request approval from one of the suggested reviewers.

PR Link: https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/202
```

**Validation Checklist:**
- [ ] Teams notification sent to `dev2@example.com` (PR owner)
- [ ] Severity: `warning`
- [ ] Current approval count: 1
- [ ] Required approval count: 2
- [ ] List of potential reviewers included
- [ ] PR link provided

4. **Verify Monitoring Dashboard Status**

Access dashboard at `http://localhost:3001`

**Expected Display:**
```
Release: v1.2.0 (Integration)
Status: BLOCKED - Waiting for Approvals

Ticket Status:
✓ TEST-101: Ready to merge (2/2 approvals)
⚠ TEST-102: Waiting for approval (1/2 approvals)

Blocking Issues:
- PR #202: Needs 1 more approval
  Owner: dev2@example.com
  Notified: 2025-10-19 12:00:05 UTC
```

**Validation Checklist:**
- [ ] Release status: `blocked`
- [ ] Clear indication of blocking ticket (TEST-102)
- [ ] Approval count displayed
- [ ] Notification timestamp shown

5. **Simulate Approval Addition**

Manually add second approval to PR #202 in Bitbucket staging.

6. **Verify Automatic Resume**

**Validation Checklist:**
- [ ] Workflow automatically resumes within 2 minutes (polling interval)
- [ ] Merge phase proceeds for both tickets
- [ ] Both tickets merged successfully
- [ ] Release completes normally

**Success Criteria:**
- [x] Insufficient approvals detected immediately
- [x] PR owner notified via Teams within 30 seconds
- [x] Potential reviewers list provided
- [x] Workflow pauses automatically
- [x] Workflow resumes automatically after approval obtained
- [x] Dashboard shows blocked status with clear reason

**Cleanup:**

```bash
# Reset PR approval count to 1 in Bitbucket staging
# Delete release branch
git push origin --delete release/v1.2.0
```

---

### Test Scenario 2.2: Merge Conflicts with Auto-Resolution

**Prerequisites:**
- 2 JIRA tickets:
  - TEST-101: PR #201 with no conflicts
  - TEST-103: PR #203 with merge conflict in `src/api/search.js`
- Conflict is simple (e.g., different log messages on adjacent lines)

**Test Procedure:**

1. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "auto_resolve_conflicts": true,
    "triggered_by": "tester@example.com"
  }'
```

2. **Verify AI Conflict Analysis**

Check n8n workflow execution logs:

Expected log entry:
```
[ConflictResolver] Analyzing conflict in TEST-103
[ConflictResolver] Conflicted files: src/api/search.js
[ConflictResolver] AI confidence score: 97.5%
[ConflictResolver] Confidence >= 95% threshold - applying auto-resolution
[ConflictResolver] Resolution: Accept both log messages (non-conflicting logic)
```

**Validation Checklist:**
- [ ] Conflict detected for TEST-103
- [ ] AI confidence score >= 95%
- [ ] Auto-resolution applied
- [ ] Merge succeeds without manual intervention

3. **Verify Merge Result**

```bash
git fetch origin
git show origin/development:src/api/search.js
```

**Validation Checklist:**
- [ ] File contains merged content from both branches
- [ ] No conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
- [ ] Code is syntactically valid

4. **Verify Audit Log**

Check dashboard audit log:

Expected event:
```
2025-10-19 12:01:30 UTC | conflict_detected | system | TEST-103: Conflict in src/api/search.js
2025-10-19 12:01:35 UTC | conflict_resolved | system | TEST-103: Auto-resolved with 97.5% confidence
```

**Validation Checklist:**
- [ ] Conflict detection event logged
- [ ] Auto-resolution event logged with confidence score
- [ ] No escalation event (confidence >= 95%)

**Success Criteria:**
- [x] Merge conflict detected automatically
- [x] AI confidence score calculated (>= 95%)
- [x] Auto-resolution applied successfully
- [x] Merge completes without manual intervention
- [x] Auto-resolution logged in audit trail

---

### Test Scenario 2.3: Merge Conflicts with Escalation

**Prerequisites:**
- 1 JIRA ticket:
  - TEST-104: PR #204 with complex merge conflict (e.g., conflicting logic changes)

**Test Procedure:**

1. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "auto_resolve_conflicts": true,
    "triggered_by": "tester@example.com"
  }'
```

2. **Verify AI Conflict Analysis**

Check n8n workflow execution logs:

Expected log entry:
```
[ConflictResolver] Analyzing conflict in TEST-104
[ConflictResolver] Conflicted files: src/services/payment.js
[ConflictResolver] AI confidence score: 72.3%
[ConflictResolver] Confidence < 95% threshold - escalating to PR owner
[ConflictResolver] Risk factors: conflicting business logic, potential data loss
```

**Validation Checklist:**
- [ ] Conflict detected for TEST-104
- [ ] AI confidence score < 95%
- [ ] Auto-resolution NOT applied
- [ ] Escalation triggered

3. **Verify Teams Notification to PR Owner**

Check Teams DM to `dev4@example.com` (owner of TEST-104):

Expected message:
```
Merge Conflict Detected: PR #204 Blocking Release v1.2.0

Your pull request has merge conflicts that require manual resolution.

PR: #204 - Add logging to payment processing

Conflicted Files:
- src/services/payment.js (lines 45-67)

AI Analysis:
Confidence Score: 72.3%
Risk Factors:
- Conflicting business logic changes
- Potential data loss if auto-resolved

Suggested Resolution:
Review both versions of the payment processing logic and ensure transaction handling is consistent. Consider adding integration test to verify payment flow.

Action Required:
Please resolve conflicts and update your PR. The release will resume automatically once conflicts are resolved.

PR Link: https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/204
```

**Validation Checklist:**
- [ ] Teams notification sent to PR owner
- [ ] Severity: `warning`
- [ ] Conflicted file paths provided
- [ ] AI confidence score included
- [ ] Risk factors explained
- [ ] Suggested resolution approach provided

4. **Verify Workflow Pause**

Access n8n workflow execution:

**Validation Checklist:**
- [ ] Workflow status: `paused`
- [ ] Pause reason: "PR #204 has unresolved merge conflicts"
- [ ] Current node: `MergeTickets`

5. **Simulate Conflict Resolution**

Manually resolve conflict in PR #204 in Bitbucket staging.

6. **Verify Automatic Resume**

**Validation Checklist:**
- [ ] Workflow resumes within 2 minutes (polling interval)
- [ ] Merge proceeds after conflict resolution
- [ ] Release completes normally

**Success Criteria:**
- [x] Merge conflict detected automatically
- [x] AI confidence score < 95% triggers escalation
- [x] PR owner notified with conflict details and suggestions
- [x] Workflow pauses automatically
- [x] Workflow resumes after manual resolution
- [x] No auto-merge attempted when confidence low

---

## User Story 3: Multi-Tenant Deployment Orchestration

**Priority**: P3
**Goal**: Deploy to multiple tenants in parallel with independent failure handling.

### Test Scenario 3.1: Parallel Deployment with All Tenants Successful

**Prerequisites:**
- 5 JIRA tickets tagged for v1.2.0
- All PRs approved
- All 5 tenants (tenant-a through tenant-e) configured for Integration environment
- All Jenkins jobs configured to succeed

**Test Procedure:**

1. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "target_environment": "Integration",
    "triggered_by": "tester@example.com"
  }'
```

2. **Monitor Jenkins Job Triggers**

Access Jenkins at `https://jenkins-staging.example.com/integration`

**Validation Checklist:**
- [ ] All 5 Jenkins jobs triggered simultaneously (within 5 seconds)
- [ ] Job parameters include:
  - `RELEASE_VERSION: "v1.2.0"`
  - `TENANT_ID: "tenant-a"` (respective tenant ID)
  - `ENVIRONMENT: "integration"`

3. **Monitor Dashboard Real-Time Updates**

Access dashboard at `http://localhost:3001`

**Expected Display (at T+30 seconds):**
```
Release: v1.2.0 (Integration)
Status: IN PROGRESS - Deploying

Tenant Deployment Status:
🔄 tenant-a: Running (Jenkins #456) - 0m 30s
🔄 tenant-b: Running (Jenkins #457) - 0m 30s
🔄 tenant-c: Running (Jenkins #458) - 0m 30s
🔄 tenant-d: Running (Jenkins #459) - 0m 30s
🔄 tenant-e: Running (Jenkins #460) - 0m 30s

Progress: 0/5 tenants deployed
Estimated Completion: 12:15:00 UTC
```

**Validation Checklist:**
- [ ] Dashboard updates every 10 seconds
- [ ] All tenants show status `running`
- [ ] Jenkins job links clickable
- [ ] Real-time duration counters

4. **Verify Parallel Execution**

Check n8n workflow execution logs:

Expected log entries (timestamps should be within seconds of each other):
```
2025-10-19 12:00:00.123 UTC | Triggered Jenkins job for tenant-a
2025-10-19 12:00:00.456 UTC | Triggered Jenkins job for tenant-b
2025-10-19 12:00:00.789 UTC | Triggered Jenkins job for tenant-c
2025-10-19 12:00:01.012 UTC | Triggered Jenkins job for tenant-d
2025-10-19 12:00:01.345 UTC | Triggered Jenkins job for tenant-e
```

**Validation Checklist:**
- [ ] All jobs triggered within 2 seconds
- [ ] Jobs run in parallel (not sequential)
- [ ] No dependency between tenant deployments

5. **Verify Deployment Completion**

Wait for all deployments to complete (~5 minutes per tenant).

**Expected Dashboard Display:**
```
Release: v1.2.0 (Integration)
Status: COMPLETED - All Tenants Deployed

Tenant Deployment Status:
✓ tenant-a: Success (4m 30s) - cache cleared
✓ tenant-b: Success (4m 40s) - cache cleared
✓ tenant-c: Success (4m 25s) - cache cleared
✓ tenant-d: Success (4m 50s) - cache cleared
✓ tenant-e: Success (4m 35s) - cache cleared

Progress: 5/5 tenants deployed
Total Duration: 12 minutes
Completed: 2025-10-19 12:12:00 UTC
```

**Validation Checklist:**
- [ ] All tenants status: `success`
- [ ] All tenants cache status: `cleared`
- [ ] Total deployment time < 15 minutes (parallel execution benefit)
- [ ] Individual tenant durations 4-5 minutes each

**Success Criteria:**
- [x] All 5 tenants deployed in parallel
- [x] No sequential dependencies between tenants
- [x] Total deployment time < 15 minutes (vs 25+ minutes sequential)
- [x] Dashboard shows real-time status for all tenants
- [x] Cache cleared by Jenkins for all tenants

---

### Test Scenario 3.2: Partial Deployment with Single Tenant Failure

**Prerequisites:**
- 5 JIRA tickets tagged for v1.2.0
- All PRs approved
- Configure tenant-c's Jenkins job to fail (e.g., set exit code 1)

**Test Procedure:**

1. **Configure Jenkins Job to Fail**

In Jenkins staging, modify `deploy-tenant-c-integration` job:
- Set build step to `exit 1` (simulates deployment failure)
- Or configure job to timeout

2. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "target_environment": "Integration",
    "triggered_by": "tester@example.com"
  }'
```

3. **Monitor Dashboard During Deployment**

**Expected Display (when tenant-c fails):**
```
Release: v1.2.0 (Integration)
Status: IN PROGRESS - Partial Deployment

Tenant Deployment Status:
✓ tenant-a: Success (4m 30s) - cache cleared
✓ tenant-b: Success (4m 40s) - cache cleared
❌ tenant-c: Failed (3m 15s) - retry in progress
🔄 tenant-d: Running (2m 30s)
🔄 tenant-e: Running (2m 45s)

Progress: 2/5 tenants deployed, 1 failed, 2 in progress
```

**Validation Checklist:**
- [ ] tenant-c marked as `failed`
- [ ] Retry initiated automatically (per FR-015)
- [ ] Other tenants (a, b, d, e) continue deployment
- [ ] No blocking of successful tenants

4. **Verify Retry Logic**

Check n8n workflow logs:

Expected log entries:
```
2025-10-19 12:03:15 UTC | Deployment failed for tenant-c (attempt 1/2)
2025-10-19 12:03:16 UTC | Retrying deployment for tenant-c
2025-10-19 12:06:45 UTC | Deployment failed for tenant-c (attempt 2/2)
2025-10-19 12:06:46 UTC | Max retry attempts reached for tenant-c - marking as failed
```

**Validation Checklist:**
- [ ] Retry attempted once (max 1 retry per Constitution)
- [ ] Second failure marked as final
- [ ] Retry count: 1

5. **Verify Final Status**

**Expected Dashboard Display:**
```
Release: v1.2.0 (Integration)
Status: PARTIALLY COMPLETED - 4/5 Tenants Deployed

Tenant Deployment Status:
✓ tenant-a: Success (4m 30s) - cache cleared
✓ tenant-b: Success (4m 40s) - cache cleared
❌ tenant-c: Failed after 2 attempts (6m 30s) - cache skipped
✓ tenant-d: Success (4m 50s) - cache cleared
✓ tenant-e: Success (4m 35s) - cache cleared

Progress: 4/5 tenants deployed successfully
Failed Tenants: 1 (tenant-c)
Total Duration: 13 minutes
Completed: 2025-10-19 12:13:00 UTC

Failure Details:
tenant-c: Jenkins job returned exit code 1
Error: Deployment script failed at line 45
Rollback Available: Yes
```

**Validation Checklist:**
- [ ] Release status: `partially_completed`
- [ ] 4 successful tenants show `cache cleared`
- [ ] 1 failed tenant shows `cache skipped`
- [ ] Error message from Jenkins included
- [ ] Rollback option available for tenant-c

6. **Verify JIRA Ticket Updates**

Check JIRA tickets TEST-101 through TEST-105:

**Expected Status:**
```
Status: Partially Deployed
```

**Expected Comment:**
```
Deployment to Integration completed with partial success.

Environment: Integration
Release: v1.2.0
Deployment Time: 2025-10-19 12:13:00 UTC

Successful Tenants (4):
- tenant-a (cache cleared)
- tenant-b (cache cleared)
- tenant-d (cache cleared)
- tenant-e (cache cleared)

Failed Tenants (1):
- tenant-c (cache skipped): Jenkins job returned exit code 1

Action Required:
Review tenant-c deployment failure and retry manually.
```

**Validation Checklist:**
- [ ] JIRA status: `Partially Deployed`
- [ ] Comment includes success/failure breakdown
- [ ] Environment (Integration) included
- [ ] Cache status per tenant included

7. **Verify Teams Notification**

Expected message:
```
Release v1.2.0 Deployed to Integration (Partial Success)

Status: WARNING - 4/5 Tenants Deployed
Tickets: 5 (TEST-101, TEST-102, TEST-103, TEST-104, TEST-105)
Environment: Integration

Successful Tenants (4):
✓ tenant-a: deployed (4m 30s) - cache cleared
✓ tenant-b: deployed (4m 40s) - cache cleared
✓ tenant-d: deployed (4m 50s) - cache cleared
✓ tenant-e: deployed (4m 35s) - cache cleared

Failed Tenants (1):
❌ tenant-c: deployment failed after 2 attempts (6m 30s) - cache skipped
   Error: Jenkins job returned exit code 1
   Rollback Available: Yes

Total Duration: 13 minutes
Completed: 2025-10-19 12:13:00 UTC

Action Required:
DevOps team please investigate tenant-c failure and retry deployment.
```

**Validation Checklist:**
- [ ] Severity: `warning` (partial failure)
- [ ] Clear breakdown of success/failure
- [ ] Cache status per tenant included
- [ ] Actionable next steps provided

**Success Criteria:**
- [x] Single tenant failure doesn't block other tenants
- [x] Failed tenant retried once automatically
- [x] Successful tenants (4) complete with cache cleared
- [x] Failed tenant (1) marked with cache skipped
- [x] JIRA status: `Partially Deployed` with tenant details
- [x] Teams notification includes success/failure breakdown
- [x] Rollback option available for failed tenant

**Cleanup:**

```bash
# Revert Jenkins job configuration for tenant-c
# Reset JIRA tickets
# Rollback successful tenants
```

---

### Test Scenario 3.3: Tenant-Specific Rollback

**Prerequisites:**
- Complete Scenario 3.2 (tenant-c failed, others succeeded)

**Test Procedure:**

1. **Trigger Rollback for Failed Tenant**

```bash
mcp call release-automation jenkins_rollback_tenant \
  --input '{
    "tenant_id": "tenant-c",
    "environment": "Integration",
    "previous_version": "v1.1.0",
    "rollback_reason": "Deployment failure - Jenkins job exit code 1"
  }'
```

2. **Verify Rollback Execution**

Expected output:
```json
{
  "rollback_id": "aa0e8400-e29b-41d4-a716-446655440010",
  "tenant_id": "tenant-c",
  "jenkins_queue_id": 789,
  "jenkins_job_url": "https://jenkins-staging.example.com/integration/job/rollback-tenant-c-integration/789/",
  "status": "queued",
  "triggered_at": "2025-10-19 12:20:00.000Z",
  "target_version": "v1.1.0"
}
```

**Validation Checklist:**
- [ ] Rollback job triggered for tenant-c only
- [ ] Other tenants (a, b, d, e) not affected
- [ ] Rollback target version: v1.1.0
- [ ] Rollback reason logged

3. **Monitor Rollback Progress**

Access dashboard rollback monitoring:

**Expected Display:**
```
Rollback: tenant-c to v1.1.0 (Integration)
Status: IN PROGRESS

Tenant: tenant-c
Environment: Integration
Target Version: v1.1.0
Reason: Deployment failure - Jenkins job exit code 1
Triggered By: system
Started: 2025-10-19 12:20:00 UTC
Duration: 2m 15s

Other Tenants: Not affected (remain on v1.2.0)
- tenant-a: v1.2.0 (deployed)
- tenant-b: v1.2.0 (deployed)
- tenant-d: v1.2.0 (deployed)
- tenant-e: v1.2.0 (deployed)
```

**Validation Checklist:**
- [ ] Rollback status tracked separately
- [ ] Other tenants remain on v1.2.0
- [ ] Rollback reason displayed

4. **Verify Rollback Completion**

Expected final status:
```
Rollback: tenant-c to v1.1.0 (Integration)
Status: COMPLETED

Tenant: tenant-c
Environment: Integration
Rolled Back To: v1.1.0
Duration: 8m 30s
Completed: 2025-10-19 12:28:30 UTC

Verification:
✓ Application version: v1.1.0
✓ Database schema: rolled back
✓ Configuration: restored
✓ Health check: passing
```

**Validation Checklist:**
- [ ] Rollback completes successfully
- [ ] Rollback duration < 15 minutes (per Constitution)
- [ ] tenant-c now on v1.1.0
- [ ] Other tenants still on v1.2.0

5. **Verify Teams Notification**

Expected message:
```
Rollback Completed: tenant-c (Integration)

Tenant: tenant-c
Environment: Integration
Previous Version: v1.2.0
Rolled Back To: v1.1.0
Reason: Deployment failure - Jenkins job exit code 1

Duration: 8m 30s
Completed: 2025-10-19 12:28:30 UTC

Status: SUCCESS
All health checks passing on v1.1.0

Other Tenants:
tenant-a, tenant-b, tenant-d, tenant-e remain on v1.2.0
```

**Validation Checklist:**
- [ ] Teams notification sent
- [ ] Rollback success confirmed
- [ ] Clear indication other tenants unaffected

**Success Criteria:**
- [x] Rollback executed for single tenant only
- [x] Other tenants remain on v1.2.0 (no impact)
- [x] Rollback completes within 15 minutes
- [x] Dashboard shows isolated rollback status
- [x] Teams notification confirms success

---

## User Story 4: Real-Time Monitoring and Observability

**Priority**: P4
**Goal**: Provide real-time visibility into deployment operations via monitoring dashboard.

### Test Scenario 4.1: Dashboard Real-Time Updates

**Prerequisites:**
- Release v1.2.0 ready to deploy
- Dashboard running at `http://localhost:3001`

**Test Procedure:**

1. **Open Dashboard Before Release**

Access dashboard at `http://localhost:3001`

**Expected Initial Display:**
```
Release Automation Dashboard

Active Releases: None
Recent Deployments: (shows last 10 deployments)
System Status: All systems operational
```

**Validation Checklist:**
- [ ] Dashboard loads successfully
- [ ] No active releases shown
- [ ] Recent deployments list populated (if any previous tests)

2. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "target_environment": "Integration",
    "triggered_by": "tester@example.com"
  }'
```

3. **Verify Real-Time Phase Updates**

**Expected Display (T+10 seconds - Merge Phase):**
```
Release: v1.2.0 (Integration)
Status: IN PROGRESS
Current Phase: MERGE
Environment: Integration
Progress: 20%
Elapsed: 0m 10s
ETA: 12:15:00 UTC

Merge Phase:
✓ TEST-101: Merged (commit: abc1234)
🔄 TEST-102: Merging...
⏳ TEST-103: Pending
⏳ TEST-104: Pending
⏳ TEST-105: Pending

Tickets: 5 total (1 merged, 1 in progress, 3 pending)
```

**Validation Checklist:**
- [ ] Dashboard updates within 10 seconds of release trigger
- [ ] Current phase: `MERGE`
- [ ] Real-time ticket merge status
- [ ] Progress percentage updates
- [ ] ETA calculation displayed

4. **Verify Deployment Phase Updates**

**Expected Display (T+5 minutes - Deployment Phase):**
```
Release: v1.2.0 (Integration)
Status: IN PROGRESS
Current Phase: DEPLOYMENT
Environment: Integration
Progress: 60%
Elapsed: 5m 00s
ETA: 12:12:00 UTC

Merge Phase: ✓ Completed (5 tickets merged)

Deployment Phase:
✓ tenant-a: Success (4m 30s) - cache cleared
✓ tenant-b: Success (4m 40s) - cache cleared
🔄 tenant-c: Running (2m 15s)
🔄 tenant-d: Running (2m 05s)
🔄 tenant-e: Running (2m 20s)

Tenants: 5 total (2 deployed, 3 running, 0 failed)
```

**Validation Checklist:**
- [ ] Phase changed to `DEPLOYMENT`
- [ ] Merge phase marked as completed
- [ ] Per-tenant deployment status shown
- [ ] Real-time duration counters
- [ ] Cache clear status per tenant
- [ ] Progress updates every 10 seconds

5. **Verify WebSocket/SSE Real-Time Connection**

Open browser developer console → Network tab

**Validation Checklist:**
- [ ] WebSocket connection established to `ws://localhost:3002`
- [ ] OR Server-Sent Events connection to `http://localhost:3001/events`
- [ ] Real-time events received every 10 seconds
- [ ] No polling (efficient real-time updates)

Example WebSocket messages:
```json
{
  "event": "deployment_status_update",
  "timestamp": "2025-10-19T12:05:30.000Z",
  "data": {
    "release_id": "880e8400-e29b-41d4-a716-446655440003",
    "tenant_id": "tenant-a",
    "status": "success",
    "duration_ms": 270000,
    "cache_clear_status": "cleared"
  }
}
```

6. **Verify Post-Deployment Phase Updates**

**Expected Display (T+12 minutes - Post-Deployment Phase):**
```
Release: v1.2.0 (Integration)
Status: IN PROGRESS
Current Phase: POST-DEPLOYMENT
Environment: Integration
Progress: 95%
Elapsed: 12m 00s
ETA: 12:12:30 UTC

Deployment Phase: ✓ Completed (5/5 tenants deployed successfully)

Post-Deployment Phase:
✓ Cache Clearing: Completed (all tenants - handled by Jenkins)
🔄 JIRA Updates: In progress (3/5 tickets updated)
⏳ Teams Notification: Pending
```

**Validation Checklist:**
- [ ] Phase changed to `POST-DEPLOYMENT`
- [ ] Cache clearing status confirmed (all tenants)
- [ ] JIRA update progress shown
- [ ] Teams notification pending

7. **Verify Completion Display**

**Expected Final Display:**
```
Release: v1.2.0 (Integration)
Status: COMPLETED
Environment: Integration
Duration: 12m 45s
Completed: 2025-10-19 12:12:45 UTC

Summary:
✓ 5 tickets merged to development
✓ Release branch created: release/v1.2.0
✓ 5/5 tenants deployed successfully
✓ All caches cleared (by Jenkins)
✓ 5 JIRA tickets updated to Deployed
✓ Teams announcement sent

Audit Trail: View Full Log →
```

**Validation Checklist:**
- [ ] Status: `COMPLETED`
- [ ] Total duration displayed
- [ ] Summary of all completed actions
- [ ] Link to full audit trail

8. **Verify Audit Trail View**

Click "View Full Log" button

**Expected Audit Log Display:**
```
Audit Trail: Release v1.2.0 (Integration)

[2025-10-19 12:00:00 UTC] RELEASE_CREATED
Actor: tester@example.com
Details: Release v1.2.0 created for Integration environment

[2025-10-19 12:00:05 UTC] MERGE_INITIATED
Actor: system
Details: Starting merge of 5 tickets to development branch

[2025-10-19 12:00:15 UTC] MERGE_COMPLETED
Actor: system
Details: TEST-101 merged (commit: abc1234)
Files: src/api/auth.js, src/api/auth.test.js

[2025-10-19 12:00:25 UTC] MERGE_COMPLETED
Actor: system
Details: TEST-102 merged (commit: def5678)
Files: db/migrations/001_users.sql

... (all events)

[2025-10-19 12:10:00 UTC] JIRA_UPDATED
Actor: system
Details: Ticket TEST-101 status updated to Deployed
Environment: Integration

[2025-10-19 12:12:45 UTC] NOTIFICATION_SENT
Actor: system
Details: Deployment announcement sent to Teams channel
Recipients: release-channel (123 members)
```

**Validation Checklist:**
- [ ] All events logged with timestamps (UTC)
- [ ] Actor identified (user email or `system`)
- [ ] Event details include affected entities
- [ ] Environment included in relevant events
- [ ] Filterable by event type
- [ ] Searchable by ticket ID, tenant ID, or timestamp

**Success Criteria:**
- [x] Dashboard displays real-time updates every 10 seconds
- [x] Current phase shown clearly (Merge/Deployment/Post-Deployment)
- [x] Per-tenant deployment status with durations
- [x] Progress percentage and ETA calculated
- [x] Cache clear status per tenant
- [x] Complete audit trail with all events
- [x] WebSocket/SSE real-time connection (no polling)
- [x] Historical view accessible after completion

---

### Test Scenario 4.2: Dashboard Action Triggering

**Prerequisites:**
- Dashboard has MCP client integration enabled
- User authenticated with appropriate permissions

**Test Procedure:**

1. **Access Dashboard Action Panel**

Navigate to dashboard at `http://localhost:3001` → Actions tab

**Expected Display:**
```
Release Actions

[Button] Trigger New Release
[Button] View Active Releases
[Button] Rollback Tenant
```

**Validation Checklist:**
- [ ] Action buttons visible
- [ ] User permissions checked (buttons disabled if unauthorized)

2. **Trigger Release from Dashboard**

Click "Trigger New Release" button

**Expected Form:**
```
Trigger New Release

Release Version: [v1.2.0      ] (required)
Release Type:    [▼ Regular   ] (required)
Environment:     [▼ Integration] (optional - defaults to .env)
Tenants:         [☑ All Tenants] (or select specific tenants)

Auto-Resolve Conflicts: [☑] (default: enabled)
Pause on Blockers:      [☑] (default: enabled)

[Cancel] [Trigger Release]
```

**Validation Checklist:**
- [ ] Form validates required fields
- [ ] Environment dropdown shows allowed options based on release type
- [ ] Tenant selection shows all configured tenants for environment
- [ ] Defaults populated from configuration

3. **Submit Release Trigger**

Fill form and click "Trigger Release"

**Expected Behavior:**
- [ ] Loading indicator shown
- [ ] MCP client calls `trigger_release_deployment` tool
- [ ] Dashboard navigates to release monitoring view
- [ ] Real-time updates begin immediately

4. **Verify MCP Client Integration**

Check browser developer console → Network tab

**Expected Request:**
```
POST http://localhost:3000/mcp
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "trigger_release_deployment",
    "arguments": {
      "release_version": "v1.2.0",
      "release_type": "regular",
      "target_environment": "Integration",
      "triggered_by": "dashboard-user@example.com",
      "auto_resolve_conflicts": true,
      "pause_on_blockers": true
    }
  },
  "id": 1
}
```

**Validation Checklist:**
- [ ] MCP client sends JSON-RPC request to MCP server
- [ ] Request uses correct MCP protocol format
- [ ] Response received and parsed correctly

**Success Criteria:**
- [x] Dashboard can trigger releases via MCP client
- [x] User-friendly form with validation
- [x] Environment restrictions enforced (regular vs hotfix)
- [x] Triggered release appears immediately in monitoring view
- [x] MCP client integration working correctly

---

### Test Scenario 4.3: Historical Deployment Filtering

**Prerequisites:**
- At least 10 completed deployments in database
- Mix of environments (Integration, UAT, PROD)
- Mix of statuses (completed, partially_completed, failed)

**Test Procedure:**

1. **Access Historical View**

Navigate to dashboard at `http://localhost:3001` → History tab

**Expected Display:**
```
Deployment History

Filters:
Environment: [▼ All        ]
Release Type: [▼ All        ]
Status:       [▼ All        ]
Date Range:   [Last 30 Days ▼]
Search:       [              ] (ticket ID, release version, tenant)

[Apply Filters]

Results: 10 deployments

| Release  | Type    | Environment | Status           | Tenants | Duration | Completed           |
|----------|---------|-------------|------------------|---------|----------|---------------------|
| v1.2.0   | Regular | Integration | Completed        | 5/5     | 12m 45s  | 2025-10-19 12:12:45 |
| v1.1.1   | Hotfix  | PROD        | Completed        | 5/5     | 18m 30s  | 2025-10-18 15:45:20 |
| v1.1.0   | Regular | UAT         | Partially Comp.  | 4/5     | 15m 10s  | 2025-10-17 10:30:00 |
...
```

**Validation Checklist:**
- [ ] All filters available
- [ ] Search box functional
- [ ] Results paginated (10 per page)
- [ ] Clickable rows for details

2. **Test Environment Filter**

Select "PROD" from Environment dropdown → Click "Apply Filters"

**Expected Results:**
- Only deployments to PROD environment shown
- All displayed deployments have "Environment: PROD"
- Hotfix releases only (regular releases blocked from PROD)

**Validation Checklist:**
- [ ] Filter applied correctly
- [ ] Only PROD deployments shown
- [ ] Result count updated

3. **Test Status Filter**

Select "Partially Completed" from Status dropdown → Click "Apply Filters"

**Expected Results:**
- Only deployments with partial tenant failures shown
- Each row shows failed tenant count (e.g., "4/5 tenants")

**Validation Checklist:**
- [ ] Filter applied correctly
- [ ] Only partially completed deployments shown

4. **Test Search by Ticket ID**

Enter "TEST-101" in search box → Press Enter

**Expected Results:**
- Only deployments containing ticket TEST-101 shown
- Ticket ID highlighted in results

**Validation Checklist:**
- [ ] Search applied correctly
- [ ] Only matching deployments shown

5. **Test Search by Release Version**

Enter "v1.2.0" in search box → Press Enter

**Expected Results:**
- Only deployments for release v1.2.0 shown

**Validation Checklist:**
- [ ] Search applied correctly
- [ ] Only matching release shown

6. **View Deployment Details**

Click on a deployment row

**Expected Detail View:**
```
Deployment Details: v1.2.0 (Integration)

Overview:
Release Version: v1.2.0
Type: Regular
Environment: Integration
Status: Completed
Duration: 12m 45s
Completed: 2025-10-19 12:12:45 UTC
Triggered By: tester@example.com

Tickets (5):
- TEST-101: Add user authentication endpoint
- TEST-102: Update database schema for users table
- TEST-103: Fix pagination bug in search API
- TEST-104: Add logging to payment processing
- TEST-105: Update API documentation for v1.2.0

Tenant Deployment Status:
✓ tenant-a: Success (4m 30s) - cache cleared
✓ tenant-b: Success (4m 40s) - cache cleared
✓ tenant-c: Success (4m 25s) - cache cleared
✓ tenant-d: Success (4m 50s) - cache cleared
✓ tenant-e: Success (4m 35s) - cache cleared

Audit Trail: (47 events)
[View Full Audit Log]
```

**Validation Checklist:**
- [ ] All deployment metadata shown
- [ ] Ticket list with summaries
- [ ] Per-tenant status and cache status
- [ ] Link to full audit trail

**Success Criteria:**
- [x] Historical deployments filterable by environment, status, date
- [x] Search by ticket ID, release version, tenant ID
- [x] Paginated results (10 per page)
- [x] Detailed view for each deployment
- [x] Audit trail accessible from historical view

---

## User Story 5: Documentation and Integration Extensibility

**Priority**: P5
**Goal**: Enable system administrators to add new integrations by following comprehensive documentation.

### Test Scenario 5.1: Adding Slack Notification Integration

**Prerequisites:**
- MCP server running
- Slack workspace created with bot configured
- Slack API token available

**Test Procedure:**

1. **Follow Documentation: Adding New Integrations**

Open documentation at `/docs/adding-integrations.md`

**Verify Documentation Includes:**
- [ ] Step-by-step integration guide
- [ ] MCP tool schema template
- [ ] Example tool implementation
- [ ] n8n workflow node configuration
- [ ] Testing checklist

2. **Define MCP Tool Schema**

Create new file: `mcp-server/src/tools/slack/notify-channel.ts`

**Example from Documentation:**

```typescript
import { z } from 'zod';
import { MCPTool } from '../../types/mcp-tool';

const slackNotifyChannelInputSchema = z.object({
  channel_id: z.string().describe('Slack channel ID (e.g., "C01234567")'),
  message: z.string().max(3000).describe('Message content (plain text or markdown)'),
  severity: z.enum(['info', 'warning', 'critical']).describe('Message severity level'),
  blocks: z.array(z.any()).optional().describe('Slack Block Kit blocks for rich formatting')
});

const slackNotifyChannelOutputSchema = z.object({
  notification_id: z.string().uuid().describe('Unique notification identifier'),
  channel_id: z.string().describe('Slack channel ID'),
  message_ts: z.string().describe('Slack message timestamp'),
  delivery_status: z.enum(['delivered', 'failed']).describe('Delivery status'),
  error_message: z.string().optional().describe('Error description if failed')
});

export const slackNotifyChannelTool: MCPTool = {
  name: 'slack_notify_channel',
  version: '1.0.0',
  description: 'Sends notification to Slack channel with severity-based formatting',
  idempotent: false,
  input_schema: slackNotifyChannelInputSchema,
  output_schema: slackNotifyChannelOutputSchema,
  handler: async (input) => {
    // Implementation follows...
  }
};
```

**Validation Checklist:**
- [ ] Schema definition follows MCP tool template
- [ ] Input validation using Zod
- [ ] Output schema defined
- [ ] Tool metadata includes version, description, idempotency

3. **Implement Tool Handler**

**Example from Documentation:**

```typescript
import { WebClient } from '@slack/web-api';
import { getSecret } from '../../providers/secrets';

export async function handleSlackNotifyChannel(input: SlackNotifyChannelInput): Promise<SlackNotifyChannelOutput> {
  // Retrieve Slack token from secrets manager
  const slackToken = await getSecret('slack-bot-token');

  const client = new WebClient(slackToken);

  try {
    const result = await client.chat.postMessage({
      channel: input.channel_id,
      text: input.message,
      blocks: input.blocks
    });

    return {
      notification_id: generateUUID(),
      channel_id: input.channel_id,
      message_ts: result.ts!,
      delivery_status: 'delivered'
    };
  } catch (error) {
    return {
      notification_id: generateUUID(),
      channel_id: input.channel_id,
      message_ts: '',
      delivery_status: 'failed',
      error_message: error.message
    };
  }
}
```

**Validation Checklist:**
- [ ] Secrets retrieved from configured secrets provider
- [ ] Error handling implemented
- [ ] Structured output returned
- [ ] Logging included (sanitized - no tokens)

4. **Register Tool with MCP Server**

Edit `mcp-server/src/index.ts`:

```typescript
import { slackNotifyChannelTool } from './tools/slack/notify-channel';

// Register tool
server.registerTool(slackNotifyChannelTool);
```

**Validation Checklist:**
- [ ] Tool registered in server initialization
- [ ] Server restarts successfully

5. **Test Tool via MCP CLI**

```bash
mcp call release-automation slack_notify_channel \
  --input '{
    "channel_id": "C01234567",
    "message": "Test notification from release automation system",
    "severity": "info"
  }'
```

**Expected Output:**

```json
{
  "notification_id": "bb0e8400-e29b-41d4-a716-446655440020",
  "channel_id": "C01234567",
  "message_ts": "1729339200.123456",
  "delivery_status": "delivered"
}
```

**Validation Checklist:**
- [ ] Tool callable via MCP CLI
- [ ] Message delivered to Slack channel
- [ ] Delivery status: `delivered`

6. **Configure n8n Workflow Node**

**Follow Documentation Steps:**

Access n8n at `http://localhost:5678` → Open `release-deployment` workflow

**Add New Node:**
- Node Type: HTTP Request
- Method: POST
- URL: `http://mcp-server:3000/mcp`
- Headers:
  - Content-Type: application/json
- Body:
  ```json
  {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_notify_channel",
      "arguments": {
        "channel_id": "{{ $env.SLACK_CHANNEL_ID }}",
        "message": "Release {{ $node.TriggerRelease.json.release_version }} deployed to {{ $node.TriggerRelease.json.target_environment }}",
        "severity": "info"
      }
    },
    "id": "{{ $runIndex }}"
  }
  ```

**Validation Checklist:**
- [ ] Node added to workflow
- [ ] MCP tool called correctly
- [ ] Environment variables referenced
- [ ] Workflow variables used for dynamic content

7. **Test Workflow with Slack Integration**

Trigger release and verify Slack notification sent:

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

**Validation Checklist:**
- [ ] Workflow executes successfully
- [ ] Slack notification sent to configured channel
- [ ] Message includes release version and environment
- [ ] Slack notification logged in audit trail

8. **Verify Dashboard Auto-Discovery**

Access dashboard at `http://localhost:3001` → Audit Log

**Expected Event:**
```
2025-10-19 12:15:00 UTC | notification_sent | system
Integration: Slack
Channel: release-notifications (C01234567)
Message: Release v1.2.0 deployed to Integration
Delivery Status: delivered
```

**Validation Checklist:**
- [ ] Dashboard automatically includes Slack in audit logs
- [ ] No code changes required to dashboard
- [ ] Notification delivery tracked

**Success Criteria:**
- [x] New integration (Slack) added by following documentation
- [x] MCP tool schema defined correctly
- [x] Tool implementation follows template
- [x] Secrets managed via configured provider
- [x] n8n workflow node configured
- [x] Integration tested successfully
- [x] Dashboard automatically includes new integration in audit logs
- [x] No changes to existing integrations required

**Time Taken:**
- [ ] Completed in under 4 hours (per SC-008)

---

### Test Scenario 5.2: Modifying Approval Threshold Configuration

**Prerequisites:**
- System running with default 2-approval requirement

**Test Procedure:**

1. **Follow Documentation: Configuration Guide**

Open documentation at `/docs/configuration.md` → Approval Settings

**Verify Documentation Includes:**
- [ ] Configuration file location
- [ ] Parameter descriptions
- [ ] Validation rules
- [ ] Restart requirements

2. **Update Configuration**

Edit `config/.env`:

```env
# Change from default 2 to 3
REQUIRED_PR_APPROVALS=3
```

**Validation Checklist:**
- [ ] Configuration parameter documented
- [ ] Valid range specified (e.g., 1-10)
- [ ] Default value documented (2)

3. **Restart MCP Server**

```bash
docker-compose restart mcp-server
```

**Validation Checklist:**
- [ ] Server restarts without errors
- [ ] Configuration change logged:
  ```
  2025-10-19 12:30:00 UTC | CONFIG_CHANGED | admin@example.com
  Parameter: REQUIRED_PR_APPROVALS
  Previous Value: 2
  New Value: 3
  ```

4. **Verify New Threshold Enforced**

Create test PR with only 2 approvals:

```bash
mcp call release-automation git_check_pr_approvals \
  --input '{
    "pr_id": "206",
    "required_approvals": 3
  }'
```

**Expected Output:**

```json
{
  "pr_id": "206",
  "approval_count": 2,
  "required_approvals": 3,
  "approved": false,
  "approvers": ["reviewer1@example.com", "reviewer2@example.com"],
  "potential_reviewers": ["reviewer3@example.com", "reviewer4@example.com"],
  "pr_url": "https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/206"
}
```

**Validation Checklist:**
- [ ] `approved: false` (2 < 3 required)
- [ ] New threshold (3) enforced
- [ ] Potential reviewers suggested

5. **Verify Teams Notification Reflects New Threshold**

Expected message:
```
Approval Required: PR #206 Blocking Release

Current Approvals: 2/3 required
Approved By: reviewer1@example.com, reviewer2@example.com

Action Required:
Please request approval from one of the suggested reviewers.
```

**Validation Checklist:**
- [ ] Notification shows "2/3 required" (new threshold)
- [ ] No code changes required

**Success Criteria:**
- [x] Approval threshold configurable via `.env`
- [x] Configuration change requires only server restart
- [x] New threshold enforced immediately
- [x] Configuration change logged in audit trail
- [x] No code changes required

---

## Edge Case Scenarios

### Edge Case 1: Regular Release Attempting PROD Deployment

**Covered in:** Test Scenario 1.3

**Validation:**
- [x] System rejects request immediately
- [x] Error message: "Regular releases cannot deploy to PROD. Use hotfix branch for production deployments."
- [x] Teams notification sent to release manager
- [x] Attempt logged in audit trail

---

### Edge Case 2: JIRA API Unavailable During Ticket Updates

**Test Procedure:**

1. **Simulate JIRA Outage**

Configure firewall rule to block JIRA staging API:

```bash
# Block JIRA API endpoint
sudo iptables -A OUTPUT -d jira-staging.example.com -j DROP
```

2. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

3. **Verify Deployment Continues**

**Expected Behavior:**
- [ ] Merge phase completes successfully
- [ ] Release branch created
- [ ] Deployments proceed to all tenants
- [ ] Cache clearing completes
- [ ] JIRA update fails with retries

4. **Verify JIRA Update Retry Logic**

Check n8n workflow logs:

Expected log entries:
```
2025-10-19 12:10:00 UTC | JIRA update attempt 1/5 failed: Connection timeout
2025-10-19 12:10:05 UTC | JIRA update attempt 2/5 failed: Connection timeout (retry in 10s)
2025-10-19 12:10:15 UTC | JIRA update attempt 3/5 failed: Connection timeout (retry in 20s)
2025-10-19 12:10:35 UTC | JIRA update attempt 4/5 failed: Connection timeout (retry in 40s)
2025-10-19 12:11:15 UTC | JIRA update attempt 5/5 failed: Connection timeout (retry in 80s)
2025-10-19 12:12:35 UTC | JIRA update queued for later retry (exponential backoff)
```

**Validation Checklist:**
- [ ] Exponential backoff implemented (5s, 10s, 20s, 40s, 80s)
- [ ] JIRA failure doesn't block deployment workflow
- [ ] Updates queued for retry

5. **Verify Teams Notification to Ops Team**

Expected message:
```
JIRA Integration Issue Detected

Release: v1.2.0 (Integration)
Issue: Unable to update ticket status after deployment

Details:
- 5 tickets could not be updated to "Deployed" status
- Tickets: TEST-101, TEST-102, TEST-103, TEST-104, TEST-105
- Error: Connection timeout after 5 retry attempts
- Updates queued for automatic retry

Action Required:
Ops team please check JIRA staging API availability.
Ticket updates will retry automatically every 5 minutes until successful.

Deployment Status: COMPLETED (deployment succeeded, only JIRA updates pending)
```

**Validation Checklist:**
- [ ] Ops team notified of JIRA issue
- [ ] Severity: `warning` (not critical - deployment succeeded)
- [ ] Clear indication deployment completed successfully
- [ ] Retry plan communicated

6. **Restore JIRA Access and Verify Auto-Retry**

```bash
# Restore JIRA access
sudo iptables -D OUTPUT -d jira-staging.example.com -j DROP
```

Wait for automatic retry (~5 minutes)

**Expected Behavior:**
- [ ] JIRA updates retry automatically
- [ ] All 5 tickets updated to "Deployed" status
- [ ] Success notification sent to Teams

**Success Criteria:**
- [x] JIRA failure doesn't block deployment workflow
- [x] Exponential backoff retry logic implemented
- [x] Updates queued for automatic retry
- [x] Ops team notified of integration issue
- [x] Deployment marked as completed (not failed)
- [x] Automatic recovery when JIRA restored

---

### Edge Case 3: All Potential Reviewers on Vacation

**Test Procedure:**

1. **Configure PR with Insufficient Approvals**

Create PR #207 with:
- 1 approval
- 2 required approvals
- All potential reviewers marked as "on vacation" in team calendar

2. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

3. **Verify Initial Escalation**

**Expected Teams Notification to PR Owner:**
```
Approval Required: PR #207 Blocking Release

Current Approvals: 1/2 required
Approved By: reviewer1@example.com

Suggested Reviewers:
⚠ reviewer2@example.com (on vacation until 2025-10-25)
⚠ reviewer3@example.com (on vacation until 2025-10-26)
⚠ reviewer4@example.com (on vacation until 2025-10-24)
```

**Validation Checklist:**
- [ ] Vacation status indicated for each reviewer
- [ ] PR owner notified

4. **Wait 1 Hour Without Response**

**Verify Fallback Escalation:**

Expected Teams message to fallback approvers:

```
CRITICAL: Release Blocked - Approval Needed

Release: v1.2.0
Status: BLOCKED for 1 hour - no approvals obtained

PR: #207 - Add new feature
Owner: dev6@example.com (notified 1 hour ago)
Current Approvals: 1/2 required

Issue: All suggested reviewers are on vacation

Action Required:
Designated fallback approvers please review and approve PR #207 urgently.

Fallback Approvers:
- engineering-lead@example.com
- tech-lead@example.com
- devops-lead@example.com

PR Link: https://bitbucket-staging.example.com/projects/TEST/repos/api/pull-requests/207
```

**Validation Checklist:**
- [ ] Escalated to engineering lead after 1 hour
- [ ] Severity: `critical`
- [ ] Clear explanation of situation
- [ ] Fallback approver list provided

5. **Verify Dashboard Alert**

**Expected Display:**
```
Release: v1.2.0 (Integration)
Status: BLOCKED - Critical Escalation

Blocking Issue:
PR #207: Waiting for approval (1/2 required)
Owner: dev6@example.com
Duration: 1h 15m
Escalation Level: CRITICAL (fallback approvers notified)

All potential reviewers unavailable (vacation).
Fallback approvers: engineering-lead, tech-lead, devops-lead
```

**Validation Checklist:**
- [ ] Dashboard shows critical alert
- [ ] Escalation level indicated
- [ ] Duration tracked

**Success Criteria:**
- [x] Vacation status detected for reviewers
- [x] Initial notification sent to PR owner
- [x] Escalation to fallback approvers after 1 hour
- [x] Critical alert sent to engineering lead and DevOps team
- [x] Dashboard shows escalation status

---

### Edge Case 4: n8n Workflow Execution Fails Mid-Deployment

**Test Procedure:**

1. **Simulate n8n Crash During Deployment Phase**

While deployment is in progress, stop n8n container:

```bash
docker-compose stop n8n
```

2. **Verify Workflow State Persistence**

**Expected Behavior:**
- [ ] Workflow execution saved with last successful checkpoint
- [ ] State snapshot includes:
  - Current phase: `deployment`
  - Tickets merged: 5/5
  - Tenants deployed: 2/5
  - In-progress deployments: tenant-c, tenant-d, tenant-e

3. **Restart n8n**

```bash
docker-compose start n8n
```

4. **Access n8n Recovery Console**

Navigate to `http://localhost:5678/executions/<workflow_execution_id>`

**Expected Display:**
```
Workflow Interrupted

Execution ID: 990e8400-e29b-41d4-a716-446655440004
Release: v1.2.0 (Integration)
Status: Interrupted
Last Checkpoint: deployment_phase_partial

State Snapshot:
- Merge Phase: ✓ Completed (5 tickets)
- Release Branch: ✓ Created (release/v1.2.0)
- Tenant Deployments:
  ✓ tenant-a: Completed
  ✓ tenant-b: Completed
  🔄 tenant-c: Running (unknown status)
  🔄 tenant-d: Running (unknown status)
  🔄 tenant-e: Running (unknown status)

Recovery Options:
[Resume Workflow] - Continue from last checkpoint
[Rollback] - Rollback all completed tenants
[Cancel] - Cancel release
```

**Validation Checklist:**
- [ ] Workflow shows `Interrupted` status
- [ ] Last checkpoint identified
- [ ] State snapshot includes all progress
- [ ] Recovery options available

5. **Verify Monitoring Dashboard Shows Interrupted Status**

Access dashboard at `http://localhost:3001`

**Expected Display:**
```
Release: v1.2.0 (Integration)
Status: WORKFLOW INTERRUPTED

Last Known State:
- Merge Phase: ✓ Completed
- Deployment Phase: Partial (2/5 tenants completed)
- Post-Deployment Phase: Not started

Recovery:
The workflow execution was interrupted. Manual intervention required.
[View Recovery Options in n8n]
```

**Validation Checklist:**
- [ ] Dashboard shows `Interrupted` status
- [ ] Last known state displayed
- [ ] Link to n8n recovery console

6. **Resume Workflow**

Click "Resume Workflow" in n8n

**Expected Behavior:**
- [ ] Workflow queries Jenkins for status of tenant-c, tenant-d, tenant-e
- [ ] Discovers current status:
  - tenant-c: Success (completed during outage)
  - tenant-d: Success (completed during outage)
  - tenant-e: Failed (timeout during outage)
- [ ] Retries tenant-e deployment
- [ ] Continues to post-deployment phase

7. **Verify Recovery Completion**

**Expected Final Status:**
```
Release: v1.2.0 (Integration)
Status: COMPLETED (Recovered from Interruption)

Duration: 18m 45s (includes 5m interruption)
Tenants: 5/5 deployed successfully
Recovery: Workflow resumed successfully after interruption
```

**Validation Checklist:**
- [ ] Release completes successfully after recovery
- [ ] All tenants deployed
- [ ] Interruption logged in audit trail

**Success Criteria:**
- [x] Workflow state persisted at phase boundaries
- [x] Recovery options available after interruption
- [x] Dashboard shows interrupted status
- [x] Manual resume capability works
- [x] Workflow queries external state (Jenkins) to reconcile
- [x] Release completes successfully after recovery

---

### Edge Case 5: Cache Clearing Timeout in Jenkins Job

**Test Procedure:**

1. **Configure Jenkins Job with Cache Timeout**

Modify `deploy-tenant-c-integration` job to set:
- Cache clearing operation timeout after 3 minutes
- Job still succeeds but sets `CACHE_CLEAR_STATUS=failed`

2. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

3. **Verify Deployment Proceeds Despite Cache Timeout**

**Expected Deployment Status:**
```
tenant-a: Success (4m 30s) - cache cleared
tenant-b: Success (4m 40s) - cache cleared
tenant-c: Success (4m 25s) - cache failed (timeout)
tenant-d: Success (4m 50s) - cache cleared
tenant-e: Success (4m 35s) - cache cleared
```

**Validation Checklist:**
- [ ] tenant-c deployment status: `success` (deployment succeeded)
- [ ] tenant-c cache clear status: `failed` (cache timeout)
- [ ] Deployment NOT blocked by cache failure

4. **Verify Teams Notification Includes Cache Status**

Expected message:
```
Release v1.2.0 Deployed to Integration (Cache Warning)

Status: SUCCESS (with cache clearing issues)
Tickets: 5 (TEST-101, TEST-102, TEST-103, TEST-104, TEST-105)
Environment: Integration

Tenant Status:
✓ tenant-a: deployed (4m 30s) - cache cleared
✓ tenant-b: deployed (4m 40s) - cache cleared
⚠ tenant-c: deployed (4m 25s) - cache clearing failed (timeout)
✓ tenant-d: deployed (4m 50s) - cache cleared
✓ tenant-e: deployed (4m 35s) - cache cleared

Warning:
Cache clearing failed for tenant-c due to timeout. Manual cache clear may be required.

Total Duration: 12 minutes
Completed: 2025-10-19 12:12:00 UTC
```

**Validation Checklist:**
- [ ] Severity: `warning` (not `info`)
- [ ] Cache failure clearly indicated for tenant-c
- [ ] Deployment overall marked as success
- [ ] Actionable warning provided

5. **Verify JIRA Comment Includes Cache Status**

Expected JIRA comment:
```
Deployment to Integration completed successfully.

Environment: Integration
Release: v1.2.0
Deployment Time: 2025-10-19 12:12:00 UTC

Tenant Status:
✓ tenant-a: deployed - cache cleared
✓ tenant-b: deployed - cache cleared
⚠ tenant-c: deployed - cache clearing failed (timeout)
✓ tenant-d: deployed - cache cleared
✓ tenant-e: deployed - cache cleared

Note: Cache clearing failed for tenant-c. Manual cache clear may be required.
```

**Validation Checklist:**
- [ ] Cache status per tenant included
- [ ] Warning note for failed cache clear

6. **Verify Audit Trail Includes Cache Events**

Expected audit events:
```
2025-10-19 12:06:25 UTC | deployment_completed | system
Tenant: tenant-c
Environment: Integration
Status: success
Duration: 265000ms
Cache Clear Status: failed (timeout after 180000ms)
```

**Validation Checklist:**
- [ ] Cache clear status tracked in audit event
- [ ] Timeout duration logged

**Success Criteria:**
- [x] Cache clearing timeout does NOT block deployment
- [x] Cache status tracked separately from deployment status
- [x] Teams notification includes cache status per tenant
- [x] JIRA comment includes cache status per tenant
- [x] Audit trail logs cache clearing failures
- [x] Deployment marked as success (cache failure is warning, not error)

---

### Edge Case 6: Monitoring Dashboard Unavailable During Deployment

**Test Procedure:**

1. **Stop Dashboard Container During Deployment**

Trigger release, then stop dashboard:

```bash
# Trigger release
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v1.2.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'

# Stop dashboard
docker-compose stop dashboard
```

2. **Verify Deployment Continues Unaffected**

**Expected Behavior:**
- [ ] n8n workflow continues execution
- [ ] MCP server continues processing
- [ ] Deployments proceed normally
- [ ] All events logged to persistent storage

3. **Check Event Logs**

Events should be logged to file storage:

```bash
cat logs/audit-events.jsonl
```

**Expected Log Entries:**
```json
{"timestamp":"2025-10-19T12:00:00.000Z","event_type":"release_created",...}
{"timestamp":"2025-10-19T12:00:05.000Z","event_type":"merge_initiated",...}
{"timestamp":"2025-10-19T12:02:00.000Z","event_type":"merge_completed",...}
...
```

**Validation Checklist:**
- [ ] All events logged to file
- [ ] Event log timestamps continuous (no gaps)

4. **Restart Dashboard**

```bash
docker-compose start dashboard
```

5. **Verify Dashboard Resumes Display**

Access dashboard at `http://localhost:3001`

**Expected Behavior:**
- [ ] Dashboard loads successfully
- [ ] Shows current release status (in progress or completed)
- [ ] Displays all historical events (loaded from persistent storage)
- [ ] Real-time updates resume immediately

**Validation Checklist:**
- [ ] Dashboard shows correct current state
- [ ] Historical events loaded from logs
- [ ] WebSocket/SSE connection re-established
- [ ] No data loss

**Success Criteria:**
- [x] Deployment workflow unaffected by dashboard outage
- [x] All events logged to persistent storage
- [x] Dashboard is read-only view (no impact on deployment)
- [x] Dashboard resumes correctly after restart
- [x] No event loss during outage

---

### Edge Case 7: Release with 100+ Tickets (Exceeds Performance Target)

**Test Procedure:**

1. **Create 100 JIRA Tickets for v2.0.0**

Create tickets TEST-1001 through TEST-1100 tagged for v2.0.0

2. **Trigger Release**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "v2.0.0",
    "release_type": "regular",
    "triggered_by": "tester@example.com"
  }'
```

3. **Verify Batching Logic**

Check n8n workflow logs:

Expected log entries:
```
2025-10-19 12:00:00 UTC | Large release detected: 100 tickets (exceeds 50-ticket target)
2025-10-19 12:00:01 UTC | Batching merges into groups of 50
2025-10-19 12:00:02 UTC | Processing batch 1/2 (tickets 1-50)
2025-10-19 12:15:00 UTC | Batch 1/2 complete (50 tickets merged)
2025-10-19 12:15:01 UTC | Processing batch 2/2 (tickets 51-100)
2025-10-19 12:30:00 UTC | Batch 2/2 complete (50 tickets merged)
2025-10-19 12:30:01 UTC | All 100 tickets merged successfully
```

**Validation Checklist:**
- [ ] Batching triggered for > 50 tickets
- [ ] Batches of 50 tickets each
- [ ] Sequential batch processing

4. **Verify ETA Update**

Dashboard should show dynamic ETA:

Initial ETA (before batching):
```
Estimated Duration: 15 minutes (based on 50-ticket target)
```

Updated ETA (after batch 1):
```
Estimated Duration: 30-35 minutes (large release, 100 tickets)
Batch 1/2 complete (15 minutes elapsed)
Batch 2/2 in progress (estimated 15 minutes remaining)
```

**Validation Checklist:**
- [ ] ETA updated dynamically
- [ ] User warned of extended duration

5. **Verify Warning Notification**

Expected Teams message (sent at start):
```
Large Release Warning: v2.0.0

This release contains 100 tickets, which exceeds the performance target of 50 tickets.

Expected Duration: 30-35 minutes (vs. typical 15 minutes)
Merge Phase: Batched into 2 groups of 50 tickets each
Environment: Integration

The deployment will proceed, but may take longer than usual. Please monitor the dashboard for progress.
```

**Validation Checklist:**
- [ ] Warning sent to release manager
- [ ] Severity: `warning`
- [ ] Clear expectation setting

6. **Verify Deployment Completes Successfully**

**Expected Total Duration:**
- Merge phase: ~30 minutes (2 batches of 50 tickets)
- Deployment phase: ~15 minutes (parallel tenant deployments)
- Post-deployment: ~5 minutes
- **Total: ~50 minutes**

**Validation Checklist:**
- [ ] All 100 tickets merged successfully
- [ ] All tenants deployed successfully
- [ ] JIRA tickets updated
- [ ] Teams completion announcement sent

**Success Criteria:**
- [x] System handles 100-ticket release (exceeds target)
- [x] Batching logic implemented for > 50 tickets
- [x] Release manager warned of extended duration
- [x] ETA updated dynamically
- [x] Deployment completes successfully (even if slower)
- [x] No performance degradation beyond expected batching delay

---

### Edge Case 8: Emergency Hotfix Bypass Approval Requirement

**Test Procedure:**

1. **Create Emergency Hotfix with Only 1 Approval**

Create ticket TEST-301 tagged for hotfix/v1.1.2:
- Critical security vulnerability
- PR has only 1 approval (normally requires 2)

2. **Attempt Standard Hotfix Deployment**

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "hotfix/v1.1.2",
    "release_type": "hotfix",
    "target_environment": "PROD",
    "triggered_by": "security-lead@example.com"
  }'
```

**Expected Result:**
- Workflow pauses with error: "PR #301 has insufficient approvals (1/2 required)"

3. **Trigger Emergency Release Mode**

**Note:** This requires admin override token (documented in emergency procedures)

```bash
mcp call release-automation trigger_release_deployment \
  --input '{
    "release_version": "hotfix/v1.1.2",
    "release_type": "hotfix",
    "target_environment": "PROD",
    "triggered_by": "security-lead@example.com",
    "emergency_mode": true,
    "emergency_override_token": "<admin-token>",
    "emergency_justification": "Critical security vulnerability CVE-2025-1234 - requires immediate patching"
  }'
```

4. **Verify Emergency Mode Activation**

Expected n8n workflow log:
```
2025-10-19 14:00:00 UTC | EMERGENCY MODE ACTIVATED
Release: hotfix/v1.1.2
Environment: PROD
Triggered By: security-lead@example.com
Override Token: Valid (admin-level)
Justification: Critical security vulnerability CVE-2025-1234
Approval Requirement: BYPASSED (1/2 approvals)
```

**Validation Checklist:**
- [ ] Emergency mode activated with valid admin token
- [ ] Approval requirement bypassed
- [ ] Justification logged

5. **Verify Deployment Proceeds**

**Expected Behavior:**
- [ ] Merge proceeds with only 1 approval
- [ ] Deployment to PROD proceeds
- [ ] All tenants deployed

6. **Verify Emergency Notifications**

Expected Teams message to engineering lead:

```
EMERGENCY RELEASE DEPLOYED: hotfix/v1.1.2 to PROD

CRITICAL: Approval requirement bypassed for emergency hotfix

Release: hotfix/v1.1.2
Environment: PROD
Triggered By: security-lead@example.com
Time: 2025-10-19 14:00:00 UTC

Emergency Justification:
Critical security vulnerability CVE-2025-1234 - requires immediate patching

Approval Status:
- Current Approvals: 1/2 (BYPASSED)
- Emergency Override: Used by security-lead@example.com

Deployment Status: SUCCESS
All 5 tenants deployed to PROD successfully.

ACTION REQUIRED:
Engineering lead must provide retroactive approval within 24 hours.
Post-deployment audit report will be generated automatically.
```

**Validation Checklist:**
- [ ] Engineering lead notified immediately
- [ ] Severity: `critical`
- [ ] Bypass clearly indicated
- [ ] Retroactive approval required

7. **Verify Audit Report Generation**

Expected audit report (generated automatically):

```
Emergency Release Audit Report
Release: hotfix/v1.1.2
Environment: PROD
Date: 2025-10-19 14:00:00 UTC

Emergency Details:
- Triggered By: security-lead@example.com
- Override Token: admin-token-001
- Justification: Critical security vulnerability CVE-2025-1234
- Approval Status: 1/2 (bypassed)

Deployment Timeline:
14:00:00 UTC | Emergency release triggered
14:00:30 UTC | Merge completed (approval requirement bypassed)
14:01:00 UTC | Release branch created
14:01:30 UTC | PROD deployment started (5 tenants)
14:15:00 UTC | PROD deployment completed successfully

Retroactive Approval Status:
- Required By: 2025-10-20 14:00:00 UTC (24 hours)
- Approvers: engineering-lead@example.com, tech-lead@example.com
- Status: PENDING

Risk Assessment:
- Emergency bypass: Logged and tracked
- Security vulnerability: Addressed
- Production stability: No incidents reported
- Follow-up audit: Required within 24 hours
```

**Validation Checklist:**
- [ ] Audit report generated automatically
- [ ] All emergency details logged
- [ ] Retroactive approval tracking
- [ ] Risk assessment included

**Success Criteria:**
- [x] Emergency mode supports approval bypass with admin override
- [x] Emergency justification required and logged
- [x] Engineering lead notified immediately
- [x] Post-deployment audit report generated automatically
- [x] Retroactive approval required within 24 hours
- [x] All emergency actions logged for compliance

---

## Troubleshooting

### Common Issues

#### Issue: MCP Server Fails to Start

**Symptoms:**
- Docker container `mcp-server` exits immediately
- Health check fails

**Troubleshooting Steps:**

1. Check logs:
   ```bash
   docker-compose logs mcp-server
   ```

2. Common causes:
   - **Missing secrets**: Ensure Azure Key Vault credentials configured in `.env`
   - **Invalid configuration**: Validate `config/tenants.yaml` and `config/environments.yaml`
   - **Port conflict**: Ensure port 3000 not in use

3. Verify secrets access:
   ```bash
   docker-compose exec mcp-server npm run test-secrets
   ```

#### Issue: Dashboard Shows No Data

**Symptoms:**
- Dashboard loads but shows empty state
- "No active releases" message

**Troubleshooting Steps:**

1. Verify WebSocket/SSE connection:
   - Open browser developer console → Network tab
   - Check for WebSocket connection to `ws://localhost:3002`
   - If disconnected, check CORS settings

2. Verify event log files:
   ```bash
   ls -lh logs/audit-events.jsonl
   ```

3. Manually trigger test event:
   ```bash
   curl -X POST http://localhost:3000/test/emit-event
   ```

#### Issue: Jenkins Deployment Jobs Fail

**Symptoms:**
- All tenant deployments fail immediately
- Error: "Jenkins job not found"

**Troubleshooting Steps:**

1. Verify Jenkins connectivity:
   ```bash
   curl -u <username>:<token> https://jenkins-staging.example.com/api/json
   ```

2. Verify job names in configuration:
   - Check `config/environments.yaml`
   - Ensure `jenkins_job_name` matches actual Jenkins job names

3. Test individual job trigger:
   ```bash
   mcp call release-automation jenkins_trigger_deployment \
     --input '{
       "tenant_id": "tenant-a",
       "release_version": "v1.0.0",
       "environment": "Integration",
       "release_type": "regular"
     }'
   ```

#### Issue: JIRA Tickets Not Updating

**Symptoms:**
- Deployment completes but JIRA tickets remain in old status
- No errors reported

**Troubleshooting Steps:**

1. Verify JIRA connectivity:
   ```bash
   curl -H "Authorization: Bearer <token>" https://jira-staging.example.com/rest/api/2/myself
   ```

2. Check JIRA workflow permissions:
   - Ensure API user has permission to transition tickets to "Deployed" status
   - Verify status "Deployed" exists in JIRA project

3. Check retry queue:
   ```bash
   docker-compose exec mcp-server npm run show-retry-queue
   ```

#### Issue: Teams Notifications Not Received

**Symptoms:**
- No Teams messages sent
- Audit log shows notifications as "delivered" but messages not visible

**Troubleshooting Steps:**

1. Verify Teams API connectivity:
   ```bash
   curl -H "Authorization: Bearer <token>" https://graph.microsoft.com/v1.0/me
   ```

2. Check Teams channel permissions:
   - Ensure bot is added to channel
   - Verify bot has permission to post messages

3. Test individual notification:
   ```bash
   mcp call release-automation teams_announce_deployment \
     --input '{
       "release_version": "v1.0.0",
       "environment": "Integration",
       "ticket_ids": ["TEST-101"],
       "tenant_statuses": [...],
       "deployment_summary": "Test notification"
     }'
   ```

---

## Summary

This quickstart guide provides comprehensive test scenarios for validating all user stories:

- **User Story 1 (P1)**: Automated Release Deployment
  - 4 test scenarios covering regular releases, environment targeting, PROD restrictions, and hotfix deployments
  - Validates end-to-end automation workflow

- **User Story 2 (P2)**: Intelligent Conflict and Approval Management
  - 3 test scenarios covering approval checks, AI conflict resolution, and escalation
  - Validates AI-powered decision making and human escalation

- **User Story 3 (P3)**: Multi-Tenant Deployment Orchestration
  - 3 test scenarios covering parallel deployments, partial failures, and tenant-specific rollback
  - Validates independent tenant handling

- **User Story 4 (P4)**: Real-Time Monitoring and Observability
  - 3 test scenarios covering real-time updates, action triggering, and historical filtering
  - Validates dashboard functionality and audit trail

- **User Story 5 (P5)**: Documentation and Integration Extensibility
  - 2 test scenarios covering new integration addition and configuration changes
  - Validates extensibility without code changes

- **Edge Cases**: 8 comprehensive scenarios covering production restrictions, service outages, escalations, interruptions, cache timeouts, dashboard outages, large releases, and emergency bypasses

Each test scenario includes:
- Prerequisites and test data setup
- Step-by-step procedures with exact commands
- Expected outcomes with validation checklists
- Success criteria from acceptance scenarios
- Cleanup steps for test environment reset

All scenarios reference MCP tool schemas, data model entities, and constitution principles to ensure complete validation coverage.

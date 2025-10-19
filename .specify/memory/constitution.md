<!--
Sync Impact Report:
Version: 1.2.0 → 1.3.0
Rationale: Add squash merge requirement for feature→development merges to maintain clean commit history

Modified principles:
  - Enhanced: II. GitFlow Compliance - Added squash merge requirement for feature→development
    * Feature→development: MUST use squash merge with format [TICKET-ID] Summary
    * Development→release: MUST preserve full commit history (no squash)
  - Enhanced: merge_tickets_to_development tool schema to include merge_strategy and squash_commit_messages parameters

Added sections:
  - Commit message format specification for squash merges
  - Merge strategy differentiation by branch type
  - AI responsibility for generating squash commit messages in Deployment Workflow

Removed sections: N/A

Templates requiring updates:
  ✅ Updated - plan-template.md (Constitution Check validates merge strategy rules)
  ✅ Updated - spec-template.md (Functional requirements include squash merge logic)
  ✅ Updated - tasks-template.md (Tasks include implementing squash merge with commit message generation)

Follow-up TODOs: None
-->

# Release Automation Constitution

## Core Principles

### I. Automated Conflict Resolution

The system MUST attempt automated resolution of merge conflicts before escalating to humans. Human intervention is triggered ONLY when automated resolution fails or carries unacceptable risk.

**Rules**:
- Git conflicts detected automatically during merge operations
- AI agent analyzes conflict context and attempts resolution using codebase knowledge
- If auto-resolution confidence < 95%, escalate to PR owner via Microsoft Teams
- Teams message MUST include: conflict location, affected files, suggested resolution options
- Track resolution metrics: auto-resolved vs. escalated, time to resolution

**Rationale**: Minimize human bottlenecks in deployment pipeline while maintaining code quality and safety.

### II. GitFlow Compliance (NON-NEGOTIABLE)

All branch operations MUST strictly follow GitFlow methodology. Deviations are forbidden.

**Rules**:
- Feature branches merge to `development` only
  - **Feature → development merges MUST use squash merge** for clean commit history
  - Squash commit message format: `[TICKET-ID] Summary of changes`
  - Preserves ticket traceability while keeping development branch history linear and readable
- Release branches created from `development` with naming: `release/vX.Y.Z`
  - **Development → release merges MUST preserve full commit history** (no squash)
  - Maintains complete audit trail of all tickets included in release
- Hotfix branches created from `main` when production issues occur
- Tags applied to `main` after successful release deployment
- No direct commits to `main` or `development` branches
- **PR approval requirement**: Minimum 2 approvals required before any PR can be merged
  - MCP server checks PR approval count via Git platform API (GitHub/GitLab/Bitbucket)
  - If < 2 approvals: AI agent notifies PR owner via Teams with approval status and list of potential reviewers
  - Merge blocked until approval threshold met
  - AI polls approval status and resumes workflow when requirement satisfied

**Rationale**: GitFlow provides structured, auditable release management essential for enterprise deployments. Mandatory peer review ensures code quality, knowledge sharing, and reduces deployment risk. Squash merges to development keep history clean and readable while preserving ticket traceability; full history on release branches maintains complete release audit trail.

### III. Multi-Tenant Orchestration

The system MUST orchestrate deployments across multiple platform tenants via Jenkins with parallel execution and failure isolation.

**Rules**:
- Jenkins jobs triggered programmatically via API
- Tenant deployments execute in parallel when independent
- Single tenant failure MUST NOT block other tenant deployments
- Deployment status tracked per tenant with real-time reporting
- Rollback capability available per tenant
- All tenant configurations stored in version-controlled manifest

**Rationale**: Multi-tenant SaaS platforms require parallel, isolated deployment to minimize downtime and blast radius.

### IV. AI Agent Communication

Communication with stakeholders MUST be handled by an AI agent capable of context-aware, adaptive messaging.

**Rules**:
- Agent composes messages based on deployment context, status, and recipient role
- Messages personalized: developers get technical details, stakeholders get summaries
- Agent handles unexpected scenarios using conversation and knowledge base lookup
- All agent communications logged for audit trail
- Agent escalates to human operators when facing novel failures
- Tone and urgency calibrated to severity (info, warning, critical)

**Rationale**: Automated communication reduces manual overhead while maintaining stakeholder awareness and trust through intelligent, context-appropriate messaging.

### V. End-to-End Observability

Every stage of the release pipeline MUST emit structured logs, metrics, and status updates for complete traceability.

**Rules**:
- Deployment events logged: merge attempts, Jenkins triggers, cache clears, JIRA updates
- Real-time status dashboard accessible to operators
- Failed operations include diagnostic context (error codes, stack traces, affected resources)
- Performance metrics tracked: merge time, deployment duration per tenant, cache clear latency
- Audit log preserved for compliance: who triggered release, what tickets included, outcomes
- Integration with monitoring tools (e.g., Datadog, Prometheus) for alerting

**Rationale**: Complex automation requires visibility into every step to diagnose failures, optimize performance, and satisfy compliance requirements.

### VI. MCP-First Architecture (NON-NEGOTIABLE)

All automation capabilities MUST be exposed via MCP (Model Context Protocol) server tools. Direct AI-to-system integration is forbidden.

**Rules**:
- Business logic implemented in MCP server (TypeScript or Python)
- AI clients interact exclusively through MCP protocol—no direct API calls to Jenkins/JIRA/Teams/Git
- Each tool documented with JSON schema, description, and examples
- MCP server enforces authentication, authorization, rate limits, and validation
- Tool versioning follows semantic versioning (breaking changes = MAJOR bump)
- Server maintains idempotency for all state-changing operations
- Credentials managed server-side only—never exposed to AI clients

**Rationale**: MCP architecture ensures AI-agnostic flexibility, security isolation, operational consistency across interfaces, and future-proofs the system against AI provider changes. It creates a clean separation between intelligence (AI) and execution (MCP tools), enabling independent evolution of both layers.

## Integration Requirements

### MCP Server Architecture

The system is structured as a **two-layer architecture**:

```
┌─────────────────────────────────────────────┐
│          AI Client Layer (Stateless)         │
│  - Claude / GPT-4 / Gemini / Local Models   │
│  - Reasoning, analysis, decision-making      │
│  - Natural language generation               │
│  - Connects via MCP protocol                 │
└─────────────────┬───────────────────────────┘
                  │ MCP Protocol (JSON-RPC)
┌─────────────────▼───────────────────────────┐
│         MCP Server (Business Logic)          │
│  - Git operations (merge, branch, tag)       │
│  - Jenkins deployment orchestration          │
│  - JIRA ticket management                    │
│  - Teams notifications                       │
│  - Cache invalidation                        │
│  - Credentials & secrets management          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           External Systems                   │
│  Git · Jenkins · JIRA · Teams · Cache        │
└─────────────────────────────────────────────┘
```

**Layer Responsibilities**:

- **AI Client**: Orchestrates workflow, interprets context, handles novel scenarios, generates communication
- **MCP Server**: Executes operations, enforces rules, manages state, handles credentials, validates requests
- **External Systems**: Source of truth for code, deployments, tickets, notifications

### MCP Tool Design Standards

All MCP tools MUST follow these standards:

**Naming Convention**:
- Use snake_case: `get_release_tickets`, `merge_to_development`, `deploy_to_tenants`
- Prefix with domain for clarity: `git_merge_branch`, `jira_update_status`, `jenkins_trigger_job`

**Schema Requirements**:
- JSON schema for inputs and outputs
- Required vs. optional parameters clearly marked
- Enum types for constrained values (e.g., `severity: "info" | "warning" | "critical"`)
- Rich descriptions for AI model understanding

**Idempotency**:
- Same input → same outcome (or safe no-op if already done)
- Tools return current state even on repeated calls
- Example: `create_release_branch("v1.2.0")` returns existing branch if already created

**Error Handling**:
- Structured error responses with error codes
- Actionable error messages (not just "failed")
- Distinguish retryable vs. permanent failures
- Include context for AI decision-making

**Example Tool Definition**:
```json
{
  "name": "merge_tickets_to_development",
  "description": "Merge ticket feature branches to development branch following GitFlow with squash merge",
  "input_schema": {
    "type": "object",
    "properties": {
      "ticket_ids": {
        "type": "array",
        "items": { "type": "string" },
        "description": "JIRA ticket IDs (e.g., ['PROJ-123', 'PROJ-124'])"
      },
      "merge_strategy": {
        "type": "string",
        "enum": ["squash", "merge"],
        "default": "squash",
        "description": "Merge strategy: 'squash' for feature→dev (clean history), 'merge' for dev→release (full history)"
      },
      "squash_commit_messages": {
        "type": "object",
        "description": "Map of ticket_id to squash commit message (format: '[TICKET-ID] Summary')",
        "additionalProperties": { "type": "string" }
      },
      "auto_resolve_conflicts": {
        "type": "boolean",
        "default": false,
        "description": "Attempt automatic conflict resolution"
      }
    },
    "required": ["ticket_ids"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "merged": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "ticket_id": { "type": "string" },
            "commit_sha": { "type": "string" },
            "squashed": { "type": "boolean" }
          }
        }
      },
      "conflicts": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "ticket_id": { "type": "string" },
            "files": { "type": "array", "items": { "type": "string" } },
            "owner": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**Additional Tool Example (PR Approval Check)**:
```json
{
  "name": "git_check_pr_approvals",
  "description": "Check if PR has minimum required approvals (2) before merge",
  "input_schema": {
    "type": "object",
    "properties": {
      "pr_id": {
        "type": "string",
        "description": "Pull request ID or number (e.g., '123' or 'PROJ-456')"
      }
    },
    "required": ["pr_id"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "pr_id": { "type": "string" },
      "approval_count": { "type": "integer" },
      "required_approvals": { "type": "integer", "default": 2 },
      "approved": { "type": "boolean" },
      "approvers": { "type": "array", "items": { "type": "string" } },
      "pr_owner": { "type": "string" },
      "potential_reviewers": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

### External Systems

The **MCP server** (not AI clients) integrates with:

1. **Bitbucket (GitFlow)**: Branch operations, merging, tagging, conflict detection
2. **Microsoft Teams**: Stakeholder notifications, conflict escalation, deployment announcements
3. **Jenkins**: Multi-tenant deployment job orchestration via REST API
4. **JIRA**: Ticket fetching and status updates post-deployment
5. **Cache Layer - Akamai**: Automated cache invalidation across platform tenants

### API Contracts (MCP Server → External Systems)

All external integrations MUST:
- Use versioned APIs with backward compatibility guarantees
- Implement retry logic with exponential backoff for transient failures
- Validate responses and fail gracefully on schema mismatches
- Log all API requests/responses for debugging (sanitize sensitive data)
- Respect rate limits and implement circuit breakers
- Timeout all requests (default: 30s for reads, 60s for writes)

### Secrets Management

- API tokens, credentials stored in secure vault (Azure)
- MCP server retrieves secrets at startup or on-demand
- No credentials in source code, logs, or AI client communication
- Secrets rotated according to security policy (minimum quarterly)
- MCP server environment variables used only for vault access, never direct credentials

## Operational Constraints

### Deployment Workflow

The **AI client** orchestrates the workflow by calling **MCP server tools** in sequence:

1. **Trigger**: Human or scheduled action initiates release build (AI client receives request)
2. **Merge Phase** (AI orchestrates):
   - Call `jira_get_release_tickets(release_version)` → returns ticket list
   - For each ticket: Call `git_check_pr_approvals(pr_id)` → returns approval count and reviewer list
   - If any PR has < 2 approvals:
     - Call `teams_notify_pr_owner(pr_id, current_approvals, required_approvals, potential_reviewers)`
     - AI waits and polls `git_check_pr_approvals()` until all PRs meet threshold
   - Call `git_merge_tickets_to_development(ticket_ids, merge_strategy="squash", auto_resolve=true)` → returns merged/conflicts
     - AI generates squash commit message: `[TICKET-ID] Summary` based on PR description
   - If conflicts returned: Call `teams_notify_pr_owners(conflicts)` → escalate to humans
   - AI waits for conflict resolution confirmation before proceeding
3. **Branch Creation** (AI orchestrates):
   - Call `git_create_release_branch(version)` → returns branch name and commit SHA
4. **Deployment Phase** (AI orchestrates):
   - Call `jenkins_deploy_to_tenants(tenant_list, release_branch)` → returns job IDs
   - Poll `jenkins_get_job_status(job_ids)` until all complete or timeout
   - AI evaluates failures: retry logic, partial rollback, or full abort
5. **Post-Deployment** (AI orchestrates):
   - Call `cache_invalidate_all_tenants()` → returns success/failure per tenant
   - Call `jira_update_ticket_status(ticket_ids, new_status="Deployed")` → batch update
   - Call `teams_announce_deployment(release_version, summary)` → AI generates summary
6. **Validation** (AI monitors):
   - Call `monitoring_get_error_rates(time_window="15m")` → AI analyzes for anomalies
   - If anomalies detected: AI decides escalate vs. auto-rollback

### Failure Handling

- **Insufficient PR Approvals**: Notify PR owner via Teams with current approval count, required count (2), and list of potential reviewers; pause release until threshold met
- **Merge Conflict**: Notify PR owner, pause release until resolved
- **Jenkins Job Failure**: Retry once, then mark tenant as failed and continue others
- **Cache Clear Failure**: Log error, notify ops team, do NOT block deployment
- **JIRA Update Failure**: Log error, queue for retry, do NOT block deployment
- **Novel Failure**: AI agent escalates to human operator with context

### Performance Targets

- Merge phase completion: < 10 minutes for up to 50 tickets
- Tenant deployment: < 15 minutes per tenant
- Cache invalidation: < 2 minutes across all tenants
- JIRA updates: < 5 minutes for up to 100 tickets

### Rollback

- Rollback capability required within 15 minutes of deployment
- Rollback triggers: critical production errors, failed health checks, manual trigger
- Rollback process: revert `main` to previous tag, redeploy via Jenkins

## Governance

### Amendment Process

1. Constitution version incremented per semantic versioning
2. All dependent templates updated within same PR

### Versioning Policy

- **MAJOR**: Breaking changes to deployment workflow, GitFlow deviations, integration contract changes
- **MINOR**: New principles added, new integrations, expanded automation scope
- **PATCH**: Clarifications, formatting, non-semantic improvements

### Compliance Review

- Every deployment PR MUST verify compliance with GitFlow principle
- AI agent decision logs reviewed quarterly for quality and safety
- Integration failures analyzed monthly to improve retry/fallback logic
- Constitution reviewed annually or after major system architecture changes
- **MCP-specific compliance**:
  - All new automation features MUST be exposed as MCP tools (no AI-direct integration)
  - MCP tool schemas versioned and documented before implementation
  - Breaking changes to tool signatures require constitution amendment discussion
  - AI clients audited to ensure no bypass of MCP layer (e.g., direct API calls)

### Complexity Justification

New complexity (e.g., additional integrations, workflow steps) MUST be justified in writing:
- What problem does it solve?
- Why can't existing mechanisms handle it?
- What is the maintenance cost?
- What is the failure impact?

**Version**: 1.3.0 | **Ratified**: 2025-10-19 | **Last Amended**: 2025-10-19

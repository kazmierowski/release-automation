# Implementation Plan: Release Automation MCP Server

**Branch**: `001-release-automation-mcp` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-release-automation-mcp/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

**Primary Requirement**: Build a fully automated release deployment system using MCP (Model Context Protocol) server architecture that orchestrates multi-tenant deployments across Git (Bitbucket), Jenkins, JIRA, and Microsoft Teams.

**Technical Approach**: TypeScript-based MCP server providing versioned tools for GitFlow operations (squash merges to development, full-history merges to release branches), PR approval checks (minimum 2 approvals), AI-powered conflict resolution, parallel multi-tenant Jenkins deployment orchestration, JIRA ticket status updates, and context-aware Teams notifications. React web dashboard for real-time monitoring and action triggering. Azure Key Vault for secrets management. n8n acts as an AI client that calls MCP tools to orchestrate the deployment workflow. Cache clearing is handled entirely within Jenkins jobs (out of scope for MCP server).

## Technical Context

**Language/Version**: TypeScript 5.3+ with Node.js 20.x LTS
**Primary Dependencies**:
  - MCP SDK (`@modelcontextprotocol/sdk`) for server implementation
  - Git platform abstraction: Bitbucket REST API client (`bitbucket` npm package) as initial provider
  - Jenkins REST API client (`jenkins` npm package)
  - JIRA REST API (`jira.js`)
  - Microsoft Graph SDK (`@microsoft/microsoft-graph-client`) for Teams
  - Azure Key Vault SDK (`@azure/keyvault-secrets`) as initial secrets provider
  - n8n as AI client calling MCP tools (deployed on-premises)
  - React 18+ with TypeScript for monitoring dashboard
  - Express.js for MCP server HTTP transport

**Storage**:
  - File-based workflow state persistence (JSON/YAML for n8n execution context)
  - Azure Key Vault for credentials (abstraction layer for future HashiCorp Vault/AWS support)
  - Git repository as source of truth for release state
  - JIRA as ticket state authority

**Testing**:
  - Jest for unit tests (MCP tool logic, conflict resolution algorithms)
  - Integration tests against staging instances (Bitbucket, Jenkins, JIRA, Teams)
  - Contract tests for MCP tool schemas (JSON schema validation)
  - E2E tests for complete deployment workflows via n8n

**Target Platform**: Linux server (on-premises deployment, containerized with Docker)

**Project Type**: Web application (MCP server backend + React monitoring dashboard frontend + n8n as AI client)

**Performance Goals**:
  - Release merge phase: <10 min for 50 tickets
  - Per-tenant deployment: <15 min
  - Total deployment across 10 tenants: <30 min (parallel execution)
  - Dashboard status updates: <10 sec latency
  - API response times: <500ms p95 (MCP tool calls)

**Constraints**:
  - Minimum 2 PR approvals enforced (NON-NEGOTIABLE per Constitution)
  - GitFlow squash merge for feature→development, full history for development→release (NON-NEGOTIABLE)
  - Regular releases cannot deploy to PROD (only Integration/UAT/UAT1)
  - Hotfix releases can deploy to any environment including PROD
  - 95% confidence threshold for AI conflict auto-resolution
  - No direct AI-to-system integration (MCP-first architecture - n8n calls MCP tools)
  - Secrets never exposed to AI clients or logs
  - Cache clearing is OUT OF SCOPE - handled entirely within Jenkins jobs
  - MCP server only tracks cache clear status as reported by Jenkins (for audit/dashboard)

**Scale/Scope**:
  - Support 20+ concurrent release deployments
  - Handle 50 tickets per release (batched if >50)
  - Orchestrate 10+ tenants per environment (Integration/UAT/UAT1/PROD)
  - 4 environments with distinct Jenkins job configurations
  - Integration with 5 external systems (Git, Jenkins, JIRA, Teams, Key Vault)
  - n8n acts as AI client orchestrating deployment workflow by calling MCP tools

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Automated Conflict Resolution
**Status**: ✅ COMPLIANT

- FR-009: System detects merge conflicts and attempts AI auto-resolution with 95% confidence threshold
- FR-010: Escalates unresolved conflicts to PR owner via Teams with file locations and suggestions
- SC-002: Target 95%+ auto-merge success rate without manual intervention
- **Rationale**: Feature spec explicitly implements this principle with quantifiable metrics

### Principle II: GitFlow Compliance
**Status**: ✅ COMPLIANT

- FR-005a/b: Git platform abstraction layer with Bitbucket as initial implementation
- FR-006: PR approval check enforces minimum 2 approvals via Git platform API
- FR-007: Feature→development merges use squash merge with `[TICKET-ID] Summary` format
- FR-008: Development→release branch creation preserves full commit history
- FR-011: System polls PR approval status every 2 minutes until threshold met
- FR-012a/b/c: Regular releases restricted to Integration/UAT/UAT1; hotfixes allowed to PROD
- **Rationale**: All GitFlow rules from Constitution v1.3.0 are enforced in functional requirements

### Principle III: Multi-Tenant Orchestration
**Status**: ✅ COMPLIANT

- FR-013: Jenkins jobs triggered programmatically for all configured tenants in target environment
- FR-014: Tenant deployments execute in parallel with independent failure handling
- FR-015: Failed Jenkins jobs retried once before marking tenant as failed
- FR-016: Per-tenant deployment status tracked in real-time
- FR-017: Rollback capability available per tenant within 30 minutes
- **Rationale**: Tenant isolation and parallel execution fully implemented as required

### Principle IV: AI Agent Communication
**Status**: ✅ COMPLIANT

- FR-023: Personalized Teams notifications to PR owners with approval details
- FR-024: Conflict notifications include file locations and resolution suggestions
- FR-025: Deployment announcements include release version, tenant status, cache status, environment
- FR-026: Severity-appropriate urgency (info/warning/critical) with actionable context
- FR-027: All Teams messages logged with delivery confirmation timestamps
- **Rationale**: Context-aware, role-appropriate messaging implemented throughout workflow

### Principle V: End-to-End Observability
**Status**: ✅ COMPLIANT

- FR-036a/b: React monitoring dashboard with MCP client integration for action triggering
- FR-037: Real-time deployment status display (phase, environment, progress, ETA)
- FR-038: Per-tenant status with job links, duration, errors, cache status
- FR-039: PR approval status, merge status, conflict details during merge phase
- FR-040: Complete audit trail with timestamps for all actions
- FR-041: Auto-refresh every 10 seconds during active deployments (WebSockets/SSE)
- FR-042: Historical view with filtering by date, release version, environment, tenant
- **Rationale**: Comprehensive observability across all workflow stages with audit trail

### Principle VI: MCP-First Architecture
**Status**: ✅ COMPLIANT

- FR-001: MCP server exposes all automation capabilities as versioned tools (JSON-RPC)
- FR-002: AI clients interact exclusively through MCP protocol (no direct system access)
- FR-003: All tool inputs validated against schemas with structured error responses
- FR-004: Idempotency enforced for all state-changing tools
- FR-005: Tool schemas versioned using semantic versioning with backward compatibility
- FR-032: n8n workflows call MCP server tools in sequence
- FR-035: Workflow triggering from any MCP client (dashboard, n8n, CLI, AI agent)
- FR-042a/b: Secrets management abstraction with Azure Key Vault initial implementation
- FR-043/044: Credentials stored in vault, retrieved server-side only, never exposed to AI
- **Rationale**: Pure MCP architecture with abstraction layers for Git platforms and secrets management

### Integration Requirements Check
**Status**: ✅ COMPLIANT

- FR-018: Jenkins API rate limits respected with circuit breakers for transient failures
- FR-022: JIRA API calls use exponential backoff without blocking deployment
- Technical Context specifies: REST API versioning, retry logic, response validation, request timeouts
- **Rationale**: All integration requirements from Constitution implemented in functional requirements

### Performance Targets Check
**Status**: ✅ COMPLIANT

- SC-001: Merge phase <10 min for 50 tickets (Constitution target: <10 min)
- Performance Goals: Per-tenant deployment <15 min (Constitution target: <15 min)
- FR-029: Cache status tracking per tenant (Constitution requirement)
- FR-021: JIRA updates <5 min for 100 tickets (Constitution target: <5 min)
- SC-010: Rollback within 30 minutes (Constitution requirement: within 15 min) - **NOTE: Deviation**
- **Rationale**: All performance targets met or exceeded except rollback timing (30 min vs 15 min target)

### Complexity Justification Required
**Status**: ⚠️ REVIEW NEEDED

**Potential Violation**: Rollback target is 30 minutes (SC-010) vs Constitution requirement of 15 minutes

**Why Needed**: Multi-tenant rollback requires sequential Jenkins job triggers, health checks, and verification across 10+ tenants. Parallel rollback risks cascading failures.

**Simpler Alternative Rejected**: Parallel rollback rejected because it could cause race conditions in shared database schema migrations and configuration updates that span multiple tenants.

### Gate Decision
**Result**: ✅ PASS WITH MINOR DEVIATION

**Action Required**: Document rollback timing deviation (30 min vs 15 min) as acceptable given multi-tenant complexity. Consider optimizing rollback process in Phase 1 design if feasible.

**Next Steps**: Proceed to Phase 0 (Research)

## Project Structure

### Documentation (this feature)

```
specs/001-release-automation-mcp/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── mcp-tools.json   # MCP tool schemas
│   ├── git-api.yaml     # Git platform abstraction interface
│   ├── secrets-api.yaml # Secrets management abstraction interface
│   └── n8n-workflow.json # n8n workflow definition
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Selected Structure**: Web application (MCP server backend + React monitoring dashboard frontend + n8n as AI client)

```
mcp-server/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/                      # MCP tool implementations
│   │   ├── git/
│   │   │   ├── check-pr-approvals.ts
│   │   │   ├── merge-to-development.ts
│   │   │   ├── create-release-branch.ts
│   │   │   └── detect-conflicts.ts
│   │   ├── jenkins/
│   │   │   ├── trigger-deployment.ts
│   │   │   ├── get-job-status.ts
│   │   │   └── rollback-tenant.ts
│   │   ├── jira/
│   │   │   ├── get-release-tickets.ts
│   │   │   └── update-ticket-status.ts
│   │   └── teams/
│   │       ├── notify-pr-owner.ts
│   │       └── announce-deployment.ts
│   ├── providers/                  # Abstraction layer implementations
│   │   ├── git/
│   │   │   ├── base.ts            # Git provider interface
│   │   │   └── bitbucket.ts       # Bitbucket implementation
│   │   └── secrets/
│   │       ├── base.ts            # Secrets provider interface
│   │       └── azure-keyvault.ts  # Azure Key Vault implementation
│   ├── services/                   # Business logic
│   │   ├── conflict-resolver.ts   # AI-powered conflict resolution
│   │   └── notification-composer.ts
│   ├── config/
│   │   ├── environment.ts         # Environment configuration
│   │   └── tenant-manifest.ts     # Tenant configuration loader
│   └── utils/
│       ├── validation.ts          # Schema validation
│       ├── retry.ts               # Retry logic with backoff
│       └── logger.ts              # Sanitized logging
├── tests/
│   ├── unit/                      # Jest unit tests
│   │   ├── tools/
│   │   ├── services/
│   │   └── providers/
│   ├── integration/               # Integration tests (staging)
│   │   ├── git.test.ts
│   │   ├── jenkins.test.ts
│   │   ├── jira.test.ts
│   │   └── teams.test.ts
│   └── contract/                  # MCP schema validation
│       └── mcp-tools.test.ts
├── package.json
├── tsconfig.json
└── Dockerfile

dashboard/
├── src/
│   ├── index.tsx                  # React app entry point
│   ├── components/
│   │   ├── DeploymentStatus.tsx  # Real-time status display
│   │   ├── TenantGrid.tsx        # Per-tenant status grid
│   │   ├── AuditLog.tsx          # Audit trail viewer
│   │   └── ActionTrigger.tsx     # MCP client for triggering releases
│   ├── services/
│   │   ├── mcp-client.ts         # MCP protocol client
│   │   └── websocket.ts          # Real-time updates
│   ├── hooks/
│   │   ├── useDeploymentStatus.ts
│   │   └── useAuditLog.ts
│   └── types/
│       └── deployment.ts         # TypeScript types
├── tests/
│   └── components/               # React component tests
├── package.json
└── tsconfig.json

n8n-workflows/
├── release-deployment.json       # n8n workflow calling MCP tools
├── pr-approval-monitor.json      # Polling workflow for approvals
└── rollback-tenant.json          # Rollback workflow

config/
├── tenants.yaml                  # Tenant manifest
├── environments.yaml             # Environment configuration
└── .env.example                  # Environment variables template

docs/
├── architecture.md               # System architecture diagrams
├── mcp-tools.md                  # MCP tool documentation
└── adding-integrations.md        # Integration guide

docker-compose.yml                # Local development setup
README.md                         # Project overview
```

**Structure Decision**: Web application architecture selected because:
1. **MCP server** requires backend TypeScript service to expose tools
2. **Monitoring dashboard** requires frontend React application for real-time visualization and action triggering
3. **n8n** acts as AI client calling MCP tools (not a workflow orchestration layer in traditional sense)
4. **Separation of concerns**: MCP server (business logic), dashboard (UI), n8n (AI client)
5. **Independent deployment**: Server and dashboard can scale separately
6. **Testing isolation**: Unit tests for server logic, component tests for UI, integration tests via n8n
7. **Cache clearing**: OUT OF SCOPE - handled entirely by Jenkins jobs (MCP server only tracks status)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Rollback timing: 30 min vs 15 min Constitution target | Multi-tenant rollback requires sequential Jenkins job triggers, health checks, and verification across 10+ tenants to prevent cascading failures | Parallel rollback rejected due to risk of race conditions in shared database schema migrations and configuration updates spanning multiple tenants |

**Note**: This deviation is acceptable given the multi-tenant complexity. Phase 1 design will explore optimization opportunities (e.g., pre-staged rollback artifacts, tenant grouping strategies).

---

## Post-Phase 1 Constitution Check (Re-evaluation)

*Re-check after Phase 1 design (research.md, data-model.md, contracts/) completed*

### All Principles: ✅ COMPLIANT

**Phase 1 Design Validation**:

1. **Principle I (Automated Conflict Resolution)**:
   - ✅ `ConflictAnalysis` entity with 95% confidence threshold defined in data-model.md
   - ✅ `git_merge_tickets_to_development` MCP tool implements conflict detection and AI auto-resolution in contracts/mcp-tools.json
   - ✅ Escalation workflow to PR owners via Teams notifications documented in quickstart.md

2. **Principle II (GitFlow Compliance)**:
   - ✅ Git provider abstraction layer documented in contracts/git-api.yaml supports Bitbucket (initial), GitHub, GitLab (future)
   - ✅ 2-approval minimum enforced in `checkPRApprovals` method with `requiredApprovals: 2` validation
   - ✅ Squash merge for feature→dev (`merge_strategy: "squash"`) and full history for dev→release (`merge_strategy: "merge"`) in MCP tool schemas
   - ✅ Squash commit message format `[TICKET-ID] Summary` validated in `squash_commit_messages` parameter schema

3. **Principle III (Multi-Tenant Orchestration)**:
   - ✅ `Deployment` entity with per-tenant status tracking in data-model.md
   - ✅ `jenkins_trigger_deployment` and `jenkins_get_job_status` MCP tools support parallel tenant deployment in contracts/mcp-tools.json
   - ✅ Independent failure handling with retry logic (max 1 retry per tenant) defined in tool schemas
   - ✅ Tenant manifest configuration documented in quickstart.md (tenants.yaml)

4. **Principle IV (AI Agent Communication)**:
   - ✅ `Notification` entity with severity levels (`info`, `warning`, `critical`) and context-aware messaging in data-model.md
   - ✅ `teams_notify_pr_owner` and `teams_announce_deployment` MCP tools with adaptive card templates in contracts/mcp-tools.json
   - ✅ Role-appropriate messaging (PR owners get approval details, stakeholders get deployment summaries) documented in quickstart.md

5. **Principle V (End-to-End Observability)**:
   - ✅ `AuditEvent` entity with structured logging (timestamp, actor, event_type, status, diagnostic_context) in data-model.md
   - ✅ Dashboard real-time updates (WebSocket/SSE) documented in research.md and quickstart.md
   - ✅ Complete audit trail for all actions (merges, deployments, notifications, JIRA updates, cache clears) validated in test scenarios

6. **Principle VI (MCP-First Architecture)**:
   - ✅ 11 MCP tools with JSON-RPC schemas defined in contracts/mcp-tools.json
   - ✅ Tool versioning (semantic versioning starting at 1.0.0) with idempotency flags
   - ✅ Abstraction layers for Git platforms (contracts/git-api.yaml) and secrets management (contracts/secrets-api.yaml)
   - ✅ No direct AI-to-system integration (all orchestration via MCP tools called by n8n workflows)
   - ✅ Secrets never exposed to AI clients (server-side retrieval only, sanitized logging) documented in research.md

**Integration Requirements**: ✅ COMPLIANT
- REST API versioning, retry logic, response validation documented in contracts/git-api.yaml and contracts/secrets-api.yaml
- Exponential backoff (3 attempts: 2s, 4s, 8s for Git; 1s, 2s, 4s for Secrets)
- Circuit breakers (3 consecutive failures trigger open state for 1 min)
- Request timeouts (30s reads, 60s writes for Git; 10s reads, 30s writes for Secrets)

**Performance Targets**: ✅ COMPLIANT (with noted deviation)
- Merge phase: <10 min for 50 tickets (validated in quickstart.md test scenarios)
- Per-tenant deployment: <15 min (Jenkins orchestration)
- Cache status tracking: Per-tenant as reported by Jenkins (data-model.md: Deployment.cache_clear_status)
- Rollback: 30 min (deviation from 15 min target, justified in Complexity Tracking)

**MCP Tool Standards**: ✅ COMPLIANT
- All tools follow snake_case naming with domain prefixes (git_, jenkins_, jira_, teams_)
- JSON Schema Draft 7 for input/output validation
- Idempotency enforced for read operations and safe state-changing operations
- Structured error responses with machine-readable codes, retryable flags, actionable messages
- Rich descriptions for AI model understanding

**Security & Secrets**: ✅ COMPLIANT
- Secrets abstraction layer with Azure Key Vault initial implementation (contracts/secrets-api.yaml)
- 5-minute cache TTL with Managed Identity authentication
- No credentials in logs (sanitized with `***REDACTED***` placeholder)
- Quarterly rotation workflow documented

**Testing Coverage**: ✅ COMPLIANT
- Unit tests (Jest), Integration tests (staging), Contract tests (schema validation), E2E tests (n8n workflows) documented in research.md
- All user stories with test scenarios in quickstart.md (5 user stories × multiple scenarios = 15+ test cases)
- Edge cases validated (8 comprehensive scenarios including PROD restriction, API unavailability, workflow interruption)

### Final Gate Decision
**Result**: ✅ PASS - All Constitution principles validated in Phase 1 design

**Next Steps**:
- Proceed to Phase 2 (/speckit.tasks) to generate implementation tasks
- Phase 1 design artifacts (research.md, data-model.md, contracts/, quickstart.md) provide complete technical foundation for task breakdown


# Tasks: Release Automation MCP Server

**Feature Branch**: `001-release-automation-mcp`
**Input**: Design documents from `/home/kamil/code/release-automation/specs/001-release-automation-mcp/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Comprehensive test suite is REQUIRED per FR-048 to FR-051. Test tasks are included for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story per constitution requirements.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize project structure, dependencies, and build configuration

- [ ] T001 Create project root directory structure with mcp-server/, dashboard/, n8n-workflows/, config/, docs/
- [ ] T002 [P] Initialize MCP server TypeScript project in /home/kamil/code/release-automation/mcp-server/ with package.json, tsconfig.json
- [ ] T003 [P] Initialize React dashboard TypeScript project in /home/kamil/code/release-automation/dashboard/ with package.json, tsconfig.json
- [ ] T004 [P] Create Docker Compose configuration in /home/kamil/code/release-automation/docker-compose.yml for MCP server, dashboard, n8n services
- [ ] T005 [P] Create configuration templates in /home/kamil/code/release-automation/config/.env.example, tenants.yaml, environments.yaml
- [ ] T006 [P] Setup Jest testing framework in /home/kamil/code/release-automation/mcp-server/jest.config.js with unit, integration, contract test configurations
- [ ] T007 [P] Configure ESLint and Prettier in /home/kamil/code/release-automation/mcp-server/.eslintrc.js, /home/kamil/code/release-automation/dashboard/.eslintrc.js
- [ ] T008 Create project README.md in /home/kamil/code/release-automation/README.md with setup instructions and architecture overview

**Checkpoint**: Project structure initialized - dependencies installed, build tools configured

---

## Phase 2: Foundational Infrastructure (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core MCP Server Infrastructure

- [ ] T009 Implement MCP server entry point with @modelcontextprotocol/sdk in /home/kamil/code/release-automation/mcp-server/src/index.ts with HTTP transport, tool registration, error handling
- [ ] T010 [P] Create configuration loader in /home/kamil/code/release-automation/mcp-server/src/config/environment.ts to read .env variables (DEFAULT_ENVIRONMENT, GIT_PLATFORM, JENKINS_BASE_URL, JIRA_BASE_URL, etc.)
- [ ] T011 [P] Create tenant manifest loader in /home/kamil/code/release-automation/mcp-server/src/config/tenant-manifest.ts to parse tenants.yaml and environments.yaml
- [ ] T012 [P] Implement sanitized logger with credential redaction in /home/kamil/code/release-automation/mcp-server/src/utils/logger.ts (replaces credentials with ***REDACTED***)
- [ ] T013 [P] Implement retry utility with exponential backoff in /home/kamil/code/release-automation/mcp-server/src/utils/retry.ts (configurable attempts, base delay, max delay)

### Provider Abstraction Layers

- [ ] T014 [P] Define Git provider interface IGitProvider in /home/kamil/code/release-automation/mcp-server/src/providers/git/base.ts with methods: checkPRApprovals, mergePR, createBranch, detectConflicts
- [ ] T015 [P] Implement Bitbucket provider BitbucketProvider in /home/kamil/code/release-automation/mcp-server/src/providers/git/bitbucket.ts implementing IGitProvider using bitbucket npm package
- [ ] T016 [P] Define Secrets provider interface ISecretsProvider in /home/kamil/code/release-automation/mcp-server/src/providers/secrets/base.ts with methods: getSecret, listSecrets, rotateSecret
- [ ] T017 [P] Implement Azure Key Vault provider AzureKeyVaultProvider in /home/kamil/code/release-automation/mcp-server/src/providers/secrets/azure-keyvault.ts implementing ISecretsProvider using @azure/keyvault-secrets with 5-minute cache TTL

### Core Services

- [ ] T018 [P] Create SecretsManager wrapper in /home/kamil/code/release-automation/mcp-server/src/config/secrets.ts with in-memory caching (5 min TTL), provider injection
- [ ] T019 [P] Implement Zod schema validation utility in /home/kamil/code/release-automation/mcp-server/src/utils/validation.ts for MCP tool input/output validation
- [ ] T020 [P] Create TypeScript type definitions from data-model.md entities in /home/kamil/code/release-automation/mcp-server/src/types/entities.ts (Release, Ticket, Deployment, Tenant, etc.)
- [ ] T021 [P] Implement MCP error response builder in /home/kamil/code/release-automation/mcp-server/src/utils/mcp-errors.ts with structured error codes, retryable flags, actionable messages

### External API Client Initialization

- [ ] T022 Initialize Jenkins client factory in /home/kamil/code/release-automation/mcp-server/src/clients/jenkins.ts using jenkins npm package with circuit breaker pattern (3 failures → open for 1 min)
- [ ] T023 [P] Initialize JIRA client factory in /home/kamil/code/release-automation/mcp-server/src/clients/jira.ts using jira.js npm package with exponential backoff (1s, 2s, 4s)
- [ ] T024 [P] Initialize Microsoft Teams Graph client factory in /home/kamil/code/release-automation/mcp-server/src/clients/teams.ts using @microsoft/microsoft-graph-client with OAuth 2.0 authentication
- [ ] T024a [P] Create test data fixtures in /home/kamil/code/release-automation/mcp-server/tests/fixtures/ for edge case scenarios per spec.md: 100+ ticket batching (fixtures/tickets-100plus.json), API failures (fixtures/api-errors.json), timeout scenarios (fixtures/timeout-configs.json), n8n workflow interruption (fixtures/workflow-states.json)

**Checkpoint**: Foundation ready - MCP server scaffold complete, abstraction layers implemented, external clients initialized, test fixtures for edge cases created. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Automated Release Deployment (Priority: P1) 🎯 MVP

**Goal**: Enable single-action release trigger that automatically merges all approved tickets to development, creates release branch, triggers Jenkins deployments for all tenants, updates JIRA tickets, and sends Teams notifications.

**Independent Test**: Trigger regular release v1.2.0 with 3-5 JIRA tickets to Integration environment (default from .env), verify all tickets merged to development with squash commits, release branch created, Jenkins jobs triggered for all tenants, JIRA tickets updated to "Deployed", Teams notifications sent. Verify regular release to PROD is rejected with error.

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T025 [P] [US1] Contract test for jira_get_release_tickets MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/jira-get-release-tickets.test.ts
- [ ] T026 [P] [US1] Contract test for git_check_pr_approvals MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/git-check-pr-approvals.test.ts
- [ ] T027 [P] [US1] Contract test for git_merge_tickets_to_development MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/git-merge-tickets.test.ts
- [ ] T028 [P] [US1] Contract test for git_create_release_branch MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/git-create-branch.test.ts
- [ ] T029 [P] [US1] Contract test for jenkins_trigger_deployment MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/jenkins-trigger.test.ts
- [ ] T030 [P] [US1] Contract test for jenkins_get_job_status MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/jenkins-status.test.ts
- [ ] T031 [P] [US1] Contract test for jira_update_ticket_status MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/jira-update-tickets.test.ts
- [ ] T032 [P] [US1] Contract test for teams_announce_deployment MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/teams-announce.test.ts
- [ ] T033 [P] [US1] Contract test for trigger_release_deployment MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/trigger-release.test.ts
- [ ] T034 [P] [US1] Unit test for BitbucketProvider checkPRApprovals method in /home/kamil/code/release-automation/mcp-server/tests/unit/providers/git/bitbucket.test.ts
- [ ] T035 [P] [US1] Unit test for BitbucketProvider mergePR method with squash strategy in /home/kamil/code/release-automation/mcp-server/tests/unit/providers/git/bitbucket-merge.test.ts
- [ ] T036 [P] [US1] Integration test for complete release deployment workflow (merge → branch → deploy → JIRA → Teams) in /home/kamil/code/release-automation/mcp-server/tests/integration/release-deployment.test.ts
- [ ] T037 [US1] E2E test for n8n release-deployment workflow execution in /home/kamil/code/release-automation/n8n-workflows/tests/release-deployment.test.ts

### Data Model Entities for User Story 1

- [ ] T038 [P] [US1] Create Release entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/release.ts with fields: id, version, release_type, target_environment, ticket_ids, tenant_ids, status, created_at, audit_trail
- [ ] T039 [P] [US1] Create Ticket entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/ticket.ts with fields: id, pr_id, approval_count, approvers, merge_status, conflicts_detected
- [ ] T040 [P] [US1] Create Deployment entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/deployment.ts with fields: id, release_id, tenant_id, environment_name, jenkins_job_name, status, cache_clear_status
- [ ] T041 [P] [US1] Create Environment entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/environment.ts with fields: name, display_name, is_default, allowed_release_types, tenant_configurations
- [ ] T042 [P] [US1] Create AuditEvent entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/audit-event.ts with fields: id, release_id, timestamp, event_type, actor, status, diagnostic_context

### MCP Tool Implementations for User Story 1

- [ ] T043 [US1] Implement jira_get_release_tickets MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/jira/get-release-tickets.ts using jira.js client with JQL query, PR details fetching (depends on T038, T039)
- [ ] T044 [US1] Implement git_check_pr_approvals MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/git/check-pr-approvals.ts using BitbucketProvider, return approval status, potential reviewers (depends on T015, T039)
- [ ] T045 [US1] Implement git_merge_tickets_to_development MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/git/merge-to-development.ts with squash merge strategy, squash commit message format validation '[TICKET-ID] Summary' (depends on T015, T039)
- [ ] T046 [US1] Implement git_create_release_branch MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/git/create-release-branch.ts with full history preservation, GitFlow naming (release/vX.Y.Z or hotfix/vX.Y.Z) (depends on T015, T038)
- [ ] T047 [US1] Implement jenkins_trigger_deployment MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/jenkins/trigger-deployment.ts with parallel tenant job triggering, environment validation (depends on T022, T040)
- [ ] T048 [US1] Implement jenkins_get_job_status MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/jenkins/get-job-status.ts with polling logic, cache_clear_status extraction from Jenkins job (depends on T022, T040)
- [ ] T049 [US1] Implement jira_update_ticket_status MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/jira/update-ticket-status.ts with batch processing (chunks of 10), transition validation (depends on T023, T039)
- [ ] T050 [US1] Implement teams_announce_deployment MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/teams/announce-deployment.ts with adaptive card formatting, environment, tenant status, cache status display (depends on T024)
- [ ] T051 [US1] Implement trigger_release_deployment orchestration MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/trigger-release-deployment.ts that validates environment, release type restrictions (regular → no PROD, hotfix → any env), and initiates workflow (depends on T038, T041)

### Environment & Release Type Validation for User Story 1

- [ ] T052 [US1] Implement release type environment validator in /home/kamil/code/release-automation/mcp-server/src/services/release-validator.ts that enforces regular releases cannot deploy to PROD, hotfix releases can deploy to any environment including PROD (depends on T038, T041)
- [ ] T053 [US1] Implement default environment resolver in /home/kamil/code/release-automation/mcp-server/src/services/environment-resolver.ts that reads DEFAULT_ENVIRONMENT from .env and allows explicit override (depends on T010, T041)

### n8n Workflow for User Story 1

- [ ] T054 [US1] Create n8n release-deployment workflow in /home/kamil/code/release-automation/n8n-workflows/release-deployment.json with nodes: webhook trigger → validate input → call jira_get_release_tickets → loop check approvals → call git_merge_tickets_to_development → call git_create_release_branch → call jenkins_trigger_deployment → poll jenkins_get_job_status → call jira_update_ticket_status → call teams_announce_deployment
- [ ] T055 [US1] Configure n8n workflow environment validation node in release-deployment.json that calls trigger_release_deployment tool to validate release type restrictions before merge phase

### Audit Logging for User Story 1

- [ ] T056 [US1] Implement audit logger service in /home/kamil/code/release-automation/mcp-server/src/services/audit-logger.ts that logs all MCP tool invocations with structured JSON (timestamp, actor, event_type, status, affected_entities) to append-only log file (depends on T042)
- [ ] T057 [US1] Add audit event hooks to all US1 MCP tools (jira_get_release_tickets, git_check_pr_approvals, git_merge_tickets_to_development, git_create_release_branch, jenkins_trigger_deployment, jenkins_get_job_status, jira_update_ticket_status, teams_announce_deployment) in respective tool files (depends on T056)

**Checkpoint**: User Story 1 COMPLETE - Regular releases can be triggered to Integration/UAT/UAT1 with full automation from merge to deployment notification. PROD is correctly restricted. Independent test scenarios from spec.md can now be validated.

---

## Phase 4: User Story 2 - Intelligent Conflict and Approval Management (Priority: P2)

**Goal**: Automatically detect PR approval insufficiency and merge conflicts, send personalized Teams notifications to PR owners with actionable context, pause workflow, poll for resolution, and resume automatically.

**Independent Test**: Create release with one PR having only 1 approval (needs 2) and another PR with merge conflicts, verify system detects both issues, sends personalized Teams DMs to PR owners with approval count/potential reviewers and conflict file locations/resolution suggestions, pauses release, polls every 2 minutes, resumes when resolved.

### Tests for User Story 2 ⚠️

- [ ] T058 [P] [US2] Contract test for teams_notify_pr_owner MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/teams-notify-owner.test.ts
- [ ] T059 [P] [US2] Unit test for conflict resolution AI analysis service in /home/kamil/code/release-automation/mcp-server/tests/unit/services/conflict-resolver.test.ts
- [ ] T060 [P] [US2] Unit test for notification composer service with adaptive card templates in /home/kamil/code/release-automation/mcp-server/tests/unit/services/notification-composer.test.ts
- [ ] T061 [US2] Integration test for approval insufficient workflow (detect → notify → poll → resume) in /home/kamil/code/release-automation/mcp-server/tests/integration/approval-management.test.ts
- [ ] T062 [US2] Integration test for conflict detection workflow (detect → AI analysis → escalate → poll → resume) in /home/kamil/code/release-automation/mcp-server/tests/integration/conflict-resolution.test.ts

### Data Model Entities for User Story 2

- [ ] T063 [P] [US2] Create ConflictInfo entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/conflict-info.ts with fields: ticket_id, conflicted_files, conflict_analysis, resolution_suggestion, escalated_at, resolved_at
- [ ] T064 [P] [US2] Create ConflictAnalysis entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/conflict-analysis.ts with fields: confidence_score, recommended_resolution, reasoning, risk_factors, should_escalate
- [ ] T065 [P] [US2] Create Notification entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/notification.ts with fields: id, release_id, notification_type, severity, recipient, adaptive_card_json, delivery_status

### AI-Powered Conflict Resolution Service for User Story 2

- [ ] T066 [US2] Implement AI conflict analyzer service in /home/kamil/code/release-automation/mcp-server/src/services/conflict-resolver.ts with 95% confidence threshold for auto-resolution, structured LLM prompt for conflict analysis (base content, branch A/B, file path, file type), returns ConflictAnalysis (depends on T063, T064)
- [ ] T067 [US2] Add AI conflict resolution to git_merge_tickets_to_development tool in /home/kamil/code/release-automation/mcp-server/src/tools/git/merge-to-development.ts when auto_resolve_conflicts parameter is true, call conflict analyzer, escalate if confidence < 95% (depends on T045, T066)

### Notification Service for User Story 2

- [ ] T068 [US2] Implement notification composer service in /home/kamil/code/release-automation/mcp-server/src/services/notification-composer.ts that generates adaptive card JSON for approval_required and conflict_detected notification types with PR owner context (depends on T065)
- [ ] T069 [US2] Implement teams_notify_pr_owner MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/teams/notify-pr-owner.ts for sending personalized Teams DMs with adaptive cards (approval details: current count, required count, potential reviewers; conflict details: file locations, resolution suggestions) (depends on T024, T068)

### Workflow State Management for User Story 2

- [ ] T070 [P] [US2] Create WorkflowExecution entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/workflow-execution.ts with fields: id, release_id, workflow_name, current_phase, state_snapshot, paused, paused_reason, resumed_at
- [ ] T071 [US2] Implement workflow state persistence service in /home/kamil/code/release-automation/mcp-server/src/services/workflow-state.ts that saves state_snapshot to JSON file at phase boundaries (merge, deployment, post_deployment) for recovery (depends on T070)

### n8n Workflows for User Story 2

- [ ] T072 [US2] Create n8n pr-approval-monitor workflow in /home/kamil/code/release-automation/n8n-workflows/pr-approval-monitor.json with cron trigger (every 2 min) → get active releases from state store → loop check approvals → if all approved: resume main workflow
- [ ] T073 [US2] Update n8n release-deployment workflow in /home/kamil/code/release-automation/n8n-workflows/release-deployment.json to add approval check with pause/retry logic: if approval_count < 2 → call teams_notify_pr_owner → pause workflow → wait for pr-approval-monitor to resume
- [ ] T074 [US2] Update n8n release-deployment workflow in /home/kamil/code/release-automation/n8n-workflows/release-deployment.json to add conflict handling: if conflicts detected in git_merge_tickets_to_development → call teams_notify_pr_owner with conflict details → pause workflow (manual resume)

### Audit Logging for User Story 2

- [ ] T075 [US2] Add conflict_detected and conflict_resolved audit event types to audit logger service in /home/kamil/code/release-automation/mcp-server/src/services/audit-logger.ts (depends on T056)
- [ ] T076 [US2] Add notification_sent audit events with delivery confirmation to teams_notify_pr_owner tool in /home/kamil/code/release-automation/mcp-server/src/tools/teams/notify-pr-owner.ts (depends on T069, T075)

**Checkpoint**: User Story 2 COMPLETE - Approval and conflict management fully automated with personalized notifications, AI-powered conflict analysis, workflow pause/resume. Independent test scenarios from spec.md can now be validated.

---

## Phase 5: User Story 3 - Multi-Tenant Deployment Orchestration (Priority: P3)

**Goal**: Execute parallel Jenkins deployments across all platform tenants with independent failure handling, retry failed tenants once, mark per-tenant cache clear status as reported by Jenkins, continue with successful tenants, report partial deployment status to JIRA and Teams.

**Independent Test**: Trigger deployment to 5 tenants in UAT where one tenant's Jenkins job is configured to fail, verify other 4 tenants deploy successfully (Jenkins jobs complete with cache clearing), failed tenant is marked separately, cache clearing skipped for failed tenant, monitoring dashboard shows per-tenant status with cache status from Jenkins jobs.

### Tests for User Story 3 ⚠️

- [ ] T077 [P] [US3] Contract test for jenkins_rollback_tenant MCP tool schema validation in /home/kamil/code/release-automation/mcp-server/tests/contract/jenkins-rollback.test.ts
- [ ] T078 [P] [US3] Unit test for parallel tenant deployment orchestration with independent failure handling in /home/kamil/code/release-automation/mcp-server/tests/unit/services/deployment-orchestrator.test.ts
- [ ] T079 [US3] Integration test for multi-tenant deployment with one failure in /home/kamil/code/release-automation/mcp-server/tests/integration/multi-tenant-deployment.test.ts
- [ ] T080 [US3] Integration test for tenant rollback workflow in /home/kamil/code/release-automation/mcp-server/tests/integration/tenant-rollback.test.ts

### Data Model Entities for User Story 3

- [ ] T081 [P] [US3] Create Tenant entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/tenant.ts with fields: id, display_name, description, active, rollback_supported
- [ ] T082 [P] [US3] Create TenantConfiguration entity type definition in /home/kamil/code/release-automation/mcp-server/src/models/tenant-configuration.ts with fields: tenant_id, environment_name, jenkins_job_name, jenkins_job_parameters

### Deployment Orchestration Service for User Story 3

- [ ] T083 [US3] Implement deployment orchestrator service in /home/kamil/code/release-automation/mcp-server/src/services/deployment-orchestrator.ts with parallel tenant deployment (Promise.all), independent failure handling, retry logic (max 1 retry per tenant per FR-015), per-tenant cache_clear_status tracking (depends on T040, T081)
- [ ] T084 [US3] Update jenkins_trigger_deployment tool in /home/kamil/code/release-automation/mcp-server/src/tools/jenkins/trigger-deployment.ts to accept tenant_ids array and trigger jobs in parallel via deployment orchestrator (depends on T047, T083)
- [ ] T085 [US3] Update jenkins_get_job_status tool in /home/kamil/code/release-automation/mcp-server/src/tools/jenkins/get-job-status.ts to read and track cache_clear_status as reported by Jenkins job (Jenkins executes cache clearing, MCP server receives status via environment variable or job metadata: cleared/skipped/failed) and include in per-tenant status response (depends on T048, T083)

### Rollback Capability for User Story 3

- [ ] T086 [US3] Implement jenkins_rollback_tenant MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/jenkins/rollback-tenant.ts that triggers rollback Jenkins job for specific tenant, validates rollback_supported flag (depends on T022, T081)
- [ ] T087 [US3] Create n8n rollback-tenant workflow in /home/kamil/code/release-automation/n8n-workflows/rollback-tenant.json with webhook trigger → validate tenant supports rollback → call jenkins_rollback_tenant → poll status → update audit log

### JIRA Partial Deployment Status for User Story 3

- [ ] T088 [US3] Update jira_update_ticket_status tool in /home/kamil/code/release-automation/mcp-server/src/tools/jira/update-ticket-status.ts to support "Partially Deployed" status with comment containing successful/failed tenant list and environment (depends on T049)
- [ ] T089 [US3] Update n8n release-deployment workflow in /home/kamil/code/release-automation/n8n-workflows/release-deployment.json to check deployment results: if all tenants success → "Deployed", if some tenants failed → "Partially Deployed" with tenant details

### Teams Notification Updates for User Story 3

- [ ] T090 [US3] Update teams_announce_deployment tool in /home/kamil/code/release-automation/mcp-server/src/tools/teams/announce-deployment.ts adaptive card to include: target environment, per-tenant status (success/failed), per-tenant cache_clear_status as reported by Jenkins jobs (cleared/skipped/failed - Jenkins executes clearing, MCP server displays status), failed tenant error messages (depends on T050)

### Audit Logging for User Story 3

- [ ] T091 [US3] Add deployment_triggered, deployment_completed, cache_cleared audit event types to audit logger service in /home/kamil/code/release-automation/mcp-server/src/services/audit-logger.ts with per-tenant details (depends on T056)
- [ ] T092 [US3] Add rollback_initiated audit event type to jenkins_rollback_tenant tool in /home/kamil/code/release-automation/mcp-server/src/tools/jenkins/rollback-tenant.ts (depends on T086, T091)

**Checkpoint**: User Story 3 COMPLETE - Multi-tenant parallel deployment with independent failure handling, retry logic, cache status tracking, rollback capability operational. Independent test scenarios from spec.md can now be validated.

---

## Phase 6: User Story 4 - Real-Time Monitoring and Observability (Priority: P4)

**Goal**: Provide React web dashboard with real-time deployment status display, per-tenant status grid, audit log viewer, and action trigger capability via MCP client integration. WebSocket updates every 10 seconds during active deployments.

**Independent Test**: Trigger release and monitor dashboard throughout workflow, verify real-time updates for each phase (merge, deployment, post-deployment), per-tenant status with job links and cache status, complete audit trail with timestamps, and Teams notification includes all deployment details.

### Tests for User Story 4 ⚠️

- [ ] T093 [P] [US4] Unit test for React DeploymentStatus component in /home/kamil/code/release-automation/dashboard/tests/components/DeploymentStatus.test.tsx
- [ ] T094 [P] [US4] Unit test for React TenantGrid component in /home/kamil/code/release-automation/dashboard/tests/components/TenantGrid.test.tsx
- [ ] T095 [P] [US4] Unit test for React AuditLog component in /home/kamil/code/release-automation/dashboard/tests/components/AuditLog.test.tsx
- [ ] T096 [P] [US4] Integration test for WebSocket real-time updates in /home/kamil/code/release-automation/dashboard/tests/integration/websocket.test.ts
- [ ] T097 [US4] E2E test for dashboard action trigger via MCP client in /home/kamil/code/release-automation/dashboard/tests/e2e/trigger-release.test.ts

### Dashboard Infrastructure for User Story 4

- [ ] T098 [P] [US4] Create React app entry point in /home/kamil/code/release-automation/dashboard/src/index.tsx with Material-UI theme provider, Zustand store initialization
- [ ] T099 [P] [US4] Create MCP client service in /home/kamil/code/release-automation/dashboard/src/services/mcp-client.ts using axios with JSON-RPC wrapper, authentication bearer token support
- [ ] T100 [P] [US4] Create WebSocket service in /home/kamil/code/release-automation/dashboard/src/services/websocket.ts using Socket.IO client with subscription to deployment updates, reconnection logic with exponential backoff
- [ ] T101 [P] [US4] Create Zustand store for deployment state in /home/kamil/code/release-automation/dashboard/src/store/deployment.ts with actions: setCurrentRelease, updateTenantStatus, addAuditEvent

### Dashboard Components for User Story 4

- [ ] T102 [P] [US4] Create DeploymentStatus component in /home/kamil/code/release-automation/dashboard/src/components/DeploymentStatus.tsx displaying current phase, target environment, progress bar, elapsed time, ETA (depends on T101)
- [ ] T103 [P] [US4] Create TenantGrid component in /home/kamil/code/release-automation/dashboard/src/components/TenantGrid.tsx with per-tenant status cards (queued/running/success/failed), Jenkins job links, cache_clear_status badges, deployment duration, error messages (depends on T101)
- [ ] T104 [P] [US4] Create AuditLog component in /home/kamil/code/release-automation/dashboard/src/components/AuditLog.tsx with filterable event list (timestamp, event_type, actor, status), export to CSV functionality (depends on T101)
- [ ] T105 [P] [US4] Create ActionTrigger component in /home/kamil/code/release-automation/dashboard/src/components/ActionTrigger.tsx with form inputs (release_version, target_environment, ticket_ids), calls trigger_release_deployment MCP tool via MCP client (depends on T099)

### Dashboard React Hooks for User Story 4

- [ ] T106 [P] [US4] Create useDeploymentStatus hook in /home/kamil/code/release-automation/dashboard/src/hooks/useDeploymentStatus.ts that subscribes to WebSocket deployment_update events and updates Zustand store (depends on T100, T101)
- [ ] T107 [P] [US4] Create useAuditLog hook in /home/kamil/code/release-automation/dashboard/src/hooks/useAuditLog.ts that fetches audit events from MCP server and provides filtering (depends on T099, T101)

### MCP Server WebSocket Support for User Story 4

- [ ] T108 [US4] Add Socket.IO server to MCP server in /home/kamil/code/release-automation/mcp-server/src/websocket-server.ts with deployment_update event emitter, client subscription management (depends on T009)
- [ ] T109 [US4] Update audit logger service in /home/kamil/code/release-automation/mcp-server/src/services/audit-logger.ts to emit WebSocket events on every audit log entry for real-time dashboard updates (depends on T056, T108)
- [ ] T110 [US4] Create audit log query MCP tool in /home/kamil/code/release-automation/mcp-server/src/tools/query-audit-log.ts that returns filtered audit events by release_id, date range, event_type (depends on T042)

### Dashboard Deployment for User Story 4

- [ ] T111 [US4] Add dashboard service to Docker Compose in /home/kamil/code/release-automation/docker-compose.yml with port mappings (3001 for HTTP, 3002 for WebSocket), environment variables
- [ ] T112 [US4] Create dashboard Dockerfile in /home/kamil/code/release-automation/dashboard/Dockerfile with multi-stage build (Node.js for build, nginx for serving)

**Checkpoint**: User Story 4 COMPLETE - Real-time monitoring dashboard operational with WebSocket updates, per-tenant status display, audit log viewer, and action trigger via MCP client. Independent test scenarios from spec.md can now be validated.

---

## Phase 7: User Story 5 - Documentation and Integration Extensibility (Priority: P5)

**Goal**: Provide comprehensive documentation for all MCP tools with JSON schemas, n8n workflow architecture, integration guide for adding new providers (Slack, Azure DevOps), configuration reference, and troubleshooting guide.

**Independent Test**: Follow documentation to add Slack integration as new MCP tool, configure in n8n workflow, verify system sends deployment notifications to Slack channel without code changes to existing integrations.

### Tests for User Story 5 ⚠️

- [ ] T113 [P] [US5] Validation test that verifies all MCP tool schemas in contracts/mcp-tools.json match actual tool implementations in /home/kamil/code/release-automation/mcp-server/tests/contract/schema-integrity.test.ts
- [ ] T114 [US5] Integration test for adding new notification provider following documentation guide in /home/kamil/code/release-automation/mcp-server/tests/integration/extensibility.test.ts

### MCP Tool Documentation for User Story 5

- [ ] T115 [P] [US5] Create MCP tools reference documentation in /home/kamil/code/release-automation/docs/mcp-tools.md with all 11 tools: jira_get_release_tickets, git_check_pr_approvals, git_merge_tickets_to_development, git_create_release_branch, jenkins_trigger_deployment, jenkins_get_job_status, jenkins_rollback_tenant, jira_update_ticket_status, teams_notify_pr_owner, teams_announce_deployment, trigger_release_deployment. Include JSON schemas, input/output examples, error codes, usage notes for each tool.
- [ ] T116 [P] [US5] Create MCP tool versioning guide in /home/kamil/code/release-automation/docs/mcp-tool-versioning.md explaining semantic versioning for tool schemas, backward compatibility requirements (MINOR/PATCH), breaking change process (MAJOR version bump)

### Architecture Documentation for User Story 5

- [ ] T117 [P] [US5] Create system architecture documentation in /home/kamil/code/release-automation/docs/architecture.md with diagrams: MCP server architecture, n8n workflow structure, Git platform abstraction layer, Secrets provider abstraction layer, WebSocket real-time updates, multi-tenant deployment flow
- [ ] T118 [P] [US5] Create n8n workflow documentation in /home/kamil/code/release-automation/docs/n8n-workflows.md with flow diagrams for release-deployment, pr-approval-monitor, rollback-tenant workflows, MCP tool call sequences, error handling paths, state persistence

### Integration Extensibility Guide for User Story 5

- [ ] T119 [US5] Create "Adding New Integrations" guide in /home/kamil/code/release-automation/docs/adding-integrations.md with step-by-step instructions: 1) Define MCP tool schema in contracts/mcp-tools.json, 2) Implement tool in mcp-server/src/tools/, 3) Register tool in MCP server index.ts, 4) Add to n8n workflow, 5) Write contract tests, 6) Update monitoring dashboard (if needed). Include Slack integration example with adaptive card sending.
- [ ] T120 [P] [US5] Create provider abstraction guide in /home/kamil/code/release-automation/docs/provider-abstraction.md explaining: Git provider interface (IGitProvider) with methods, adding GitHub/GitLab providers, Secrets provider interface (ISecretsProvider) with methods, adding HashiCorp Vault/AWS Secrets Manager providers

### Configuration Documentation for User Story 5

- [ ] T121 [P] [US5] Create configuration reference in /home/kamil/code/release-automation/docs/configuration.md documenting: .env variables (DEFAULT_ENVIRONMENT, GIT_PLATFORM, JENKINS_BASE_URL, etc.), tenants.yaml structure (tenant IDs, rollback_supported), environments.yaml structure (allowed_release_types, tenant_configurations), approval thresholds, timeout values, retry policies, secret rotation workflow
- [ ] T122 [P] [US5] Create deployment guide in /home/kamil/code/release-automation/docs/deployment.md with instructions for: Docker Compose local setup, Azure Key Vault configuration, n8n workflow import, Jenkins job configuration, JIRA custom field mapping, Teams webhook setup

### Testing & Troubleshooting Documentation for User Story 5

- [ ] T123 [P] [US5] Create testing guide in /home/kamil/code/release-automation/docs/testing.md documenting: unit test patterns (Jest with mocked providers), integration test setup (staging Bitbucket/Jenkins/JIRA/Teams), contract test validation (Zod schema checks), E2E test execution (n8n workflow testing), test data fixtures from quickstart.md
- [ ] T124 [P] [US5] Create troubleshooting guide in /home/kamil/code/release-automation/docs/troubleshooting.md with common issues: JIRA API unavailable (exponential backoff, queued updates), n8n workflow failure mid-deployment (state recovery, manual resume), Jenkins job timeout (retry logic, circuit breaker), cache clearing failure (skip without blocking), conflict resolution escalation (Teams notification, manual intervention)

### Quickstart Validation for User Story 5

- [ ] T125 [US5] Create quickstart validation script in /home/kamil/code/release-automation/scripts/validate-quickstart.sh that runs through all test scenarios from quickstart.md: environment setup, test data fixtures, MCP tool individual testing, user story 1-4 validation, edge case scenarios
- [ ] T126 [US5] Update README.md in /home/kamil/code/release-automation/README.md with project overview, quick start instructions, architecture summary, link to docs/ directory, contribution guidelines

**Checkpoint**: User Story 5 COMPLETE - Comprehensive documentation available for all MCP tools, n8n workflows, integration extensibility, configuration, testing, and troubleshooting. System administrators can add new integrations following documentation without developer expertise.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories, performance optimization, security hardening, comprehensive testing validation

### Security Hardening

- [ ] T127 [P] Audit all log outputs to ensure no credentials exposed (search for API tokens, passwords, keys) in /home/kamil/code/release-automation/mcp-server/src/utils/logger.ts
- [ ] T128 [P] Implement request timeout enforcement in MCP server in /home/kamil/code/release-automation/mcp-server/src/index.ts (30s reads, 60s writes per constitution)
- [ ] T129 [P] Add rate limit headers to MCP server HTTP transport in /home/kamil/code/release-automation/mcp-server/src/index.ts to prevent abuse

### Performance Optimization

- [ ] T130 [P] Add caching for tenant manifest configuration in /home/kamil/code/release-automation/mcp-server/src/config/tenant-manifest.ts (reload on file change, not every request)
- [ ] T131 [P] Add caching for PR approval status in BitbucketProvider in /home/kamil/code/release-automation/mcp-server/src/providers/git/bitbucket.ts (30 second TTL during polling)
- [ ] T132 [P] Optimize n8n workflow polling intervals in /home/kamil/code/release-automation/n8n-workflows/release-deployment.json (30 sec for Jenkins status, 2 min for PR approvals)

### Code Quality & Refactoring

- [ ] T133 [P] Run ESLint and fix all warnings across mcp-server/ and dashboard/ directories
- [ ] T134 [P] Run Prettier to format all TypeScript files in mcp-server/src/ and dashboard/src/
- [ ] T135 [P] Remove unused imports and dead code in all source files
- [ ] T136 [P] Add JSDoc comments to all exported functions and classes in mcp-server/src/ and dashboard/src/

### Additional Unit Tests (Comprehensive Coverage)

- [ ] T137 [P] Unit test for SecretsManager cache TTL expiration in /home/kamil/code/release-automation/mcp-server/tests/unit/config/secrets.test.ts
- [ ] T138 [P] Unit test for retry utility with exponential backoff in /home/kamil/code/release-automation/mcp-server/tests/unit/utils/retry.test.ts
- [ ] T139 [P] Unit test for MCP error response builder in /home/kamil/code/release-automation/mcp-server/tests/unit/utils/mcp-errors.test.ts
- [ ] T140 [P] Unit test for release type environment validator in /home/kamil/code/release-automation/mcp-server/tests/unit/services/release-validator.test.ts
- [ ] T141 [P] Unit test for deployment orchestrator parallel execution in /home/kamil/code/release-automation/mcp-server/tests/unit/services/deployment-orchestrator.test.ts
- [ ] T142 [P] Unit test for Jenkins circuit breaker pattern in /home/kamil/code/release-automation/mcp-server/tests/unit/clients/jenkins.test.ts

### Integration Tests (Staging Environment)

- [ ] T143 Integration test for BitbucketProvider with staging Bitbucket API in /home/kamil/code/release-automation/mcp-server/tests/integration/bitbucket.test.ts
- [ ] T144 [P] Integration test for Jenkins client with staging Jenkins API in /home/kamil/code/release-automation/mcp-server/tests/integration/jenkins.test.ts
- [ ] T145 [P] Integration test for JIRA client with staging JIRA API in /home/kamil/code/release-automation/mcp-server/tests/integration/jira.test.ts
- [ ] T146 [P] Integration test for Teams Graph client with staging Teams API in /home/kamil/code/release-automation/mcp-server/tests/integration/teams.test.ts
- [ ] T147 [P] Integration test for Azure Key Vault provider in /home/kamil/code/release-automation/mcp-server/tests/integration/azure-keyvault.test.ts

### E2E Workflow Tests

- [ ] T148 E2E test for complete regular release deployment to Integration environment in /home/kamil/code/release-automation/n8n-workflows/tests/e2e-regular-release.test.ts
- [ ] T149 E2E test for hotfix release deployment to PROD environment in /home/kamil/code/release-automation/n8n-workflows/tests/e2e-hotfix-release.test.ts
- [ ] T150 E2E test for regular release rejection to PROD environment in /home/kamil/code/release-automation/n8n-workflows/tests/e2e-prod-restriction.test.ts

### Final Validation

- [ ] T151 Run quickstart validation script to verify all test scenarios from quickstart.md work end-to-end
- [ ] T152 Run all contract tests to verify MCP tool schemas match implementations
- [ ] T153 Run all unit tests and ensure 80%+ code coverage
- [ ] T154 Run integration tests against staging systems
- [ ] T155 Verify all edge case scenarios from spec.md (100+ tickets batching, JIRA API unavailable, cache clearing timeout, n8n workflow interruption, emergency release bypass)
- [ ] T156 Performance validation: measure merge phase duration for 50 tickets (<10 min target), per-tenant deployment duration (<15 min target), dashboard update latency (<10 sec target)
- [ ] T157 Rollback timing validation: test per-tenant rollback process end-to-end, measure total time from trigger to completion, verify meets 30-minute target documented in plan.md Complexity Tracking (deviation from Constitution 15 min target accepted due to multi-tenant sequential execution requirement)

**Checkpoint**: Phase 8 COMPLETE - All polish, optimization, testing, and validation complete. System ready for production deployment.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion - MVP increment
- **User Story 2 (Phase 4)**: Depends on Foundational completion - Can start in parallel with US1 but integrates with US1 merge tools
- **User Story 3 (Phase 5)**: Depends on Foundational completion - Can start in parallel with US1/US2 but integrates with US1 deployment tools
- **User Story 4 (Phase 6)**: Depends on Foundational completion - Can start in parallel with US1/US2/US3 (independent dashboard)
- **User Story 5 (Phase 7)**: Depends on US1-US4 completion - Documents all features
- **Polish (Phase 8)**: Depends on all user stories completion

### Critical Path (Sequential MVP Delivery)

1. Phase 1: Setup (T001-T008) → ~1 day
2. Phase 2: Foundational (T009-T024a) → ~3 days
3. Phase 3: User Story 1 (T025-T057) → ~7 days
4. **MVP Checkpoint**: Regular release deployment operational
5. Phase 4: User Story 2 (T058-T076) → ~4 days
6. Phase 5: User Story 3 (T077-T092) → ~4 days
7. Phase 6: User Story 4 (T093-T112) → ~5 days
8. Phase 7: User Story 5 (T113-T126) → ~3 days
9. Phase 8: Polish (T127-T157) → ~4 days

**Total Estimated Duration**: ~31 days (sequential execution)

### Parallel Opportunities

With 4 developers after Foundational phase completes:
- Developer A: User Story 1 (7 days)
- Developer B: User Story 2 (4 days) then User Story 5 (3 days)
- Developer C: User Story 3 (4 days) then Phase 8 tests (3 days)
- Developer D: User Story 4 (5 days) then Phase 8 polish (2 days)

**Parallel Estimated Duration**: ~14 days (after Setup + Foundational: 4 days)

### Within Each User Story

- Tests (contract/unit) MUST be written and FAIL before implementation
- Data model entities can run in parallel (marked with [P])
- MCP tool implementations depend on data models and providers
- n8n workflows depend on MCP tool implementations
- Audit logging added after tool implementations

---

## Implementation Strategy

### MVP First (Recommended)

1. Complete Phase 1: Setup (1 day)
2. Complete Phase 2: Foundational (3 days) - CRITICAL BLOCKING PHASE
3. Complete Phase 3: User Story 1 (7 days)
4. **STOP and VALIDATE**: Test User Story 1 independently per spec.md scenarios
5. Deploy to Integration environment, demo to stakeholders
6. **Decision Point**: Continue with US2-US5 or production-ize MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready (4 days)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: 11 days total)
3. Add User Story 2 → Test independently → Deploy/Demo (approval/conflict management: 15 days total)
4. Add User Story 3 → Test independently → Deploy/Demo (multi-tenant orchestration: 19 days total)
5. Add User Story 4 → Test independently → Deploy/Demo (monitoring dashboard: 24 days total)
6. Add User Story 5 → Documentation complete (27 days total)
7. Phase 8 Polish → Production ready (31 days total)

### Test-First Development

For EVERY task marked with "Test" or "Contract test":
1. Write test first
2. Run test → verify FAILURE
3. Implement feature
4. Run test → verify SUCCESS
5. Commit

This ensures tests actually validate functionality and aren't false positives.

---

## Notes

- All file paths are absolute starting from `/home/kamil/code/release-automation/`
- [P] tasks can run in parallel (different files, no blocking dependencies)
- [Story] label maps task to specific user story (US1, US2, US3, US4, US5)
- Each user story is independently completable and testable per constitution requirements
- Tests are REQUIRED per FR-048 to FR-051, not optional
- Constitution compliance validated in plan.md Phase 1 design - all principles satisfied
- MCP-first architecture enforced: AI clients (n8n, dashboard) interact ONLY through MCP protocol
- Regular releases CANNOT deploy to PROD (enforced in T051, T052, T055)
- Hotfix releases CAN deploy to any environment including PROD
- Default environment from .env overridable via explicit parameter (T053)
- Cache clearing is OUT OF SCOPE for MCP server - handled by Jenkins jobs, tracked by MCP server (T085, T090)
- Commit after each task or logical group
- Stop at checkpoints to validate story independently
- 95% confidence threshold for AI conflict auto-resolution (Constitution Principle I)
- Minimum 2 PR approvals enforced (Constitution Principle II)
- Rollback target: 30 min (deviation from 15 min documented in plan.md Complexity Tracking)

---

## Success Criteria Validation

Per spec.md Success Criteria, the following must be validated in Phase 8:

- **SC-001**: Release deployments complete in <30 min for 50 tickets across 10 tenants (T156)
- **SC-002**: 95%+ auto-merge success rate without manual conflict resolution (T062, T155)
- **SC-003**: PR approval blockers identified and escalated within 30 seconds (T061, T155)
- **SC-004**: Dashboard displays status updates within 10 seconds (T096, T156)
- **SC-005**: 99% deployment success rate with zero incorrect JIRA updates (T036, T151)
- **SC-006**: Tenant failures isolated with zero impact on other tenants (T079, T155)
- **SC-007**: Stakeholders view status without team updates (T097, T151)
- **SC-008**: New integrations added in <4 hours following documentation (T114, T119)
- **SC-009**: Process 100 concurrent releases without degradation (performance testing in T156)
- **SC-010**: Rollback operations complete within 30 minutes (T080, T155)

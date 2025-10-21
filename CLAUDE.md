# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **release automation system** implementing an MCP (Model Context Protocol) server architecture for fully automated deployment orchestration. The system integrates with Bitbucket, Jenkins, JIRA, Microsoft Teams, and Akamai cache management using n8n workflows on-premises.

**Current Status**: Early development - initial feature specification in progress for `001-release-automation-mcp`.

## Development Workflow

This repository uses **SpecKit**, a specification-driven development framework. All feature development follows a structured workflow using slash commands:

### SpecKit Workflow Phases

1. **Specification** (`/speckit.specify`) - Define WHAT users need (business requirements)
   - Creates feature branch and spec.md
   - Focus on user scenarios, functional requirements, success criteria
   - Technology-agnostic (no implementation details)

2. **Clarification** (`/speckit.clarify`) - Resolve ambiguities in the spec
   - Asks up to 5 targeted questions
   - Encodes answers back into spec.md

3. **Planning** (`/speckit.plan`) - Design HOW to implement
   - Creates plan.md with tech stack, architecture, project structure
   - Generates research.md, data-model.md, contracts/, quickstart.md
   - Updates agent context files

4. **Task Generation** (`/speckit.tasks`) - Break down into actionable tasks
   - Creates tasks.md organized by user story priority
   - Dependency-ordered with parallel execution opportunities
   - Independent, testable increments

5. **Implementation** (`/speckit.implement`) - Execute the plan
   - Processes tasks.md sequentially or in parallel
   - Tests after each phase if specified

6. **Analysis** (`/speckit.analyze`) - Validate consistency
   - Cross-artifact analysis across spec.md, plan.md, tasks.md

### Key Scripts

All scripts located in `.specify/scripts/bash/`:

- `create-new-feature.sh --json "$DESCRIPTION" --short-name "feature-name"` - Initialize new feature branch
- `setup-plan.sh --json` - Prepare for implementation planning
- `check-prerequisites.sh --json` - Validate design artifacts before task generation
- `update-agent-context.sh claude` - Update Claude-specific context after planning

**IMPORTANT**: Always use `--json` flag and parse JSON output for absolute paths.

## Architecture Principles (Constitution)

The project enforces these **non-negotiable** principles (see [.specify/memory/constitution.md](.specify/memory/constitution.md)):

### 1. MCP-First Architecture
- All automation capabilities MUST be exposed via MCP server tools
- AI clients interact ONLY through MCP protocol (JSON-RPC)
- No direct AI-to-system integration (Git, Jenkins, JIRA, Teams)
- Server handles credentials, validation, rate limits server-side
- Tool versioning follows semantic versioning

### 2. GitFlow Compliance
- Feature → development: **MUST use squash merge** with format `[TICKET-ID] Summary`
- Development → release: **MUST preserve full commit history** (no squash)
- Minimum 2 PR approvals required before merge
- No direct commits to main/development branches
- Hotfix branches from main only

### 3. Multi-Tenant Orchestration
- Jenkins jobs triggered in parallel for all tenants
- Single tenant failure MUST NOT block other deployments
- Rollback capability per tenant
- Tenant configs in version-controlled manifest

### 4. Automated Conflict Resolution
- Auto-resolve merge conflicts with 95%+ confidence
- Escalate to PR owner via Teams if confidence < 95%
- Track metrics: auto-resolved vs. escalated

### 5. End-to-End Observability
- All events logged with structured data
- Real-time monitoring dashboard
- Audit trail for compliance
- Per-tenant deployment status tracking

### 6. AI Agent Communication
- Context-aware, role-appropriate messaging
- Severity-calibrated (info/warning/critical)
- All communications logged for audit

## MCP Tool Standards

When implementing MCP tools:

**Naming**: Use snake_case with domain prefix (e.g., `git_merge_branch`, `jenkins_trigger_job`)

**Schema Requirements**:
- JSON schema for inputs/outputs
- Rich descriptions for AI understanding
- Enum types for constrained values
- Required vs. optional parameters clearly marked

**Idempotency**: Same input → same outcome or safe no-op

**Error Handling**:
- Structured responses with error codes
- Actionable messages (not just "failed")
- Distinguish retryable vs. permanent failures

## Recommended Implementation Language

**TypeScript (Node.js)** - Rationale:
- Official MCP SDK is TypeScript-first
- n8n native integration (Node.js-based)
- Rich ecosystem: `@octokit/rest`, `axios`, `@microsoft/microsoft-graph-client`, `node-vault`
- Native async/await for API orchestration
- Strong typing prevents runtime errors
- Mature testing frameworks (Jest, Mocha)

**Python Alternative**: Viable with `httpx`, `python-jenkins`, `jira`, `msgraph-core`, `hvac`, but MCP SDK less mature and n8n integration less idiomatic.

## External System Integrations

MCP server integrates with:

1. **Bitbucket** - GitFlow operations (branch, merge, tag, conflict detection)
2. **Microsoft Teams** - Notifications (approvals, conflicts, deployments)
3. **Jenkins** - Multi-tenant deployment orchestration via REST API
4. **JIRA** - Ticket fetching and status updates
5. **Akamai Cache** - Automated cache invalidation across tenants

**Integration Requirements**:
- Versioned APIs with backward compatibility
- Retry logic with exponential backoff
- Circuit breakers for transient failures
- Request timeout (30s reads, 60s writes)
- Rate limit respect
- Sanitized logging (no credentials)

## Secrets Management

- Store credentials in Azure Key Vault
- MCP server retrieves secrets at startup
- NO credentials in code, logs, or AI communication
- Quarterly rotation minimum
- Environment variables for vault access only

## File Organization

```
.specify/
├── memory/
│   └── constitution.md          # Project principles (NON-NEGOTIABLE)
├── scripts/bash/                # Workflow automation scripts
└── templates/                   # Templates for spec, plan, tasks, checklists

.claude/
└── commands/                    # Slash command definitions
    ├── speckit.specify.md
    ├── speckit.clarify.md
    ├── speckit.plan.md
    ├── speckit.tasks.md
    ├── speckit.implement.md
    ├── speckit.analyze.md
    └── speckit.constitution.md

specs/
└── 001-release-automation-mcp/  # Feature-specific artifacts
    ├── spec.md                  # Business requirements
    ├── plan.md                  # Technical design (if planned)
    ├── research.md              # Design decisions (if planned)
    ├── data-model.md            # Entity definitions (if planned)
    ├── contracts/               # API schemas (if planned)
    ├── quickstart.md            # Test scenarios (if planned)
    ├── tasks.md                 # Implementation tasks (if generated)
    └── checklists/              # Quality validation checklists
```

## Deployment Workflow (When Implemented)

AI orchestrates MCP tools in sequence:

1. **Merge Phase**: Check approvals (min 2) → squash merge to development → handle conflicts
2. **Branch Creation**: Create release/vX.Y.Z from development
3. **Deployment**: Trigger Jenkins jobs per tenant (parallel) → poll status → handle failures
4. **Post-Deployment**: Clear caches → update JIRA → announce via Teams
5. **Validation**: Monitor error rates → auto-rollback if anomalies detected

## Working with This Repository

### Starting a New Feature

```bash
/speckit.specify [feature description]
```

This creates the feature branch, spec.md, and validation checklist.

### Making Constitution Changes

```bash
/speckit.constitution
```

Updates constitution.md and syncs all dependent templates. Constitution version follows semantic versioning (MAJOR for breaking changes).

### Key Constraints

- **Setup/Foundational tasks**: Complete BEFORE user story phases
- **User story organization**: Tasks grouped by story priority (P1, P2, P3...)
- **Independent testing**: Each user story must be testable independently
- **Tests are optional**: Only generate test tasks if explicitly requested

### Common Patterns

- All slash commands use `--json` flag for script output
- Always parse JSON for absolute file paths
- Tasks use strict checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- Parallel tasks marked with `[P]` label
- Story tasks marked with `[US1]`, `[US2]`, etc.

## Performance Targets (When Implemented)

- Merge phase: < 10 min (up to 50 tickets)
- Tenant deployment: < 15 min per tenant
- Cache invalidation: < 2 min (all tenants)
- JIRA updates: < 5 min (up to 100 tickets)
- Rollback capability: Within 15 min of deployment

## Compliance & Quality

- Every deployment PR must verify GitFlow compliance
- AI decision logs reviewed quarterly
- Integration failures analyzed monthly
- Constitution reviewed annually
- All MCP tools must have JSON schemas before implementation
- Breaking tool signature changes require constitution amendment


## Output after taken action
Always explain logice behind your decisions. If more than one way of doing something always ask for decision. Be concise and use simple wording. 

## Commiting change
After phase or milestone achievemnt, ask to commit and push changes. 
If agreed, create commit message explaining changes added and autcome expected then push changes. 

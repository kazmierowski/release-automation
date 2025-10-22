# Release Automation MCP Server

> Fully automated release deployment system using Model Context Protocol (MCP) architecture for multi-tenant orchestration across Git, Jenkins, JIRA, and Microsoft Teams.

## Overview

This system provides automated release management following GitFlow methodology with AI-powered conflict resolution, multi-tenant deployment orchestration, and real-time monitoring. Built on MCP architecture to enable any AI client (n8n, Claude Code, custom agents) to orchestrate deployments through standardized tools.

### Key Features

- **🔄 GitFlow Automation**: Automated PR approval checks (min 2), squash merge to development, release branch creation
- **🤖 AI Conflict Resolution**: 95% confidence threshold for automatic merge conflict resolution
- **🏢 Multi-Tenant Orchestration**: Parallel deployment across 10+ tenants with independent failure handling
- **📊 Real-Time Monitoring**: React dashboard with WebSocket updates (<10 sec latency)
- **🔐 MCP-First Architecture**: All automation exposed via versioned MCP tools (JSON-RPC protocol)
- **⚙️ Environment Restrictions**: Regular releases → Integration/UAT/UAT1 only; Hotfixes → any environment including PROD

## Architecture

```
┌─────────────────────────────────────┐
│     AI Client (n8n)                 │
│  Orchestrates deployment workflow   │
└──────────────┬──────────────────────┘
               │ MCP Protocol (JSON-RPC)
┌──────────────▼──────────────────────┐
│     MCP Server (TypeScript)         │
│  • 11 versioned tools               │
│  • Git abstraction (Bitbucket)      │
│  • Secrets abstraction (Azure KV)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  External Systems                   │
│  Git • Jenkins • JIRA • Teams       │
└─────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20.x LTS
- Docker & Docker Compose
- Azure Key Vault (or configure alternative secrets provider)
- Access to: Bitbucket, Jenkins, JIRA, Microsoft Teams

### Installation

1. **Clone and navigate to repository**
   ```bash
   git clone <repository-url>
   cd release-automation
   ```

2. **Configure environment**
   ```bash
   cp config/.env.example config/.env
   # Edit config/.env with your credentials and URLs
   ```

3. **Configure tenants and environments**
   ```bash
   # Edit config/tenants.yaml - add your platform tenants
   # Edit config/environments.yaml - configure deployment targets
   ```

4. **Install dependencies**
   ```bash
   cd mcp-server && npm install
   cd ../dashboard && npm install
   ```

5. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

6. **Access services**
   - MCP Server: http://localhost:3001
   - Dashboard: http://localhost:3000
   - n8n: http://localhost:5678 (admin/changeme)

## Project Structure

```
release-automation/
├── mcp-server/           # MCP server (TypeScript/Node.js)
│   ├── src/
│   │   ├── tools/        # 11 MCP tool implementations
│   │   ├── providers/    # Git & Secrets abstractions
│   │   ├── services/     # Business logic
│   │   ├── config/       # Configuration loaders
│   │   └── utils/        # Retry, logging, validation
│   └── tests/            # Unit, integration, contract tests
├── dashboard/            # React monitoring dashboard
│   ├── src/
│   │   ├── components/   # DeploymentStatus, TenantGrid, AuditLog
│   │   ├── services/     # MCP client, WebSocket
│   │   └── hooks/        # useDeploymentStatus, useAuditLog
│   └── tests/            # Component tests
├── n8n-workflows/        # n8n workflow definitions (JSON)
│   ├── release-deployment.json
│   ├── pr-approval-monitor.json
│   └── rollback-tenant.json
├── config/               # Configuration files
│   ├── .env.example
│   ├── tenants.yaml      # Tenant manifest
│   └── environments.yaml # Environment configuration
└── docs/                 # Documentation
    ├── architecture.md
    ├── mcp-tools.md
    └── adding-integrations.md
```

## MCP Tools

The system exposes 11 versioned tools via JSON-RPC:

### Git Operations
- `git_check_pr_approvals` - Validate PR has min 2 approvals
- `git_merge_tickets_to_development` - Squash merge with `[TICKET-ID] Summary` format
- `git_create_release_branch` - Create release/vX.Y.Z or hotfix/vX.Y.Z

### Jenkins Deployment
- `jenkins_trigger_deployment` - Trigger multi-tenant parallel deployment
- `jenkins_get_job_status` - Poll deployment status with cache clear status
- `jenkins_rollback_tenant` - Per-tenant rollback within 30 min window

### JIRA Integration
- `jira_get_release_tickets` - Fetch tickets for release version
- `jira_update_ticket_status` - Batch update to Deployed/Partially Deployed

### Teams Notifications
- `teams_notify_pr_owner` - Send approval/conflict notifications with adaptive cards
- `teams_announce_deployment` - Post deployment summary to channel

### Orchestration
- `trigger_release_deployment` - Main entry point for complete workflow

## Development

### Run MCP Server Locally
```bash
cd mcp-server
npm run dev
```

### Run Dashboard Locally
```bash
cd dashboard
npm run dev
```

### Run Tests
```bash
cd mcp-server
npm test                # All tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:contract   # Contract/schema tests
npm run test:coverage   # With coverage report
```

### Lint and Format
```bash
npm run lint            # Check linting
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Prettier
```

## Configuration

### Environment Restrictions (Constitution Compliance)

- **Regular Releases** (`release/*`): Can deploy to Integration, UAT, UAT1 only
- **Hotfix Releases** (`hotfix/*`): Can deploy to any environment including PROD
- **PR Approvals**: Minimum 2 approvals enforced before merge
- **Merge Strategy**:
  - Feature → Development: Squash merge with `[TICKET-ID] Summary`
  - Development → Release: Full commit history preserved

### Default Environment

Set `DEFAULT_ENVIRONMENT` in `.env`:
- `Integration` (default)
- `UAT`
- `UAT1`

Can be overridden per deployment request. Regular releases are blocked from PROD.

### Cache Clearing

**OUT OF SCOPE** for MCP server - handled entirely by Jenkins jobs. The MCP server:
- ✅ Tracks cache clear status as reported by Jenkins (cleared/skipped/failed)
- ✅ Displays status in dashboard and Teams notifications
- ❌ Does NOT execute cache clearing operations

## Deployment Workflow

1. **Trigger Release** (via dashboard, n8n, or CLI)
2. **Merge Phase**
   - Check PR approvals (min 2)
   - Squash merge tickets to development
   - AI-powered conflict resolution (95% confidence)
3. **Branch Creation**
   - Create release/vX.Y.Z from development
4. **Deployment Phase**
   - Trigger Jenkins jobs for all tenants (parallel)
   - Poll status with retry logic (1 retry per tenant)
   - Jenkins handles cache clearing per tenant
5. **Post-Deployment**
   - Update JIRA tickets (Deployed/Partially Deployed)
   - Send Teams announcement with cache status
   - Update audit log

## Performance Targets

- Merge phase: <10 min (50 tickets)
- Per-tenant deployment: <15 min
- Total deployment: <30 min (10 tenants, parallel)
- Dashboard updates: <10 sec latency
- Rollback: 30 min per tenant

## Constitution Principles

This system follows 6 **non-negotiable** principles:

1. **Automated Conflict Resolution** - 95% confidence threshold
2. **GitFlow Compliance** - 2 approvals, squash merge, PROD restrictions
3. **Multi-Tenant Orchestration** - Parallel execution, isolated failures
4. **AI Agent Communication** - Context-aware, severity-calibrated
5. **End-to-End Observability** - Complete audit trail
6. **MCP-First Architecture** - No direct AI-to-system integration

See `.specify/memory/constitution.md` for complete details.

## Documentation

- **Architecture**: [docs/architecture.md](docs/architecture.md)
- **MCP Tools Reference**: [docs/mcp-tools.md](docs/mcp-tools.md)
- **Adding Integrations**: [docs/adding-integrations.md](docs/adding-integrations.md)
- **Specification**: [specs/001-release-automation-mcp/spec.md](specs/001-release-automation-mcp/spec.md)
- **Implementation Plan**: [specs/001-release-automation-mcp/plan.md](specs/001-release-automation-mcp/plan.md)

## Troubleshooting

### MCP Server won't start
- Check Azure Key Vault credentials in `.env`
- Verify `DEFAULT_ENVIRONMENT` is valid (Integration/UAT/UAT1)
- Check logs: `docker logs release-automation-mcp-server`

### Deployment failing
- Verify tenant exists in `config/tenants.yaml` for target environment
- Check Jenkins job names match tenant configuration
- Validate PR approvals >= 2 via Git platform UI

### Dashboard not updating
- Verify WebSocket connection: Browser DevTools → Network → WS
- Check MCP server logs for WebSocket errors
- Confirm `VITE_WEBSOCKET_URL` in dashboard `.env`

## Contributing

1. Feature development follows SpecKit workflow (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`)
2. All changes must pass constitution compliance checks
3. Tests required per FR-048 to FR-051 (unit, integration, contract, E2E)
4. Code review requires 2 approvals (per GitFlow principle)

## License

MIT

## Support

For issues, questions, or contributions, please refer to the project documentation or contact the development team.

---

**Generated with SpecKit** | Constitution v1.3.0 | MCP SDK v1.0+

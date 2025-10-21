# Research: Release Automation MCP Server

**Feature**: Release Automation MCP Server
**Date**: 2025-10-19
**Phase**: 0 (Research & Decision Documentation)

## Overview

This document captures research findings and design decisions for implementing a release automation system using Model Context Protocol (MCP) server architecture. All decisions resolve "NEEDS CLARIFICATION" items from the Technical Context and establish best practices for technology choices.

---

## 1. MCP SDK for TypeScript

### Decision
Use `@modelcontextprotocol/sdk` v1.0+ as the foundation for MCP server implementation.

### Rationale
- **Official TypeScript SDK**: Anthropic-maintained SDK with first-class TypeScript support
- **JSON-RPC protocol**: Built-in protocol handling for tool registration, request/response validation
- **Tool schema validation**: Automatic JSON schema validation for input/output parameters
- **Server transports**: Supports stdio, HTTP/SSE, and WebSocket transports out-of-the-box
- **Type safety**: Strong TypeScript types for tool definitions and responses
- **Active maintenance**: Regular updates and comprehensive documentation

### Alternatives Considered
- **Custom JSON-RPC implementation**: Rejected due to complexity and lack of schema validation
- **Python MCP SDK**: Rejected because TypeScript chosen for primary language (n8n compatibility, ecosystem)

### Implementation Pattern
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'release-automation-mcp',
  version: '1.0.0',
});

// Register MCP tool with schema
server.tool(
  'git_merge_to_development',
  'Merge feature branches to development with squash merge',
  {
    ticket_ids: z.array(z.string()).describe('JIRA ticket IDs to merge'),
    merge_strategy: z.enum(['squash', 'merge']).default('squash'),
    auto_resolve_conflicts: z.boolean().default(false),
  },
  async (args) => {
    // Implementation
    return { merged: [], conflicts: [] };
  }
);
```

### Best Practices
- Use Zod for runtime schema validation (integrates seamlessly with MCP SDK)
- Implement idempotency in tool handlers (same input → same outcome or no-op)
- Return structured errors with error codes for AI decision-making
- Version tool schemas independently using semantic versioning

### References
- MCP SDK Documentation: https://github.com/modelcontextprotocol/typescript-sdk
- MCP Specification: https://spec.modelcontextprotocol.io/

---

## 2. Git Platform Abstraction Layer (Bitbucket Initial Implementation)

### Decision
Create abstraction layer with interface `IGitProvider` and implement `BitbucketProvider` as the initial concrete implementation.

### Rationale
- **Future-proofing**: Supports migration to GitHub/GitLab without changing MCP tool logic
- **Separation of concerns**: MCP tools call abstract interface, providers handle API-specific details
- **Testability**: Mock providers for unit tests without external API calls
- **Constitution compliance**: Supports multi-platform deployment as specified

### Bitbucket REST API Client
**Package**: `bitbucket` (npm)
**Version**: 2.x (REST API v2.0 support)

**Key Features**:
- Pull request operations (get, approve, merge)
- Branch operations (create, delete, list)
- Conflict detection in PRs
- Reviewer suggestions based on file history
- Commit history and diff retrieval

### Alternatives Considered
- **`@octokit/rest` (GitHub)**: Rejected for initial implementation (Bitbucket required first)
- **Direct REST API calls via axios**: Rejected due to lack of type safety and pagination handling

### Implementation Pattern
```typescript
// providers/git/base.ts
export interface IGitProvider {
  checkPRApprovals(prId: string): Promise<PRApprovalStatus>;
  mergePR(prId: string, strategy: 'squash' | 'merge', message?: string): Promise<MergeResult>;
  createBranch(name: string, fromBranch: string): Promise<BranchInfo>;
  detectConflicts(sourceBranch: string, targetBranch: string): Promise<ConflictInfo>;
}

// providers/git/bitbucket.ts
export class BitbucketProvider implements IGitProvider {
  constructor(
    private client: Bitbucket,
    private workspace: string,
    private repoSlug: string
  ) {}

  async checkPRApprovals(prId: string): Promise<PRApprovalStatus> {
    const pr = await this.client.pullrequests.get({
      workspace: this.workspace,
      repo_slug: this.repoSlug,
      pull_request_id: parseInt(prId),
    });

    return {
      prId,
      approvalCount: pr.data.participants.filter(p => p.approved).length,
      requiredApprovals: 2,
      approved: pr.data.participants.filter(p => p.approved).length >= 2,
      approvers: pr.data.participants.filter(p => p.approved).map(p => p.user.display_name),
      prOwner: pr.data.author.display_name,
      potentialReviewers: await this.suggestReviewers(pr.data),
    };
  }

  async mergePR(prId: string, strategy: 'squash' | 'merge', message?: string): Promise<MergeResult> {
    const mergeStrategy = strategy === 'squash' ? 'squash' : 'merge_commit';

    try {
      const result = await this.client.pullrequests.merge({
        workspace: this.workspace,
        repo_slug: this.repoSlug,
        pull_request_id: parseInt(prId),
        merge_strategy: mergeStrategy,
        message: message,
      });

      return {
        success: true,
        commitSha: result.data.merge_commit.hash,
        squashed: strategy === 'squash',
      };
    } catch (error) {
      if (error.status === 409) {
        // Conflict detected
        return {
          success: false,
          conflict: await this.detectConflicts(prId),
        };
      }
      throw error;
    }
  }
}
```

### Best Practices
- Use dependency injection for provider selection (environment variable: `GIT_PROVIDER=bitbucket`)
- Implement retry logic with exponential backoff for transient API failures
- Cache PR approval status for 30 seconds to reduce API calls during polling
- Sanitize all API responses in logs (no user emails, token fragments)

### References
- Bitbucket REST API: https://developer.atlassian.com/cloud/bitbucket/rest/
- `bitbucket` npm package: https://www.npmjs.com/package/bitbucket

---

## 3. Secrets Management Abstraction Layer (Azure Key Vault Initial Implementation)

### Decision
Create abstraction layer with interface `ISecretsProvider` and implement `AzureKeyVaultProvider` as the initial concrete implementation.

### Rationale
- **Security**: Centralized credential storage with audit logging
- **Rotation**: Supports quarterly credential rotation without code changes
- **Abstraction**: Supports future migration to HashiCorp Vault or AWS Secrets Manager
- **Constitution compliance**: Secrets never exposed to AI clients or logs

### Azure Key Vault SDK
**Package**: `@azure/keyvault-secrets`
**Version**: 4.x

**Key Features**:
- Secret versioning (supports rotation with fallback to previous version)
- Access policies and RBAC
- Audit logging of secret access
- Automatic retry with exponential backoff
- Azure AD authentication

### Alternatives Considered
- **Environment variables**: Rejected due to lack of rotation, audit logging, and security concerns
- **HashiCorp Vault**: Viable alternative, deferred to future implementation (abstraction layer supports)
- **AWS Secrets Manager**: Viable alternative, deferred to future implementation (abstraction layer supports)

### Implementation Pattern
```typescript
// providers/secrets/base.ts
export interface ISecretsProvider {
  getSecret(name: string): Promise<string>;
  listSecrets(): Promise<string[]>;
  rotateSecret(name: string, newValue: string): Promise<void>;
}

// providers/secrets/azure-keyvault.ts
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

export class AzureKeyVaultProvider implements ISecretsProvider {
  private client: SecretClient;

  constructor(vaultUrl: string) {
    const credential = new DefaultAzureCredential();
    this.client = new SecretClient(vaultUrl, credential);
  }

  async getSecret(name: string): Promise<string> {
    try {
      const secret = await this.client.getSecret(name);
      return secret.value!;
    } catch (error) {
      throw new Error(`Failed to retrieve secret '${name}': ${error.message}`);
    }
  }

  async listSecrets(): Promise<string[]> {
    const secrets: string[] = [];
    for await (const secretProperties of this.client.listPropertiesOfSecrets()) {
      secrets.push(secretProperties.name);
    }
    return secrets;
  }

  async rotateSecret(name: string, newValue: string): Promise<void> {
    await this.client.setSecret(name, newValue);
  }
}

// config/secrets.ts
export class SecretsManager {
  private provider: ISecretsProvider;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();

  constructor(provider: ISecretsProvider) {
    this.provider = provider;
  }

  async getSecret(name: string): Promise<string> {
    // Cache for 5 minutes to reduce API calls
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.provider.getSecret(name);
    this.cache.set(name, {
      value,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    return value;
  }
}
```

### Required Secrets
- `BITBUCKET_USERNAME` / `BITBUCKET_APP_PASSWORD`
- `JENKINS_URL` / `JENKINS_API_TOKEN`
- `JIRA_EMAIL` / `JIRA_API_TOKEN`
- `TEAMS_WEBHOOK_URL` (or Graph API credentials)
- `AZURE_VAULT_URL` (environment variable, not in vault)

### Best Practices
- Use Managed Identity for Azure authentication (no credentials in code)
- Cache secrets for 5 minutes to reduce Key Vault API calls and costs
- Implement secret rotation workflow: add new version → update references → delete old version
- Never log secret values (sanitize with `***REDACTED***` placeholder)
- Set secret expiration dates in Key Vault for quarterly rotation reminders

### References
- Azure Key Vault SDK: https://docs.microsoft.com/en-us/javascript/api/@azure/keyvault-secrets/
- Azure Managed Identity: https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/

---

## 4. AI-Powered Conflict Resolution

### Decision
Use LLM-based conflict analysis with 95% confidence threshold for auto-resolution. Implement using MCP SDK's ability to call external AI models.

### Rationale
- **Context awareness**: AI can analyze code semantics, not just line-level diffs
- **Learning from patterns**: Identifies safe auto-resolutions (e.g., import reordering, whitespace)
- **Confidence scoring**: Provides quantifiable measure for escalation decisions
- **Constitution compliance**: Meets 95% confidence threshold requirement

### Implementation Approach

**Conflict Detection**: Use Git provider API to detect merge conflicts (Bitbucket PR merge preview)

**AI Analysis**: Send conflict context to LLM with structured prompt:
```typescript
async analyzeConflict(conflict: ConflictInfo): Promise<ConflictResolution> {
  const prompt = `
Analyze the following Git merge conflict and determine if it can be safely auto-resolved.

**Base Content**:
${conflict.baseContent}

**Branch A (feature branch)**:
${conflict.branchAContent}

**Branch B (development branch)**:
${conflict.branchBContent}

**File Path**: ${conflict.filePath}
**File Type**: ${conflict.fileType}

Provide:
1. Confidence score (0-100) for auto-resolution safety
2. Recommended resolution (if confidence >= 95)
3. Reasoning for the decision
4. Risk factors if any

Format response as JSON.
`;

  const response = await this.aiClient.analyze(prompt);
  return {
    confidence: response.confidence,
    resolution: response.resolution,
    reasoning: response.reasoning,
    shouldEscalate: response.confidence < 95,
  };
}
```

**Safe Auto-Resolution Patterns**:
- Import statement reordering (Python, JavaScript)
- Whitespace-only conflicts (formatting)
- Non-overlapping changes in different code blocks
- Version number updates in package.json/requirements.txt

**Escalation Triggers** (confidence < 95%):
- Logic changes in same function/method
- Conflicting variable assignments
- Schema migrations with overlapping columns
- Configuration value conflicts

### Alternatives Considered
- **Rule-based conflict resolution**: Rejected due to brittleness and inability to handle semantic conflicts
- **Manual-only resolution**: Rejected as it violates Constitution Principle I
- **git-automerge tools**: Rejected due to lack of confidence scoring and context awareness

### Best Practices
- Log all conflict resolutions with AI reasoning for post-deployment audit
- Track auto-resolution success rate (monitor production issues correlated with auto-resolved conflicts)
- Implement circuit breaker: if 3+ auto-resolutions cause issues in 30 days, increase threshold to 98%
- Include file history context in AI prompt (recent commits to conflicted file)

### References
- Git Merge Conflict Anatomy: https://git-scm.com/docs/git-merge#_how_conflicts_are_presented
- Semantic Merge Tools: https://semver.org/

---

## 5. n8n Workflow Integration

### Decision
Use n8n self-hosted deployment with HTTP webhook triggers and MCP tool execution via HTTP requests.

### Rationale
- **Visual workflow**: Non-developers can understand and modify deployment logic
- **State persistence**: n8n stores workflow execution state for recovery
- **Error handling**: Built-in retry logic, error routing, and manual intervention nodes
- **Scheduling**: Supports cron-based triggers for scheduled releases
- **On-premises**: Constitution requires on-premises deployment for security

### n8n Workflow Structure

**Main Workflow: Release Deployment**
```
Webhook Trigger (HTTP POST /release-deployment)
  ↓
Validate Input (release version, target environment)
  ↓
Call MCP Tool: jira_get_release_tickets
  ↓
Loop: For each ticket
  ↓
  Call MCP Tool: git_check_pr_approvals
  ↓
  IF approval_count < 2:
    → Call MCP Tool: teams_notify_pr_owner
    → Wait & Retry (2 min intervals, max 10 retries)
  ↓
Call MCP Tool: git_merge_tickets_to_development (with squash_commit_messages)
  ↓
  IF conflicts detected:
    → Call MCP Tool: teams_notify_pr_owners (with conflict details)
    → Pause Workflow (manual resume)
  ↓
Call MCP Tool: git_create_release_branch
  ↓
Call MCP Tool: jenkins_deploy_to_tenants (parallel execution)
  ↓
Poll Loop: jenkins_get_job_status (30 sec intervals, max 30 min timeout)
  ↓
  IF any tenant failed:
    → Retry once
    → Log failure, continue with successful tenants
  ↓
Call MCP Tool: jira_update_ticket_status (batch update to "Deployed")
  ↓
Call MCP Tool: teams_announce_deployment (with summary and cache status)
  ↓
End
```

**Supporting Workflow: PR Approval Monitor** (scheduled, every 2 minutes)
```
Cron Trigger (every 2 min)
  ↓
Get Active Release Workflows (from state store)
  ↓
Loop: For each paused workflow waiting for approvals
  ↓
  Call MCP Tool: git_check_pr_approvals
  ↓
  IF all PRs approved:
    → Resume Workflow Execution
```

### n8n Node Configuration

**HTTP Request Node (MCP Tool Call)**:
- Method: POST
- URL: `http://mcp-server:3000/tool/<tool_name>`
- Authentication: Bearer token from Azure Key Vault
- Headers: `Content-Type: application/json`
- Body: JSON-RPC format
  ```json
  {
    "jsonrpc": "2.0",
    "id": "{{$node['Trigger'].json['workflow_id']}}",
    "method": "git_check_pr_approvals",
    "params": {
      "pr_id": "{{$node['GetTickets'].json['ticket']['pr_id']}}"
    }
  }
  ```

**Error Handling**:
- Retry on 5xx errors: 3 attempts with exponential backoff (2s, 4s, 8s)
- Continue on 4xx errors: Log error, send to error handling branch
- Timeout: 60 seconds for write operations, 30 seconds for reads

### Alternatives Considered
- **GitHub Actions / GitLab CI**: Rejected due to tight coupling with Git platform
- **Apache Airflow**: Rejected due to complexity and Python-centric design
- **Custom orchestration**: Rejected due to reinventing state management and error handling

### Best Practices
- Use n8n workflow versioning (export as JSON, commit to Git)
- Implement workflow execution logging to external audit store (not just n8n DB)
- Set workflow timeout: 2 hours max (exceeds performance targets, indicates issues)
- Use n8n Sticky nodes for error handling (aggregate errors, send single notification)

### References
- n8n Documentation: https://docs.n8n.io/
- n8n HTTP Request Node: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
- n8n Workflow State: https://docs.n8n.io/workflows/executions/

---

## 6. React Monitoring Dashboard

### Decision
Use React 18+ with TypeScript, Material-UI (MUI) component library, and WebSocket (Socket.IO) for real-time updates.

### Rationale
- **Real-time updates**: WebSocket provides low-latency status updates without polling
- **Component reusability**: MUI provides pre-built components (grids, cards, charts)
- **TypeScript safety**: Type-safe props and state management
- **MCP client integration**: Dashboard acts as MCP client to trigger releases

### Technology Stack
- **Frontend Framework**: React 18.2+ with TypeScript 5.3+
- **UI Library**: Material-UI (MUI) v5.x
- **State Management**: Zustand (lightweight, TypeScript-first)
- **Real-time Communication**: Socket.IO client
- **Charting**: Recharts (for deployment timeline visualization)
- **HTTP Client**: Axios with MCP JSON-RPC wrapper

### Dashboard Features

**1. Deployment Status View**
- Current phase indicator (Merge → Deployment → Post-Deployment)
- Progress bar with ETA
- Target environment badge (Integration/UAT/UAT1/PROD)
- Elapsed time counter

**2. Tenant Grid**
- Per-tenant status cards (queued → running → success/failed)
- Jenkins job links
- Cache clearing status (cleared/skipped/failed)
- Deployment duration
- Error messages (expandable)

**3. Audit Log**
- Filterable event log (merge, deployment, notification, JIRA update)
- Timestamp, actor, event type, status
- Export to CSV

**4. Action Trigger**
- Form to trigger new release (release version, target environment, ticket IDs)
- Calls MCP tool `trigger_release_deployment` via HTTP

### Implementation Pattern

**MCP Client Service** (dashboard/src/services/mcp-client.ts):
```typescript
import axios from 'axios';

export class MCPClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async callTool<T>(toolName: string, params: any): Promise<T> {
    const response = await axios.post(
      `${this.baseUrl}/tool/${toolName}`,
      {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: toolName,
        params,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data.result as T;
  }

  async triggerRelease(releaseVersion: string, targetEnvironment: string, ticketIds: string[]): Promise<void> {
    return this.callTool('trigger_release_deployment', {
      release_version: releaseVersion,
      target_environment: targetEnvironment,
      ticket_ids: ticketIds,
    });
  }
}
```

**WebSocket Hook** (dashboard/src/hooks/useDeploymentStatus.ts):
```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useDeploymentStatus(releaseVersion: string) {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://mcp-server:3000');

    newSocket.emit('subscribe', { release_version: releaseVersion });

    newSocket.on('deployment_update', (data: DeploymentStatus) => {
      setStatus(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [releaseVersion]);

  return status;
}
```

### Alternatives Considered
- **Vue.js**: Rejected due to smaller TypeScript ecosystem
- **Angular**: Rejected due to complexity and learning curve
- **Server-Sent Events (SSE)**: Rejected in favor of WebSocket for bidirectional communication
- **Polling**: Rejected due to higher latency and server load

### Best Practices
- Use React.memo for tenant cards to prevent unnecessary re-renders
- Implement optimistic UI updates (show "triggering..." immediately, confirm with WebSocket)
- Cache deployment history in browser localStorage (reduce server queries)
- Implement retry logic for WebSocket reconnection (exponential backoff)

### References
- React 18 Documentation: https://react.dev/
- Material-UI: https://mui.com/
- Socket.IO Client: https://socket.io/docs/v4/client-api/
- Zustand: https://github.com/pmndrs/zustand

---

## 7. Testing Strategy

### Decision
Multi-layered testing approach: Unit tests (Jest), Integration tests (staging systems), Contract tests (MCP schemas), E2E tests (n8n workflows).

### Rationale
- **Unit tests**: Fast feedback on MCP tool logic, conflict resolution algorithms
- **Integration tests**: Validate against real APIs (Bitbucket, Jenkins, JIRA, Teams) in staging environment
- **Contract tests**: Ensure MCP tool schemas match implementation
- **E2E tests**: Validate complete deployment workflow orchestration

### Testing Layers

**1. Unit Tests (Jest)**

**Target**: MCP tool implementations, services, providers
**Mocking**: Mock external API clients (Bitbucket, Jenkins, JIRA, Teams)
**Coverage Goal**: 80%+

Example (mcp-server/tests/unit/tools/git/check-pr-approvals.test.ts):
```typescript
import { checkPRApprovals } from '../../../../src/tools/git/check-pr-approvals';
import { BitbucketProvider } from '../../../../src/providers/git/bitbucket';

jest.mock('../../../../src/providers/git/bitbucket');

describe('checkPRApprovals', () => {
  it('should return approved status when PR has 2+ approvals', async () => {
    const mockProvider = new BitbucketProvider(null, '', '');
    mockProvider.checkPRApprovals = jest.fn().mockResolvedValue({
      prId: '123',
      approvalCount: 2,
      requiredApprovals: 2,
      approved: true,
      approvers: ['Alice', 'Bob'],
      prOwner: 'Charlie',
      potentialReviewers: ['David', 'Eve'],
    });

    const result = await checkPRApprovals({ pr_id: '123' }, mockProvider);

    expect(result.approved).toBe(true);
    expect(result.approval_count).toBe(2);
  });

  it('should return not approved when PR has < 2 approvals', async () => {
    const mockProvider = new BitbucketProvider(null, '', '');
    mockProvider.checkPRApprovals = jest.fn().mockResolvedValue({
      prId: '123',
      approvalCount: 1,
      requiredApprovals: 2,
      approved: false,
      approvers: ['Alice'],
      prOwner: 'Charlie',
      potentialReviewers: ['Bob', 'David', 'Eve'],
    });

    const result = await checkPRApprovals({ pr_id: '123' }, mockProvider);

    expect(result.approved).toBe(false);
    expect(result.potential_reviewers).toContain('Bob');
  });
});
```

**2. Integration Tests (Staging Systems)**

**Target**: Real API interactions with staging/integration instances
**Environment**: Requires staging Bitbucket, Jenkins, JIRA, Teams instances
**Execution**: Manual trigger (not in CI/CD due to external dependencies)

Example (mcp-server/tests/integration/git.test.ts):
```typescript
import { BitbucketProvider } from '../../src/providers/git/bitbucket';
import Bitbucket from 'bitbucket';

describe('BitbucketProvider Integration', () => {
  let provider: BitbucketProvider;

  beforeAll(() => {
    const client = new Bitbucket({
      auth: {
        username: process.env.BITBUCKET_USERNAME,
        password: process.env.BITBUCKET_APP_PASSWORD,
      },
    });

    provider = new BitbucketProvider(client, 'staging-workspace', 'test-repo');
  });

  it('should fetch PR approval status from staging Bitbucket', async () => {
    const result = await provider.checkPRApprovals('1'); // Known staging PR

    expect(result.prId).toBe('1');
    expect(result.approvalCount).toBeGreaterThanOrEqual(0);
    expect(result.requiredApprovals).toBe(2);
  });
});
```

**3. Contract Tests (MCP Schema Validation)**

**Target**: MCP tool input/output schemas
**Validation**: Ensure schemas match actual implementation responses

Example (mcp-server/tests/contract/mcp-tools.test.ts):
```typescript
import { z } from 'zod';
import { checkPRApprovals } from '../../src/tools/git/check-pr-approvals';

describe('MCP Tool Contracts', () => {
  it('checkPRApprovals output should match schema', async () => {
    const outputSchema = z.object({
      pr_id: z.string(),
      approval_count: z.number(),
      required_approvals: z.number(),
      approved: z.boolean(),
      approvers: z.array(z.string()),
      pr_owner: z.string(),
      potential_reviewers: z.array(z.string()),
    });

    const mockProvider = createMockProvider();
    const result = await checkPRApprovals({ pr_id: '123' }, mockProvider);

    expect(() => outputSchema.parse(result)).not.toThrow();
  });
});
```

**4. E2E Tests (n8n Workflows)**

**Target**: Complete deployment workflow from trigger to completion
**Environment**: Local n8n instance, mocked external APIs (nock/msw)
**Execution**: CI/CD pipeline (GitHub Actions)

Example (n8n-workflows/tests/release-deployment.test.ts):
```typescript
import { WorkflowTestRunner } from 'n8n';
import nock from 'nock';

describe('Release Deployment Workflow E2E', () => {
  it('should complete full deployment workflow for approved PRs', async () => {
    // Mock MCP server responses
    nock('http://mcp-server:3000')
      .post('/tool/jira_get_release_tickets')
      .reply(200, { result: { tickets: [{ id: 'PROJ-123', pr_id: '1' }] } });

    nock('http://mcp-server:3000')
      .post('/tool/git_check_pr_approvals')
      .reply(200, { result: { approved: true, approval_count: 2 } });

    nock('http://mcp-server:3000')
      .post('/tool/git_merge_tickets_to_development')
      .reply(200, { result: { merged: [{ ticket_id: 'PROJ-123', commit_sha: 'abc123' }], conflicts: [] } });

    // ... more mocks

    const workflow = await WorkflowTestRunner.loadWorkflow('release-deployment.json');
    const result = await WorkflowTestRunner.execute(workflow, {
      release_version: 'v1.0.0',
      target_environment: 'Integration',
    });

    expect(result.status).toBe('success');
    expect(result.nodes['MergeTickets'].output.merged).toHaveLength(1);
  });
});
```

### Test Execution Strategy
1. **Unit tests**: Run on every commit (pre-commit hook, CI/CD)
2. **Contract tests**: Run on every commit (CI/CD)
3. **Integration tests**: Run manually before deployment to staging (weekly)
4. **E2E tests**: Run on PR merge to development (CI/CD)

### Alternatives Considered
- **Cypress/Playwright for dashboard**: Deferred to Phase 2 (initial focus on backend)
- **Postman collections**: Rejected in favor of programmatic Jest tests
- **Manual testing only**: Rejected due to regression risk

### Best Practices
- Use test fixtures for consistent test data (sample PRs, JIRA tickets)
- Implement test data cleanup in `afterEach` hooks (delete created branches, PRs)
- Tag integration tests: `@integration` (skip in CI/CD, run manually)
- Use test coverage reports (Jest coverage, SonarQube)

### References
- Jest Documentation: https://jestjs.io/
- Nock (HTTP mocking): https://github.com/nock/nock
- n8n Testing: https://docs.n8n.io/embed/workflow-testing/

---

## 8. Jenkins REST API Integration

### Decision
Use `jenkins` npm package for Jenkins REST API interactions with custom retry logic and circuit breaker.

### Rationale
- **Type-safe API**: TypeScript definitions for Jenkins job operations
- **Queue management**: Support for job queuing, status polling, cancellation
- **Crumb authentication**: Built-in CSRF protection handling
- **Job parameterization**: Pass tenant-specific parameters to Jenkins jobs

### Jenkins npm Package
**Package**: `jenkins`
**Version**: 1.x

**Key Features**:
- Trigger parameterized builds
- Poll job queue and build status
- Retrieve build logs and artifacts
- Cancel running jobs

### Implementation Pattern

**Jenkins Tool** (mcp-server/src/tools/jenkins/trigger-deployment.ts):
```typescript
import Jenkins from 'jenkins';

export async function triggerDeployment(
  params: { tenant_ids: string[]; release_branch: string; target_environment: string },
  jenkinsClient: Jenkins
): Promise<{ job_ids: { tenant_id: string; queue_id: number }[] }> {
  const jobIds: { tenant_id: string; queue_id: number }[] = [];

  // Trigger jobs in parallel for all tenants
  await Promise.all(params.tenant_ids.map(async (tenantId) => {
    const jobName = getJobName(tenantId, params.target_environment); // e.g., "deploy-tenant-a-uat"

    const queueId = await jenkinsClient.job.build({
      name: jobName,
      parameters: {
        RELEASE_BRANCH: params.release_branch,
        ENVIRONMENT: params.target_environment,
        TENANT_ID: tenantId,
      },
    });

    jobIds.push({ tenant_id: tenantId, queue_id: queueId });
  }));

  return { job_ids: jobIds };
}

function getJobName(tenantId: string, environment: string): string {
  // Map tenant + environment to Jenkins job name
  // Read from tenant manifest config
  const manifest = loadTenantManifest();
  return manifest.tenants[tenantId].environments[environment].jenkins_job_name;
}
```

**Polling Job Status** (mcp-server/src/tools/jenkins/get-job-status.ts):
```typescript
export async function getJobStatus(
  params: { queue_ids: { tenant_id: string; queue_id: number }[] },
  jenkinsClient: Jenkins
): Promise<{ statuses: { tenant_id: string; status: string; duration_ms: number; error?: string }[] }> {
  const statuses = await Promise.all(params.queue_ids.map(async ({ tenant_id, queue_id }) => {
    try {
      // Get build number from queue
      const queueItem = await jenkinsClient.queue.item(queue_id);

      if (!queueItem.executable) {
        return { tenant_id, status: 'queued', duration_ms: 0 };
      }

      const buildNumber = queueItem.executable.number;
      const jobName = queueItem.task.name;

      // Get build status
      const build = await jenkinsClient.build.get(jobName, buildNumber);

      return {
        tenant_id,
        status: build.result ? build.result.toLowerCase() : 'running',
        duration_ms: build.duration,
        error: build.result === 'FAILURE' ? await getConsoleOutput(jenkinsClient, jobName, buildNumber) : undefined,
      };
    } catch (error) {
      return {
        tenant_id,
        status: 'error',
        duration_ms: 0,
        error: error.message,
      };
    }
  }));

  return { statuses };
}

async function getConsoleOutput(client: Jenkins, jobName: string, buildNumber: number): Promise<string> {
  const log = await client.build.log(jobName, buildNumber);
  // Extract last 50 lines of error logs
  return log.split('\n').slice(-50).join('\n');
}
```

### Circuit Breaker Pattern
```typescript
class JenkinsCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) { // 1 min cooldown
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN (Jenkins unavailable)');
      }
    }

    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= 3) {
      this.state = 'open';
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
}
```

### Alternatives Considered
- **Direct REST API calls via axios**: Rejected due to lack of type safety and crumb handling
- **jenkins-client (Python)**: Rejected because TypeScript chosen for implementation

### Best Practices
- Implement timeout for job polling (max 30 min per Constitution performance targets)
- Retry failed jobs once before marking as failed (FR-015)
- Log Jenkins job URLs in audit trail for debugging
- Implement circuit breaker for Jenkins API unavailability

### References
- `jenkins` npm package: https://www.npmjs.com/package/jenkins
- Jenkins REST API: https://www.jenkins.io/doc/book/using/remote-access-api/

---

## 9. JIRA REST API Integration

### Decision
Use `jira.js` npm package for JIRA REST API interactions with exponential backoff retry logic.

### Rationale
- **Modern API**: Supports JIRA Cloud and Server/Data Center
- **Type-safe**: Full TypeScript support
- **Comprehensive coverage**: Issue operations, JQL queries, transitions, comments
- **Active maintenance**: Regular updates for JIRA API changes

### jira.js Package
**Package**: `jira.js`
**Version**: 3.x

**Key Features**:
- JQL query execution
- Issue search and retrieval
- Issue transitions (status updates)
- Batch operations (up to 100 issues per request)

### Implementation Pattern

**Get Release Tickets** (mcp-server/src/tools/jira/get-release-tickets.ts):
```typescript
import { Version3Client } from 'jira.js';

export async function getReleaseTickets(
  params: { release_version: string },
  jiraClient: Version3Client
): Promise<{ tickets: { id: string; summary: string; pr_url: string; status: string }[] }> {
  const jql = `fixVersion = "${params.release_version}" AND status in ("Ready for Deployment", "Approved")`;

  const response = await jiraClient.issueSearch.searchForIssuesUsingJql({
    jql,
    fields: ['summary', 'status', 'customfield_10050'], // customfield_10050 = PR URL
    maxResults: 100,
  });

  return {
    tickets: response.issues.map(issue => ({
      id: issue.key,
      summary: issue.fields.summary,
      pr_url: issue.fields.customfield_10050,
      status: issue.fields.status.name,
    })),
  };
}
```

**Update Ticket Status** (mcp-server/src/tools/jira/update-ticket-status.ts):
```typescript
export async function updateTicketStatus(
  params: { ticket_ids: string[]; new_status: string; comment?: string },
  jiraClient: Version3Client
): Promise<{ updated: string[]; failed: { ticket_id: string; error: string }[] }> {
  const updated: string[] = [];
  const failed: { ticket_id: string; error: string }[] = [];

  // Batch update in chunks of 10 (to stay under API rate limits)
  const chunks = chunkArray(params.ticket_ids, 10);

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (ticketId) => {
      try {
        // Get available transitions for this issue
        const transitions = await jiraClient.issues.getTransitions({ issueIdOrKey: ticketId });
        const targetTransition = transitions.transitions.find(t => t.name === params.new_status);

        if (!targetTransition) {
          throw new Error(`Transition to "${params.new_status}" not available for ${ticketId}`);
        }

        // Execute transition
        await jiraClient.issues.doTransition({
          issueIdOrKey: ticketId,
          transition: {
            id: targetTransition.id,
          },
        });

        // Add comment if provided
        if (params.comment) {
          await jiraClient.issueComments.addComment({
            issueIdOrKey: ticketId,
            body: params.comment,
          });
        }

        updated.push(ticketId);
      } catch (error) {
        failed.push({ ticket_id: ticketId, error: error.message });
      }
    }));
  }

  return { updated, failed };
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
```

### Retry Logic with Exponential Backoff
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1 || !isRetryable(error)) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw new Error('Max retries exceeded');
}

function isRetryable(error: any): boolean {
  // Retry on network errors and 5xx server errors
  return error.status >= 500 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Alternatives Considered
- **`jira-client` (older package)**: Rejected due to lack of TypeScript support
- **Direct REST API calls**: Rejected due to complexity of authentication and pagination

### Best Practices
- Use JQL for efficient queries (avoid fetching all issues)
- Implement batching for status updates (max 10 concurrent requests)
- Cache JIRA field IDs (custom fields) to reduce API calls
- Log all JIRA operations in audit trail with ticket IDs

### References
- jira.js Documentation: https://github.com/MrRefactoring/jira.js
- JIRA REST API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/

---

## 10. Microsoft Teams Integration

### Decision
Use Microsoft Graph SDK (`@microsoft/microsoft-graph-client`) for Teams notifications with adaptive cards.

### Rationale
- **Official SDK**: Microsoft-maintained SDK with full Teams API support
- **Adaptive Cards**: Rich, interactive notifications with action buttons
- **Channel messaging**: Post to specific Teams channels with @mentions
- **DM support**: Send direct messages to PR owners for approval/conflict notifications

### Microsoft Graph SDK
**Package**: `@microsoft/microsoft-graph-client`
**Version**: 3.x

**Key Features**:
- Send channel messages
- Send direct messages to users
- @mention users in messages
- Attach adaptive cards
- OAuth 2.0 authentication

### Implementation Pattern

**Notify PR Owner** (mcp-server/src/tools/teams/notify-pr-owner.ts):
```typescript
import { Client } from '@microsoft/microsoft-graph-client';

export async function notifyPROwner(
  params: { pr_id: string; pr_owner_email: string; message_type: 'approval' | 'conflict'; details: any },
  graphClient: Client
): Promise<{ message_id: string; delivered: boolean }> {
  const user = await graphClient.api(`/users/${params.pr_owner_email}`).get();
  const chatId = await getOrCreateChat(graphClient, user.id);

  const adaptiveCard = generateAdaptiveCard(params.message_type, params.details);

  const message = {
    body: {
      contentType: 'html',
      content: generateMessageContent(params.message_type, params.details),
    },
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: adaptiveCard,
      },
    ],
  };

  const response = await graphClient.api(`/chats/${chatId}/messages`).post(message);

  return {
    message_id: response.id,
    delivered: true,
  };
}

function generateAdaptiveCard(messageType: 'approval' | 'conflict', details: any): any {
  if (messageType === 'approval') {
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: 'PR Approval Required',
          weight: 'Bolder',
          size: 'Medium',
        },
        {
          type: 'TextBlock',
          text: `Your PR #${details.pr_id} needs ${details.required_approvals - details.current_approvals} more approval(s).`,
          wrap: true,
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Current Approvals', value: details.current_approvals.toString() },
            { title: 'Required', value: details.required_approvals.toString() },
            { title: 'Potential Reviewers', value: details.potential_reviewers.join(', ') },
          ],
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'View PR',
          url: details.pr_url,
        },
      ],
    };
  } else { // conflict
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: 'Merge Conflict Detected',
          weight: 'Bolder',
          size: 'Medium',
          color: 'Attention',
        },
        {
          type: 'TextBlock',
          text: `Your PR #${details.pr_id} has merge conflicts that require manual resolution.`,
          wrap: true,
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Conflicted Files', value: details.conflicted_files.join('\n') },
          ],
        },
        {
          type: 'TextBlock',
          text: `**Suggested Resolution:**\n${details.resolution_suggestion}`,
          wrap: true,
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Resolve Conflict',
          url: details.pr_url,
        },
      ],
    };
  }
}
```

**Announce Deployment** (mcp-server/src/tools/teams/announce-deployment.ts):
```typescript
export async function announceDeployment(
  params: { release_version: string; target_environment: string; summary: any },
  graphClient: Client
): Promise<{ message_id: string; delivered: boolean }> {
  const channelId = process.env.TEAMS_DEPLOYMENT_CHANNEL_ID!;
  const teamId = process.env.TEAMS_TEAM_ID!;

  const adaptiveCard = {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `🚀 Deployment Complete: ${params.release_version} to ${params.target_environment}`,
        weight: 'Bolder',
        size: 'Large',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Environment', value: params.target_environment },
          { title: 'Release Version', value: params.release_version },
          { title: 'Tickets Deployed', value: params.summary.ticket_count.toString() },
          { title: 'Duration', value: `${params.summary.duration_minutes} minutes` },
          { title: 'Successful Tenants', value: params.summary.successful_tenants.join(', ') },
          { title: 'Failed Tenants', value: params.summary.failed_tenants.length > 0 ? params.summary.failed_tenants.join(', ') : 'None' },
          { title: 'Cache Clearing', value: `${params.summary.cache_cleared_count}/${params.summary.total_tenants} tenants` },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: process.env.DASHBOARD_URL,
      },
    ],
  };

  const message = {
    body: {
      contentType: 'html',
      content: `<at id="0">Release Team</at>: Deployment ${params.summary.failed_tenants.length === 0 ? 'succeeded' : 'completed with failures'}`,
    },
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: adaptiveCard,
      },
    ],
    mentions: [
      {
        id: 0,
        mentionText: 'Release Team',
        mentioned: {
          user: {
            displayName: 'Release Team',
            id: process.env.TEAMS_RELEASE_TEAM_ID,
          },
        },
      },
    ],
  };

  const response = await graphClient.api(`/teams/${teamId}/channels/${channelId}/messages`).post(message);

  return {
    message_id: response.id,
    delivered: true,
  };
}
```

### Authentication
Use Azure AD App Registration with delegated permissions:
- `Chat.ReadWrite` (for DMs)
- `ChannelMessage.Send` (for channel messages)
- `User.Read.All` (for looking up users by email)

### Alternatives Considered
- **Incoming Webhooks**: Rejected due to lack of adaptive card support and limited formatting
- **Teams Bot Framework**: Rejected due to complexity (not needed for one-way notifications)

### Best Practices
- Use adaptive cards for rich, interactive notifications
- Log all Teams message deliveries with timestamps in audit trail
- Implement retry logic for message delivery failures
- Cache user IDs to reduce Graph API lookups

### References
- Microsoft Graph SDK: https://github.com/microsoftgraph/msgraph-sdk-javascript
- Adaptive Cards: https://adaptivecards.io/
- Teams Messaging: https://docs.microsoft.com/en-us/graph/api/channel-post-messages

---

## Summary of Technology Decisions

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **MCP Server** | `@modelcontextprotocol/sdk` v1.0+ | Official TypeScript SDK, JSON-RPC protocol, schema validation |
| **Language** | TypeScript 5.3+ with Node.js 20.x LTS | MCP SDK-first, n8n native integration, rich ecosystem |
| **Git Integration** | `bitbucket` npm package (abstraction layer) | Initial Bitbucket support, future GitHub/GitLab via abstraction |
| **Secrets Management** | `@azure/keyvault-secrets` (abstraction layer) | Initial Azure Key Vault support, future Vault/AWS via abstraction |
| **Conflict Resolution** | LLM-based analysis (95% confidence threshold) | Context-aware semantic analysis beyond line-level diffs |
| **Orchestration** | n8n self-hosted | Visual workflow, state persistence, on-premises deployment |
| **Monitoring Dashboard** | React 18 + TypeScript + Material-UI + Socket.IO | Real-time updates, MCP client integration, component reusability |
| **Jenkins Integration** | `jenkins` npm package | Type-safe API, queue management, crumb authentication |
| **JIRA Integration** | `jira.js` v3.x | Modern API, TypeScript support, batch operations |
| **Teams Integration** | `@microsoft/microsoft-graph-client` v3.x | Official SDK, adaptive cards, channel and DM support |
| **Testing** | Jest (unit), Integration (staging), Contract (schemas), E2E (n8n) | Multi-layered approach for comprehensive coverage |

---

## Next Steps (Phase 1: Design & Contracts)

1. **Generate data-model.md**: Define entities (Release, Tenant, Deployment, etc.) with fields, relationships, validation rules
2. **Generate contracts/**: Create OpenAPI/GraphQL schemas for MCP tools, Git provider interface, Secrets provider interface
3. **Generate quickstart.md**: Document test scenarios for each user story with step-by-step validation
4. **Update agent context**: Run `.specify/scripts/bash/update-agent-context.sh claude` to add new technologies to context file

All research decisions documented above resolve "NEEDS CLARIFICATION" items and establish best practices for Phase 1 implementation.

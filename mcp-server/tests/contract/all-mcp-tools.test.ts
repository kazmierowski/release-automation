/**
 * Contract Tests: All MCP Tools (T027-T033)
 *
 * Comprehensive schema validation for all User Story 1 MCP tools
 */

import { describe, it, expect } from '@jest/globals';
import {
  MergeToDevInputSchema,
  MergeToDevOutputSchema,
} from '../../src/tools/git/merge-to-development.js';
import {
  CreateReleaseBranchInputSchema,
  CreateReleaseBranchOutputSchema,
} from '../../src/tools/git/create-release-branch.js';
import {
  TriggerDeploymentInputSchema,
  TriggerDeploymentOutputSchema,
} from '../../src/tools/jenkins/trigger-deployment.js';
import {
  GetJobStatusInputSchema,
  GetJobStatusOutputSchema,
} from '../../src/tools/jenkins/get-job-status.js';
import {
  UpdateTicketStatusInputSchema,
  UpdateTicketStatusOutputSchema,
} from '../../src/tools/jira/update-ticket-status.js';
import {
  AnnounceDeploymentInputSchema,
  AnnounceDeploymentOutputSchema,
} from '../../src/tools/teams/announce-deployment.js';
import {
  TriggerReleaseInputSchema,
  TriggerReleaseOutputSchema,
} from '../../src/tools/trigger-release-deployment.js';

describe('Contract: git_merge_tickets_to_development (T027)', () => {
  it('should accept valid input', () => {
    const input = {
      tickets: [
        {
          ticket_id: 'PROJ-123',
          pr_id: '456',
          squash_commit_message: '[PROJ-123] Fix authentication bug',
        },
      ],
      target_branch: 'development',
      auto_resolve_conflicts: false,
    };

    const result = MergeToDevInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      merged: [
        {
          ticket_id: 'PROJ-123',
          pr_id: '456',
          commit_sha: 'abc123',
        },
      ],
      conflicts: [],
      failed: [],
    };

    const result = MergeToDevOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('Contract: git_create_release_branch (T028)', () => {
  it('should accept valid input', () => {
    const input = {
      release_version: 'v1.2.0',
      release_type: 'regular' as const,
      source_branch: 'development',
    };

    const result = CreateReleaseBranchInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      branch_name: 'release/v1.2.0',
      commit_sha: 'abc123',
      created: true,
    };

    const result = CreateReleaseBranchOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('Contract: jenkins_trigger_deployment (T029)', () => {
  it('should accept valid input', () => {
    const input = {
      tenant_ids: ['tenant-a', 'tenant-b'],
      release_branch: 'release/v1.2.0',
      target_environment: 'Integration' as const,
      tenant_configurations: [
        {
          tenant_id: 'tenant-a',
          jenkins_job_name: 'deploy-tenant-a-integration',
        },
      ],
    };

    const result = TriggerDeploymentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      triggered: [
        {
          tenant_id: 'tenant-a',
          jenkins_queue_id: 12345,
          jenkins_job_name: 'deploy-tenant-a-integration',
        },
      ],
      failed: [],
    };

    const result = TriggerDeploymentOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('Contract: jenkins_get_job_status (T030)', () => {
  it('should accept valid input', () => {
    const input = {
      jobs: [
        {
          tenant_id: 'tenant-a',
          jenkins_queue_id: 12345,
          jenkins_job_name: 'deploy-tenant-a-integration',
        },
      ],
    };

    const result = GetJobStatusInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      statuses: [
        {
          tenant_id: 'tenant-a',
          status: 'success' as const,
          jenkins_build_number: 789,
          jenkins_job_url: 'http://jenkins.local/job/deploy/789',
          duration_ms: 300000,
          cache_clear_status: 'cleared' as const,
        },
      ],
    };

    const result = GetJobStatusOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('Contract: jira_update_ticket_status (T031)', () => {
  it('should accept valid input', () => {
    const input = {
      ticket_ids: ['PROJ-123', 'PROJ-124'],
      new_status: 'Deployed',
      comment: 'Deployed to Integration environment',
    };

    const result = UpdateTicketStatusInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      updated: ['PROJ-123', 'PROJ-124'],
      failed: [],
    };

    const result = UpdateTicketStatusOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('Contract: teams_announce_deployment (T032)', () => {
  it('should accept valid input', () => {
    const input = {
      release_version: 'v1.2.0',
      target_environment: 'Integration',
      summary: {
        ticket_count: 5,
        duration_minutes: 12,
        successful_tenants: ['tenant-a', 'tenant-b'],
        failed_tenants: [],
        cache_cleared_count: 2,
        total_tenants: 2,
      },
    };

    const result = AnnounceDeploymentInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      message_id: 'msg-12345',
      delivered: true,
      channel_id: 'channel-abc',
    };

    const result = AnnounceDeploymentOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('Contract: trigger_release_deployment (T033)', () => {
  it('should accept valid input', () => {
    const input = {
      release_version: 'v1.2.0',
      release_type: 'regular' as const,
      target_environment: 'Integration' as const,
      ticket_ids: ['PROJ-123', 'PROJ-124'],
      tenant_ids: ['tenant-a', 'tenant-b'],
      created_by: 'user@example.com',
    };

    const result = TriggerReleaseInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept valid output', () => {
    const output = {
      release_id: '550e8400-e29b-41d4-a716-446655440000',
      release_version: 'v1.2.0',
      release_type: 'regular',
      target_environment: 'Integration',
      ticket_ids: ['PROJ-123', 'PROJ-124'],
      tenant_ids: ['tenant-a', 'tenant-b'],
      validation: {
        valid: true,
        errors: [],
      },
      created_at: '2025-10-22T10:00:00Z',
    };

    const result = TriggerReleaseOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('should accept output with validation errors', () => {
    const output = {
      release_id: '',
      release_version: 'v1.2.0',
      release_type: 'regular',
      target_environment: 'PROD',
      ticket_ids: ['PROJ-123'],
      tenant_ids: ['tenant-a'],
      validation: {
        valid: false,
        errors: ['Regular releases are not allowed for PROD environment'],
      },
      created_at: '2025-10-22T10:00:00Z',
    };

    const result = TriggerReleaseOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

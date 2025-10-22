/**
 * Git Create Release Branch MCP Tool
 *
 * T046: Implement git_create_release_branch MCP tool
 *
 * Creates release branch from development with full history preservation.
 * Follows GitFlow naming: release/vX.Y.Z or hotfix/vX.Y.Z
 * Enforces Constitution II: full history for development→release (no squash)
 */

import { IGitProvider } from '../../providers/git/base.js';
import { ReleaseType } from '../../types/entities.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { AuditEventModel } from '../../models/audit-event.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * Input schema for git_create_release_branch tool
 */
export const CreateReleaseBranchInputSchema = z.object({
  release_version: z.string().describe('Release version (e.g., "v1.2.0" or "hotfix/v1.1.1")'),
  release_type: z.enum(['regular', 'hotfix']).describe('Release type'),
  source_branch: z.string().optional().default('development').describe('Source branch name'),
});

export type CreateReleaseBranchInput = z.infer<typeof CreateReleaseBranchInputSchema>;

/**
 * Output schema for git_create_release_branch tool
 */
export const CreateReleaseBranchOutputSchema = z.object({
  branch_name: z.string(),
  commit_sha: z.string(),
  created: z.boolean(),
});

export type CreateReleaseBranchOutput = z.infer<typeof CreateReleaseBranchOutputSchema>;

/**
 * Create release branch
 */
export async function createReleaseBranch(
  input: CreateReleaseBranchInput,
  gitProvider: IGitProvider,
  releaseId?: string
): Promise<CreateReleaseBranchOutput> {
  const startTime = Date.now();
  const actor = 'system';

  try {
    // Determine branch name based on release type
    const branchName = input.release_type === 'hotfix'
      ? input.release_version // hotfix/vX.Y.Z (already includes prefix)
      : `release/${input.release_version}`; // release/vX.Y.Z

    logger.info('Creating release branch', {
      branch_name: branchName,
      release_type: input.release_type,
      source_branch: input.source_branch,
    });

    // Create branch from source with full history (no squash)
    const branchInfo = await gitProvider.createBranch(branchName, input.source_branch);

    const output: CreateReleaseBranchOutput = {
      branch_name: branchInfo.name,
      commit_sha: branchInfo.commitSha,
      created: true,
    };

    // Log audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.create({
        release_id: releaseId,
        event_type: 'branch_created',
        actor,
        action: `Created release branch ${branchName} from ${input.source_branch}`,
        resource_type: 'branch',
        resource_id: branchName,
        details: {
          branch_name: branchName,
          release_type: input.release_type,
          source_branch: input.source_branch,
          commit_sha: branchInfo.commitSha,
          duration_ms: Date.now() - startTime,
        },
        status: 'success',
      });
      await auditLogger.log(auditEvent);
    }

    logger.info('Release branch created successfully', {
      branch_name: branchName,
      commit_sha: branchInfo.commitSha,
      duration_ms: Date.now() - startTime,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create release branch', {
      error: errorMessage,
      release_version: input.release_version,
    });

    // Log failure audit event
    if (releaseId) {
      const auditLogger = await getAuditLogger();
      const auditEvent = AuditEventModel.create({
        release_id: releaseId,
        event_type: 'branch_created',
        actor,
        action: `Failed to create release branch for ${input.release_version}`,
        resource_type: 'branch',
        resource_id: input.release_version,
        details: {
          release_version: input.release_version,
          release_type: input.release_type,
          source_branch: input.source_branch,
          duration_ms: Date.now() - startTime,
        },
        status: 'failure',
        error_message: errorMessage,
      });
      await auditLogger.log(auditEvent);
    }

    throw error;
  }
}

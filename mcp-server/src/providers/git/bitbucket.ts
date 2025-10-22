import { Bitbucket } from 'bitbucket';
import { logger } from '../../utils/logger.js';
import { retry, GIT_RETRY_OPTIONS } from '../../utils/retry.js';
import {
  IGitProvider,
  PullRequestApproval,
  MergeResult,
  BranchResult,
  ConflictDetectionResult,
  PullRequest,
  SuggestedReviewer,
  PRNotApprovedError,
  MergeConflictError,
  BranchExistsError,
  GitProviderError,
} from './base.js';

/**
 * Bitbucket-specific configuration
 */
export interface BitbucketConfig {
  baseUrl: string;
  workspace: string;
  auth: {
    username?: string;
    password?: string;
    token?: string;
  };
}

/**
 * Bitbucket Git provider implementation
 *
 * Implements GitFlow operations using Bitbucket Cloud REST API 2.0
 *
 * API Documentation:
 * https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/
 */
export class BitbucketProvider implements IGitProvider {
  readonly platform = 'bitbucket' as const;
  private client: any; // Bitbucket client instance
  private workspace: string;

  constructor(config: BitbucketConfig) {
    this.workspace = config.workspace;

    // Initialize Bitbucket client
    this.client = new Bitbucket({
      baseUrl: config.baseUrl,
      auth: config.auth.token
        ? { token: config.auth.token }
        : {
            username: config.auth.username || '',
            password: config.auth.password || '',
          },
    });

    logger.info('Bitbucket provider initialized', {
      workspace: this.workspace,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Check if PR has minimum required approvals
   */
  async checkPRApprovals(
    repository: string,
    prId: string,
    minApprovals: number = 2
  ): Promise<PullRequestApproval> {
    const operation = async (): Promise<PullRequestApproval> => {
      try {
        logger.debug(`Checking PR approvals: ${repository}#${prId}`);

        const [workspace, repoSlug] = this.parseRepository(repository);

        // Get PR details
        const prResponse = await this.client.pullrequests.get({
          workspace,
          repo_slug: repoSlug,
          pull_request_id: parseInt(prId, 10),
        });

        const pr = prResponse.data;

        // Get PR participants (includes reviewers and approvals)
        const participantsResponse = await this.client.pullrequests.listParticipants({
          workspace,
          repo_slug: repoSlug,
          pull_request_id: parseInt(prId, 10),
        });

        const participants = participantsResponse.data.values || [];

        // Extract approvals
        const approvals = participants
          .filter((p: any) => p.approved === true)
          .map((p: any) => ({
            reviewer: p.user?.display_name || p.user?.username || 'Unknown',
            reviewer_email: p.user?.email || '',
            approved_at: p.approved_date || new Date().toISOString(),
          }));

        // Check for blocking reviewers (requested changes)
        const blockingReviewers = participants
          .filter((p: any) => p.state === 'changes_requested')
          .map((p: any) => p.user?.display_name || p.user?.username);

        const approvalCount = approvals.length;
        const isApproved = approvalCount >= minApprovals && blockingReviewers.length === 0;

        const result: PullRequestApproval = {
          pr_id: prId,
          pr_url: pr.links?.html?.href || '',
          approvals,
          approval_count: approvalCount,
          min_required: minApprovals,
          is_approved: isApproved,
          blocking_reviewers: blockingReviewers.length > 0 ? blockingReviewers : undefined,
        };

        logger.info(`PR ${prId} approval status: ${approvalCount}/${minApprovals}`, {
          is_approved: isApproved,
          blocking_reviewers: blockingReviewers,
        });

        // Throw error if not approved (for workflow control)
        if (!isApproved) {
          throw new PRNotApprovedError(
            prId,
            approvalCount,
            minApprovals,
            this.platform
          );
        }

        return result;
      } catch (error) {
        if (error instanceof PRNotApprovedError) {
          throw error;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to check PR approvals: ${message}`);
        throw new GitProviderError(
          `Failed to check PR approvals: ${message}`,
          this.platform,
          'checkPRApprovals',
          true // Retryable
        );
      }
    };

    return retry(operation, {
      ...GIT_RETRY_OPTIONS,
      isRetryable: (error) =>
        !(error instanceof PRNotApprovedError) &&
        GIT_RETRY_OPTIONS.isRetryable?.(error) === true,
    });
  }

  /**
   * Merge pull request with specified strategy
   */
  async mergePR(
    repository: string,
    prId: string,
    strategy: 'squash' | 'merge',
    commitMessage: string
  ): Promise<MergeResult> {
    const operation = async (): Promise<MergeResult> => {
      try {
        logger.debug(`Merging PR ${prId} with strategy: ${strategy}`);

        const [workspace, repoSlug] = this.parseRepository(repository);

        // Get PR details first
        const prResponse = await this.client.pullrequests.get({
          workspace,
          repo_slug: repoSlug,
          pull_request_id: parseInt(prId, 10),
        });

        const pr = prResponse.data;

        // Check for conflicts
        const conflictResult = await this.detectConflicts(
          repository,
          pr.source?.branch?.name || '',
          pr.destination?.branch?.name || ''
        );

        if (conflictResult.has_conflicts) {
          throw new MergeConflictError(
            prId,
            conflictResult.conflicted_files,
            this.platform
          );
        }

        // Merge PR
        const mergeResponse = await this.client.pullrequests.merge({
          workspace,
          repo_slug: repoSlug,
          pull_request_id: parseInt(prId, 10),
          _body: {
            type: 'pullrequest_merge',
            message: commitMessage,
            close_source_branch: true,
            merge_strategy: strategy === 'squash' ? 'squash' : 'merge_commit',
          },
        });

        const mergedPr = mergeResponse.data;

        const result: MergeResult = {
          success: true,
          merge_commit: mergedPr.merge_commit?.hash || '',
          merged_at: mergedPr.updated_on || new Date().toISOString(),
          source_branch: pr.source?.branch?.name || '',
          target_branch: pr.destination?.branch?.name || '',
          strategy,
        };

        logger.info(`Successfully merged PR ${prId}`, {
          merge_commit: result.merge_commit,
          strategy,
        });

        return result;
      } catch (error) {
        if (error instanceof MergeConflictError) {
          throw error;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to merge PR ${prId}: ${message}`);

        return {
          success: false,
          merge_commit: '',
          merged_at: '',
          source_branch: '',
          target_branch: '',
          strategy,
          error: message,
        };
      }
    };

    return retry(operation, {
      ...GIT_RETRY_OPTIONS,
      isRetryable: (error) =>
        !(error instanceof MergeConflictError) &&
        GIT_RETRY_OPTIONS.isRetryable?.(error) === true,
    });
  }

  /**
   * Create new branch from source
   */
  async createBranch(
    repository: string,
    branchName: string,
    sourceBranch: string = 'development'
  ): Promise<BranchResult> {
    const operation = async (): Promise<BranchResult> => {
      try {
        logger.debug(`Creating branch ${branchName} from ${sourceBranch}`);

        const [workspace, repoSlug] = this.parseRepository(repository);

        // Get source branch commit
        const branchResponse = await this.client.repositories.getBranch({
          workspace,
          repo_slug: repoSlug,
          name: sourceBranch,
        });

        const sourceCommitSha = branchResponse.data.target?.hash;

        if (!sourceCommitSha) {
          throw new Error(`Source branch ${sourceBranch} has no commit hash`);
        }

        // Create new branch
        const createResponse = await this.client.repositories.createBranch({
          workspace,
          repo_slug: repoSlug,
          _body: {
            name: branchName,
            target: {
              hash: sourceCommitSha,
            },
          },
        });

        const newBranch = createResponse.data;

        const result: BranchResult = {
          success: true,
          branch_name: branchName,
          commit_sha: newBranch.target?.hash || sourceCommitSha,
          created_at: new Date().toISOString(),
          source_branch: sourceBranch,
        };

        logger.info(`Successfully created branch ${branchName}`, {
          commit_sha: result.commit_sha,
        });

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check if branch already exists
        if (message.includes('already exists') || message.includes('409')) {
          throw new BranchExistsError(branchName, this.platform);
        }

        logger.error(`Failed to create branch ${branchName}: ${message}`);

        return {
          success: false,
          branch_name: branchName,
          commit_sha: '',
          created_at: '',
          source_branch: sourceBranch,
          error: message,
        };
      }
    };

    return retry(operation, {
      ...GIT_RETRY_OPTIONS,
      isRetryable: (error) =>
        !(error instanceof BranchExistsError) &&
        GIT_RETRY_OPTIONS.isRetryable?.(error) === true,
    });
  }

  /**
   * Detect merge conflicts between branches
   */
  async detectConflicts(
    repository: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<ConflictDetectionResult> {
    const operation = async (): Promise<ConflictDetectionResult> => {
      try {
        logger.debug(
          `Detecting conflicts: ${sourceBranch} -> ${targetBranch}`
        );

        const [workspace, repoSlug] = this.parseRepository(repository);

        // Get diff between branches (for future conflict analysis)
        await this.client.repositories.getDiff({
          workspace,
          repo_slug: repoSlug,
          spec: `${targetBranch}..${sourceBranch}`,
        });

        // Note: Bitbucket API doesn't provide direct conflict detection
        // This is a simplified implementation - in production, you'd need to:
        // 1. Create a temporary merge commit
        // 2. Check for conflicts in the merge
        // 3. Parse conflict markers

        // For now, return no conflicts (optimistic)
        // Real implementation would analyze diff and detect conflicts
        const result: ConflictDetectionResult = {
          has_conflicts: false,
          conflicts: [],
          conflicted_files: [],
          conflict_count: 0,
          auto_resolvable: true,
          confidence_score: 100,
        };

        logger.debug('Conflict detection complete', result);

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to detect conflicts: ${message}`);

        throw new GitProviderError(
          `Failed to detect conflicts: ${message}`,
          this.platform,
          'detectConflicts',
          true
        );
      }
    };

    return retry(operation, GIT_RETRY_OPTIONS);
  }

  /**
   * Get pull request details
   */
  async getPullRequest(repository: string, prId: string): Promise<PullRequest> {
    const operation = async (): Promise<PullRequest> => {
      try {
        const [workspace, repoSlug] = this.parseRepository(repository);

        const response = await this.client.pullrequests.get({
          workspace,
          repo_slug: repoSlug,
          pull_request_id: parseInt(prId, 10),
        });

        const pr = response.data;

        return {
          id: prId,
          title: pr.title || '',
          description: pr.description || '',
          source_branch: pr.source?.branch?.name || '',
          target_branch: pr.destination?.branch?.name || '',
          author: pr.author?.display_name || pr.author?.username || '',
          author_email: pr.author?.email || '',
          state: this.mapPRState(pr.state),
          created_at: pr.created_on || '',
          updated_at: pr.updated_on || '',
          merge_commit: pr.merge_commit?.hash,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new GitProviderError(
          `Failed to get PR details: ${message}`,
          this.platform,
          'getPullRequest',
          true
        );
      }
    };

    return retry(operation, GIT_RETRY_OPTIONS);
  }

  /**
   * Suggest reviewers based on file changes
   */
  async suggestReviewers(
    _repository: string,
    _sourceBranch: string,
    _targetBranch: string
  ): Promise<SuggestedReviewer[]> {
    // Bitbucket doesn't have built-in reviewer suggestion API
    // This would require additional implementation:
    // 1. Analyze changed files
    // 2. Look at file history to find frequent contributors
    // 3. Check CODEOWNERS file if exists
    // 4. Return suggested reviewers

    logger.debug('Reviewer suggestion not implemented for Bitbucket');
    return [];
  }

  /**
   * Parse repository identifier into workspace and repo slug
   *
   * @param repository - Repository identifier (format: "workspace/repo")
   * @returns [workspace, repoSlug]
   */
  private parseRepository(repository: string): [string, string] {
    const parts = repository.split('/');

    if (parts.length === 2) {
      return [parts[0], parts[1]];
    }

    // If only repo slug provided, use configured workspace
    return [this.workspace, repository];
  }

  /**
   * Map Bitbucket PR state to standard state
   */
  private mapPRState(
    state?: string
  ): 'open' | 'merged' | 'declined' | 'superseded' {
    switch (state?.toLowerCase()) {
      case 'merged':
        return 'merged';
      case 'declined':
        return 'declined';
      case 'superseded':
        return 'superseded';
      default:
        return 'open';
    }
  }
}

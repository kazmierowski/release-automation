/**
 * Git Provider Abstraction Layer
 *
 * Provides platform-agnostic interface for Git operations across:
 * - Bitbucket (initial implementation)
 * - GitHub (future)
 * - GitLab (future)
 *
 * All implementations must support GitFlow operations with:
 * - PR approval checks (min 2 approvals)
 * - Squash merge for feature→development
 * - Full history merge for development→release
 * - Conflict detection and analysis
 */

/**
 * Pull Request information
 */
export interface PullRequest {
  id: string;
  title: string;
  description?: string;
  source_branch: string;
  target_branch: string;
  author: string;
  author_email: string;
  state: 'open' | 'merged' | 'declined' | 'superseded';
  created_at: string;
  updated_at: string;
  merge_commit?: string;
}

/**
 * PR approval information
 */
export interface PullRequestApproval {
  pr_id: string;
  pr_url: string;
  approvals: Array<{
    reviewer: string;
    reviewer_email: string;
    approved_at: string;
  }>;
  approval_count: number;
  min_required: number;
  is_approved: boolean;
  blocking_reviewers?: string[]; // Reviewers who requested changes
}

/**
 * Merge conflict information
 */
export interface MergeConflict {
  file_path: string;
  conflict_type: 'content' | 'delete-modify' | 'rename' | 'binary';
  base_content?: string;
  source_content?: string;
  target_content?: string;
}

/**
 * Conflict detection result
 */
export interface ConflictDetectionResult {
  has_conflicts: boolean;
  conflicts: MergeConflict[];
  conflicted_files: string[];
  conflict_count: number;
  auto_resolvable: boolean;
  confidence_score?: number; // 0-100, only if auto_resolvable
}

/**
 * Merge operation result
 */
export interface MergeResult {
  success: boolean;
  merge_commit: string;
  merged_at: string;
  source_branch: string;
  target_branch: string;
  strategy: 'squash' | 'merge' | 'rebase';
  error?: string;
}

/**
 * Branch creation result
 */
export interface BranchResult {
  success: boolean;
  branch_name: string;
  commit_sha: string;
  created_at: string;
  source_branch: string;
  error?: string;
}

/**
 * Suggested reviewer information
 */
export interface SuggestedReviewer {
  username: string;
  email: string;
  reason: string; // e.g., "Modified files in this PR", "Code owner"
  relevance_score: number; // 0-100
}

/**
 * Abstract Git provider interface
 *
 * All Git platform implementations must implement this interface
 */
export interface IGitProvider {
  /**
   * Platform identifier
   */
  readonly platform: 'bitbucket' | 'github' | 'gitlab';

  /**
   * Check if PR has minimum required approvals
   *
   * @param repository - Repository identifier (e.g., 'workspace/repo')
   * @param prId - Pull request ID
   * @param minApprovals - Minimum required approvals (default: 2)
   * @returns {Promise<PullRequestApproval>} Approval status
   * @throws {Error} If PR not found or API error
   */
  checkPRApprovals(
    repository: string,
    prId: string,
    minApprovals?: number
  ): Promise<PullRequestApproval>;

  /**
   * Merge pull request with specified strategy
   *
   * Constitution II compliance:
   * - Feature→development: MUST use squash strategy
   * - Development→release: MUST use merge strategy (full history)
   *
   * @param repository - Repository identifier
   * @param prId - Pull request ID
   * @param strategy - Merge strategy ('squash' | 'merge')
   * @param commitMessage - Commit message (for squash: "[TICKET-ID] Summary")
   * @returns {Promise<MergeResult>} Merge operation result
   * @throws {Error} If merge fails or PR not approved
   */
  mergePR(
    repository: string,
    prId: string,
    strategy: 'squash' | 'merge',
    commitMessage: string
  ): Promise<MergeResult>;

  /**
   * Create new branch from source
   *
   * @param repository - Repository identifier
   * @param branchName - New branch name (e.g., 'release/v1.2.0')
   * @param sourceBranch - Source branch to branch from (default: 'development')
   * @returns {Promise<BranchResult>} Branch creation result
   * @throws {Error} If branch exists or source branch not found
   */
  createBranch(
    repository: string,
    branchName: string,
    sourceBranch?: string
  ): Promise<BranchResult>;

  /**
   * Detect merge conflicts between branches
   *
   * @param repository - Repository identifier
   * @param sourceBranch - Source branch to merge from
   * @param targetBranch - Target branch to merge into
   * @returns {Promise<ConflictDetectionResult>} Conflict detection result
   * @throws {Error} If branches not found or API error
   */
  detectConflicts(
    repository: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<ConflictDetectionResult>;

  /**
   * Get pull request details
   *
   * @param repository - Repository identifier
   * @param prId - Pull request ID
   * @returns {Promise<PullRequest>} Pull request details
   * @throws {Error} If PR not found
   */
  getPullRequest(repository: string, prId: string): Promise<PullRequest>;

  /**
   * Suggest reviewers for PR based on file changes and code ownership
   *
   * @param repository - Repository identifier
   * @param sourceBranch - Source branch
   * @param targetBranch - Target branch
   * @returns {Promise<SuggestedReviewer[]>} List of suggested reviewers
   */
  suggestReviewers(
    repository: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<SuggestedReviewer[]>;
}

/**
 * Base error class for Git provider operations
 */
export class GitProviderError extends Error {
  constructor(
    message: string,
    public readonly platform: string,
    public readonly operation: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'GitProviderError';
  }
}

/**
 * PR not approved error
 */
export class PRNotApprovedError extends GitProviderError {
  constructor(
    public readonly prId: string,
    public readonly currentApprovals: number,
    public readonly requiredApprovals: number,
    platform: string
  ) {
    super(
      `PR ${prId} has ${currentApprovals} approvals but requires ${requiredApprovals}`,
      platform,
      'checkPRApprovals',
      false // Not retryable - requires manual approval
    );
    this.name = 'PRNotApprovedError';
  }
}

/**
 * Merge conflict error
 */
export class MergeConflictError extends GitProviderError {
  constructor(
    public readonly prId: string,
    public readonly conflictedFiles: string[],
    platform: string
  ) {
    super(
      `PR ${prId} has merge conflicts in ${conflictedFiles.length} file(s)`,
      platform,
      'mergePR',
      false // Not retryable - requires manual resolution
    );
    this.name = 'MergeConflictError';
  }
}

/**
 * Branch already exists error
 */
export class BranchExistsError extends GitProviderError {
  constructor(public readonly branchName: string, platform: string) {
    super(
      `Branch ${branchName} already exists`,
      platform,
      'createBranch',
      false // Not retryable - branch exists
    );
    this.name = 'BranchExistsError';
  }
}

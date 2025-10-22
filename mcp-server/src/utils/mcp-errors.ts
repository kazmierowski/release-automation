/**
 * MCP Error Response Builder
 *
 * Creates structured error responses for MCP tool failures with:
 * - Standardized error codes
 * - Actionable error messages
 * - Retry ability flags
 * - HTTP status code equivalents
 */

import { logger } from './logger.js';

/**
 * MCP error response structure
 */
export interface MCPErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    http_status: number;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

/**
 * Error code catalog with descriptions and retry flags
 */
export const ERROR_CODES = {
  // PR Approval Errors (1xx)
  ERR_PR_NOT_APPROVED: {
    code: 'ERR_PR_NOT_APPROVED',
    message: 'Pull request does not have minimum required approvals',
    retryable: false,
    http_status: 403,
  },
  ERR_PR_NOT_FOUND: {
    code: 'ERR_PR_NOT_FOUND',
    message: 'Pull request not found',
    retryable: false,
    http_status: 404,
  },
  ERR_PR_BLOCKED: {
    code: 'ERR_PR_BLOCKED',
    message: 'Pull request has requested changes',
    retryable: false,
    http_status: 403,
  },

  // Merge Errors (2xx)
  ERR_MERGE_CONFLICT: {
    code: 'ERR_MERGE_CONFLICT',
    message: 'Merge conflicts detected - requires manual resolution',
    retryable: false,
    http_status: 409,
  },
  ERR_MERGE_FAILED: {
    code: 'ERR_MERGE_FAILED',
    message: 'Merge operation failed',
    retryable: true,
    http_status: 500,
  },
  ERR_INVALID_MERGE_STRATEGY: {
    code: 'ERR_INVALID_MERGE_STRATEGY',
    message: 'Invalid merge strategy - must be "squash" or "merge"',
    retryable: false,
    http_status: 400,
  },

  // Branch Errors (3xx)
  ERR_BRANCH_EXISTS: {
    code: 'ERR_BRANCH_EXISTS',
    message: 'Branch already exists',
    retryable: false,
    http_status: 409,
  },
  ERR_BRANCH_NOT_FOUND: {
    code: 'ERR_BRANCH_NOT_FOUND',
    message: 'Source branch not found',
    retryable: false,
    http_status: 404,
  },
  ERR_BRANCH_CREATION_FAILED: {
    code: 'ERR_BRANCH_CREATION_FAILED',
    message: 'Failed to create branch',
    retryable: true,
    http_status: 500,
  },

  // Jenkins Errors (4xx)
  ERR_JENKINS_TRIGGER_FAILED: {
    code: 'ERR_JENKINS_TRIGGER_FAILED',
    message: 'Failed to trigger Jenkins deployment job',
    retryable: true,
    http_status: 500,
  },
  ERR_JENKINS_JOB_NOT_FOUND: {
    code: 'ERR_JENKINS_JOB_NOT_FOUND',
    message: 'Jenkins job not found',
    retryable: false,
    http_status: 404,
  },
  ERR_JENKINS_BUILD_FAILED: {
    code: 'ERR_JENKINS_BUILD_FAILED',
    message: 'Jenkins build failed',
    retryable: false,
    http_status: 500,
  },
  ERR_JENKINS_TIMEOUT: {
    code: 'ERR_JENKINS_TIMEOUT',
    message: 'Jenkins job execution timed out',
    retryable: false,
    http_status: 504,
  },

  // JIRA Errors (5xx)
  ERR_JIRA_TICKETS_NOT_FOUND: {
    code: 'ERR_JIRA_TICKETS_NOT_FOUND',
    message: 'No JIRA tickets found for release version',
    retryable: false,
    http_status: 404,
  },
  ERR_JIRA_UPDATE_FAILED: {
    code: 'ERR_JIRA_UPDATE_FAILED',
    message: 'Failed to update JIRA ticket status',
    retryable: true,
    http_status: 500,
  },
  ERR_JIRA_API_ERROR: {
    code: 'ERR_JIRA_API_ERROR',
    message: 'JIRA API error',
    retryable: true,
    http_status: 500,
  },

  // Teams Errors (6xx)
  ERR_TEAMS_NOTIFICATION_FAILED: {
    code: 'ERR_TEAMS_NOTIFICATION_FAILED',
    message: 'Failed to send Teams notification',
    retryable: true,
    http_status: 500,
  },
  ERR_TEAMS_USER_NOT_FOUND: {
    code: 'ERR_TEAMS_USER_NOT_FOUND',
    message: 'Teams user not found',
    retryable: false,
    http_status: 404,
  },
  ERR_TEAMS_CHANNEL_NOT_FOUND: {
    code: 'ERR_TEAMS_CHANNEL_NOT_FOUND',
    message: 'Teams channel not found',
    retryable: false,
    http_status: 404,
  },

  // Environment/Tenant Errors (7xx)
  ERR_INVALID_ENVIRONMENT: {
    code: 'ERR_INVALID_ENVIRONMENT',
    message: 'Invalid target environment',
    retryable: false,
    http_status: 400,
  },
  ERR_TENANT_NOT_FOUND: {
    code: 'ERR_TENANT_NOT_FOUND',
    message: 'Tenant not found in manifest',
    retryable: false,
    http_status: 404,
  },
  ERR_TENANT_INACTIVE: {
    code: 'ERR_TENANT_INACTIVE',
    message: 'Tenant is not active for deployments',
    retryable: false,
    http_status: 403,
  },
  ERR_ENV_RELEASE_TYPE_MISMATCH: {
    code: 'ERR_ENV_RELEASE_TYPE_MISMATCH',
    message: 'Release type not allowed for target environment',
    retryable: false,
    http_status: 403,
  },

  // Validation Errors (8xx)
  ERR_INVALID_INPUT: {
    code: 'ERR_INVALID_INPUT',
    message: 'Invalid input parameters',
    retryable: false,
    http_status: 400,
  },
  ERR_MISSING_REQUIRED_FIELD: {
    code: 'ERR_MISSING_REQUIRED_FIELD',
    message: 'Missing required field',
    retryable: false,
    http_status: 400,
  },
  ERR_VALIDATION_FAILED: {
    code: 'ERR_VALIDATION_FAILED',
    message: 'Input validation failed',
    retryable: false,
    http_status: 400,
  },

  // Workflow Errors (9xx)
  ERR_WORKFLOW_PHASE_FAILED: {
    code: 'ERR_WORKFLOW_PHASE_FAILED',
    message: 'Workflow phase execution failed',
    retryable: false,
    http_status: 500,
  },
  ERR_WORKFLOW_TIMEOUT: {
    code: 'ERR_WORKFLOW_TIMEOUT',
    message: 'Workflow execution timed out',
    retryable: false,
    http_status: 504,
  },

  // Generic Errors (10xx)
  ERR_INTERNAL_SERVER_ERROR: {
    code: 'ERR_INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    retryable: true,
    http_status: 500,
  },
  ERR_SERVICE_UNAVAILABLE: {
    code: 'ERR_SERVICE_UNAVAILABLE',
    message: 'External service temporarily unavailable',
    retryable: true,
    http_status: 503,
  },
  ERR_TIMEOUT: {
    code: 'ERR_TIMEOUT',
    message: 'Operation timed out',
    retryable: true,
    http_status: 504,
  },
  ERR_RATE_LIMITED: {
    code: 'ERR_RATE_LIMITED',
    message: 'Rate limit exceeded',
    retryable: true,
    http_status: 429,
  },
} as const;

/**
 * Build structured MCP error response
 *
 * @param errorCode - Error code from ERROR_CODES catalog
 * @param customMessage - Optional custom message to override default
 * @param details - Additional error details (sanitized automatically)
 * @returns {MCPErrorResponse} Structured error response
 */
export function buildMCPError(
  errorCode: keyof typeof ERROR_CODES,
  customMessage?: string,
  details?: Record<string, unknown>
): MCPErrorResponse {
  const errorDef = ERROR_CODES[errorCode];

  const errorResponse: MCPErrorResponse = {
    error: {
      code: errorDef.code,
      message: customMessage || errorDef.message,
      retryable: errorDef.retryable,
      http_status: errorDef.http_status,
      details,
      timestamp: new Date().toISOString(),
    },
  };

  // Log error for audit trail
  logger.error(`MCP Error: ${errorDef.code}`, {
    code: errorDef.code,
    message: errorResponse.error.message,
    retryable: errorDef.retryable,
    details,
  });

  return errorResponse;
}

/**
 * Build error response from caught exception
 *
 * Automatically maps common error patterns to appropriate error codes
 *
 * @param error - Caught error object
 * @param context - Additional context (tool name, operation)
 * @returns {MCPErrorResponse} Structured error response
 */
export function buildErrorFromException(
  error: Error | unknown,
  context?: { tool?: string; operation?: string }
): MCPErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'UnknownError';

  // Map error patterns to error codes
  let errorCode: keyof typeof ERROR_CODES = 'ERR_INTERNAL_SERVER_ERROR';

  if (errorName === 'PRNotApprovedError') {
    errorCode = 'ERR_PR_NOT_APPROVED';
  } else if (errorName === 'MergeConflictError') {
    errorCode = 'ERR_MERGE_CONFLICT';
  } else if (errorName === 'BranchExistsError') {
    errorCode = 'ERR_BRANCH_EXISTS';
  } else if (errorName === 'SecretNotFoundError') {
    errorCode = 'ERR_INTERNAL_SERVER_ERROR'; // Don't expose secret details
  } else if (errorName === 'AccessDeniedError') {
    errorCode = 'ERR_INTERNAL_SERVER_ERROR'; // Don't expose permission details
  } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    errorCode = 'ERR_TIMEOUT';
  } else if (errorMessage.includes('rate limit')) {
    errorCode = 'ERR_RATE_LIMITED';
  } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    if (context?.operation?.includes('jenkins')) {
      errorCode = 'ERR_JENKINS_JOB_NOT_FOUND';
    } else if (context?.operation?.includes('jira')) {
      errorCode = 'ERR_JIRA_TICKETS_NOT_FOUND';
    } else {
      errorCode = 'ERR_INTERNAL_SERVER_ERROR';
    }
  } else if (errorMessage.includes('validation')) {
    errorCode = 'ERR_VALIDATION_FAILED';
  }

  return buildMCPError(errorCode, errorMessage, {
    originalError: errorName,
    ...context,
  });
}

/**
 * Extract actionable guidance from error code
 *
 * Provides user-friendly guidance on how to resolve the error
 *
 * @param errorCode - Error code from ERROR_CODES catalog
 * @returns Actionable guidance string
 */
export function getErrorGuidance(errorCode: keyof typeof ERROR_CODES): string {
  const guidance: Record<string, string> = {
    ERR_PR_NOT_APPROVED:
      'Ensure pull request has minimum required approvals (default: 2). Request reviews from team members.',
    ERR_MERGE_CONFLICT:
      'Manually resolve merge conflicts in the pull request and push updated code.',
    ERR_BRANCH_EXISTS:
      'Branch already exists. Use a different version number or delete the existing branch if safe.',
    ERR_JENKINS_JOB_NOT_FOUND:
      'Verify Jenkins job name in tenant manifest configuration. Check tenants.yaml for correct job mapping.',
    ERR_JIRA_TICKETS_NOT_FOUND:
      'No JIRA tickets tagged with this release version. Add "Fix Version" field to tickets.',
    ERR_ENV_RELEASE_TYPE_MISMATCH:
      'Regular releases cannot deploy to PROD. Use hotfix release type for PROD deployments (Constitution II).',
    ERR_TENANT_INACTIVE:
      'Tenant is marked inactive in manifest. Update tenants.yaml to set active: true.',
    ERR_INVALID_INPUT:
      'Check input parameters against MCP tool schema. Refer to mcp-tools.json for valid schema.',
  };

  return guidance[errorCode] || 'Review error details and retry if retryable flag is true.';
}

/**
 * Check if error is retryable
 *
 * @param errorResponse - MCP error response
 * @returns True if error can be retried
 */
export function isRetryableError(errorResponse: MCPErrorResponse): boolean {
  return errorResponse.error.retryable;
}

/**
 * Format error for Teams notification
 *
 * Creates user-friendly error message for Teams channels
 *
 * @param errorResponse - MCP error response
 * @param releaseVersion - Release version context
 * @returns Formatted Teams message
 */
export function formatErrorForTeams(
  errorResponse: MCPErrorResponse,
  releaseVersion?: string
): string {
  const { code, message, retryable } = errorResponse.error;
  const guidance = getErrorGuidance(code as keyof typeof ERROR_CODES);

  const versionStr = releaseVersion ? ` for ${releaseVersion}` : '';
  const retryStr = retryable
    ? '🔄 This error is retryable - the system will attempt automatic retry.'
    : '⚠️ This error requires manual intervention.';

  return `
**Deployment Error${versionStr}**

**Error Code:** ${code}
**Message:** ${message}

${retryStr}

**How to Resolve:**
${guidance}

**Timestamp:** ${errorResponse.error.timestamp}
`.trim();
}

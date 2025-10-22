/**
 * Unit Test: BitbucketProvider mergePR method with squash strategy
 *
 * T035: Tests PR merge with squash strategy and conflict detection
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BitbucketProvider } from '../../../../src/providers/git/bitbucket.js';

// Mock the bitbucket package
jest.mock('bitbucket');

describe('BitbucketProvider - mergePR with squash (T035)', () => {
  let provider: BitbucketProvider;
  let mockBitbucketClient: any;

  beforeEach(() => {
    mockBitbucketClient = {
      pullrequests: {
        merge: jest.fn(),
      },
    };

    provider = new BitbucketProvider(
      mockBitbucketClient,
      'test-workspace',
      'test-repo'
    );
  });

  it('should successfully merge PR with squash strategy', async () => {
    mockBitbucketClient.pullrequests.merge.mockResolvedValue({
      data: {
        merge_commit: {
          hash: 'abc123def456',
        },
      },
    });

    const result = await provider.mergePR(
      '123',
      'squash',
      '[PROJ-123] Fix authentication bug'
    );

    expect(result.success).toBe(true);
    expect(result.commitSha).toBe('abc123def456');
    expect(result.squashed).toBe(true);
    expect(mockBitbucketClient.pullrequests.merge).toHaveBeenCalledWith({
      workspace: 'test-workspace',
      repo_slug: 'test-repo',
      pull_request_id: 123,
      merge_strategy: 'squash',
      message: '[PROJ-123] Fix authentication bug',
    });
  });

  it('should detect conflicts on merge', async () => {
    mockBitbucketClient.pullrequests.merge.mockRejectedValue({
      status: 409,
      message: 'Merge conflict',
    });

    const result = await provider.mergePR('123', 'squash', '[PROJ-123] Fix bug');

    expect(result.success).toBe(false);
    expect(result.conflict).toBeDefined();
    expect(result.conflict?.conflictedFiles).toBeDefined();
  });

  it('should use merge strategy for non-squash merges', async () => {
    mockBitbucketClient.pullrequests.merge.mockResolvedValue({
      data: {
        merge_commit: {
          hash: 'xyz789',
        },
      },
    });

    const result = await provider.mergePR('123', 'merge');

    expect(result.success).toBe(true);
    expect(result.squashed).toBe(false);
    expect(mockBitbucketClient.pullrequests.merge).toHaveBeenCalledWith(
      expect.objectContaining({
        merge_strategy: 'merge_commit',
      })
    );
  });

  it('should throw on non-conflict errors', async () => {
    mockBitbucketClient.pullrequests.merge.mockRejectedValue({
      status: 500,
      message: 'Internal Server Error',
    });

    await expect(
      provider.mergePR('123', 'squash', '[PROJ-123] Fix bug')
    ).rejects.toThrow();
  });
});

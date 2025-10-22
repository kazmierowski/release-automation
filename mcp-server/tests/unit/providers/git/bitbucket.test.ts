/**
 * Unit Test: BitbucketProvider checkPRApprovals method
 *
 * T034: Tests PR approval checking with mocked Bitbucket API
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BitbucketProvider } from '../../../../src/providers/git/bitbucket.js';

// Mock the bitbucket package
jest.mock('bitbucket');

describe('BitbucketProvider - checkPRApprovals (T034)', () => {
  let provider: BitbucketProvider;
  let mockBitbucketClient: any;

  beforeEach(() => {
    // Create mock Bitbucket client
    mockBitbucketClient = {
      pullrequests: {
        get: jest.fn(),
      },
    };

    provider = new BitbucketProvider(
      mockBitbucketClient,
      'test-workspace',
      'test-repo'
    );
  });

  it('should return approved status when PR has 2+ approvals', async () => {
    // Mock PR with 2 approvals
    mockBitbucketClient.pullrequests.get.mockResolvedValue({
      data: {
        id: 123,
        author: {
          display_name: 'John Doe',
          email: 'john@example.com',
        },
        participants: [
          {
            user: { display_name: 'Alice' },
            approved: true,
          },
          {
            user: { display_name: 'Bob' },
            approved: true,
          },
          {
            user: { display_name: 'Charlie' },
            approved: false,
          },
        ],
      },
    });

    const result = await provider.checkPRApprovals('123');

    expect(result.prId).toBe('123');
    expect(result.approvalCount).toBe(2);
    expect(result.requiredApprovals).toBe(2);
    expect(result.approved).toBe(true);
    expect(result.approvers).toEqual(['Alice', 'Bob']);
    expect(result.prOwner).toBe('John Doe');
    expect(result.prOwnerEmail).toBe('john@example.com');
  });

  it('should return not approved when PR has < 2 approvals', async () => {
    // Mock PR with 1 approval
    mockBitbucketClient.pullrequests.get.mockResolvedValue({
      data: {
        id: 123,
        author: {
          display_name: 'John Doe',
          email: 'john@example.com',
        },
        participants: [
          {
            user: { display_name: 'Alice' },
            approved: true,
          },
          {
            user: { display_name: 'Bob' },
            approved: false,
          },
        ],
      },
    });

    const result = await provider.checkPRApprovals('123');

    expect(result.approvalCount).toBe(1);
    expect(result.approved).toBe(false);
    expect(result.potentialReviewers).toBeDefined();
  });

  it('should handle Bitbucket API errors', async () => {
    mockBitbucketClient.pullrequests.get.mockRejectedValue(
      new Error('API Error')
    );

    await expect(provider.checkPRApprovals('123')).rejects.toThrow('API Error');
  });
});

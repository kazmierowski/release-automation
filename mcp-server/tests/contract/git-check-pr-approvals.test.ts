/**
 * Contract Test: git_check_pr_approvals MCP Tool
 *
 * T026: Validates input/output schema compliance for git_check_pr_approvals
 */

import { describe, it, expect } from '@jest/globals';
import {
  CheckPRApprovalsInputSchema,
  CheckPRApprovalsOutputSchema,
} from '../../src/tools/git/check-pr-approvals.js';

describe('Contract: git_check_pr_approvals', () => {
  describe('Input Schema', () => {
    it('should accept valid input with all fields', () => {
      const input = {
        pr_id: '123',
        required_approvals: 2,
      };

      const result = CheckPRApprovalsInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept input with default required_approvals', () => {
      const input = { pr_id: '123' };

      const result = CheckPRApprovalsInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.required_approvals).toBe(2);
      }
    });

    it('should reject input without pr_id', () => {
      const input = { required_approvals: 2 };

      const result = CheckPRApprovalsInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Output Schema', () => {
    it('should accept valid output', () => {
      const output = {
        pr_id: '123',
        approval_count: 2,
        required_approvals: 2,
        approved: true,
        approvers: ['Alice', 'Bob'],
        pr_owner: 'Charlie',
        pr_owner_email: 'charlie@example.com',
        potential_reviewers: [],
      };

      const result = CheckPRApprovalsOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should reject output with missing required fields', () => {
      const output = {
        pr_id: '123',
        approval_count: 2,
        // missing other required fields
      };

      const result = CheckPRApprovalsOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

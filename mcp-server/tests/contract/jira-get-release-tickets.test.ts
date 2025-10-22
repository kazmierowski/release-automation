/**
 * Contract Test: jira_get_release_tickets MCP Tool
 *
 * T025: Validates input/output schema compliance for jira_get_release_tickets
 *
 * Ensures the tool implementation matches the defined JSON schema contract.
 */

import { describe, it, expect } from '@jest/globals';
import {
  GetReleaseTicketsInputSchema,
  GetReleaseTicketsOutputSchema,
} from '../../src/tools/jira/get-release-tickets.js';

describe('Contract: jira_get_release_tickets', () => {
  describe('Input Schema', () => {
    it('should accept valid input with all fields', () => {
      const input = {
        release_version: 'v1.2.0',
        jira_statuses: ['Ready for Deployment', 'Approved'],
      };

      const result = GetReleaseTicketsInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept input with default jira_statuses', () => {
      const input = {
        release_version: 'v1.2.0',
      };

      const result = GetReleaseTicketsInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.jira_statuses).toEqual(['Ready for Deployment', 'Approved']);
      }
    });

    it('should reject input without release_version', () => {
      const input = {
        jira_statuses: ['Ready for Deployment'],
      };

      const result = GetReleaseTicketsInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject input with invalid jira_statuses type', () => {
      const input = {
        release_version: 'v1.2.0',
        jira_statuses: 'not-an-array',
      };

      const result = GetReleaseTicketsInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Output Schema', () => {
    it('should accept valid output with tickets', () => {
      const output = {
        tickets: [
          {
            id: 'PROJ-123',
            summary: 'Fix authentication bug',
            pr_id: '456',
            pr_url: 'https://bitbucket.org/workspace/repo/pull-requests/456',
            pr_owner_email: 'developer@example.com',
            status: 'Ready for Deployment',
          },
        ],
        total_count: 1,
      };

      const result = GetReleaseTicketsOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should accept output with empty tickets array', () => {
      const output = {
        tickets: [],
        total_count: 0,
      };

      const result = GetReleaseTicketsOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should reject output without total_count', () => {
      const output = {
        tickets: [],
      };

      const result = GetReleaseTicketsOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });

    it('should reject output with invalid ticket structure', () => {
      const output = {
        tickets: [
          {
            id: 'PROJ-123',
            // missing required fields
          },
        ],
        total_count: 1,
      };

      const result = GetReleaseTicketsOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});

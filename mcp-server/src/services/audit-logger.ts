/**
 * Audit Logger Service
 *
 * T056: Implement audit logger service
 *
 * Logs all MCP tool invocations and system events with structured JSON
 * to append-only log file. Provides compliance audit trail and debugging context.
 *
 * Features:
 * - Append-only log file (no deletions/modifications)
 * - Structured JSON format (one event per line)
 * - Credential sanitization (automatic redaction)
 * - Event type filtering and querying
 * - Timestamp-based rotation (daily logs)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { AuditEvent, AuditEventType } from '../types/entities.js';
import { AuditEventModel } from '../models/audit-event.js';
import { logger } from '../utils/logger.js';

export interface AuditLogConfig {
  logDirectory: string;
  rotateDaily: boolean;
  maxFileSizeMB?: number;
}

/**
 * Audit logger service
 */
export class AuditLogger {
  private config: AuditLogConfig;
  private currentLogFile: string | null = null;

  constructor(config?: Partial<AuditLogConfig>) {
    this.config = {
      logDirectory: process.env.AUDIT_LOG_DIR || './logs/audit',
      rotateDaily: true,
      maxFileSizeMB: 100, // 100MB max file size
      ...config,
    };
  }

  /**
   * Initialize audit logger (create log directory)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      logger.info(`Audit logger initialized: ${this.config.logDirectory}`);
    } catch (error) {
      logger.error('Failed to initialize audit logger', { error });
      throw error;
    }
  }

  /**
   * Log audit event to file
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      // Sanitize event details
      const sanitizedEvent = {
        ...event,
        details: AuditEventModel.sanitizeDetails(event.details),
      };

      // Get current log file path
      const logFilePath = await this.getLogFilePath();

      // Format event as JSON line
      const logLine = AuditEventModel.formatForLog(sanitizedEvent) + '\n';

      // Append to log file
      await fs.appendFile(logFilePath, logLine, { encoding: 'utf-8' });

      logger.debug('Audit event logged', {
        event_type: event.event_type,
        release_id: event.release_id,
        actor: event.actor,
      });
    } catch (error) {
      logger.error('Failed to log audit event', { error, event_type: event.event_type });
      // Don't throw - logging failures shouldn't break the main workflow
    }
  }

  /**
   * Log multiple audit events in batch
   */
  async logBatch(events: AuditEvent[]): Promise<void> {
    for (const event of events) {
      await this.log(event);
    }
  }

  /**
   * Query audit events by criteria
   */
  async query(criteria: {
    releaseId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    actor?: string;
  }): Promise<AuditEvent[]> {
    try {
      const logFiles = await this.getLogFiles(criteria.startDate, criteria.endDate);
      const events: AuditEvent[] = [];

      for (const logFile of logFiles) {
        const fileContent = await fs.readFile(logFile, { encoding: 'utf-8' });
        const lines = fileContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as AuditEvent;

            // Apply filters
            if (criteria.releaseId && event.release_id !== criteria.releaseId) {
              continue;
            }

            if (criteria.eventType && event.event_type !== criteria.eventType) {
              continue;
            }

            if (criteria.actor && event.actor !== criteria.actor) {
              continue;
            }

            if (criteria.startDate) {
              const eventDate = new Date(event.timestamp);
              if (eventDate < criteria.startDate) {
                continue;
              }
            }

            if (criteria.endDate) {
              const eventDate = new Date(event.timestamp);
              if (eventDate > criteria.endDate) {
                continue;
              }
            }

            events.push(event);
          } catch (parseError) {
            logger.warn('Failed to parse audit log line', { parseError, line });
          }
        }
      }

      return events.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Failed to query audit logs', { error, criteria });
      throw error;
    }
  }

  /**
   * Get audit events for a specific release
   */
  async getByReleaseId(releaseId: string): Promise<AuditEvent[]> {
    return this.query({ releaseId });
  }

  /**
   * Get audit events by type
   */
  async getByEventType(eventType: AuditEventType): Promise<AuditEvent[]> {
    return this.query({ eventType });
  }

  /**
   * Get audit events by date range
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<AuditEvent[]> {
    return this.query({ startDate, endDate });
  }

  /**
   * Get current log file path (with daily rotation if enabled)
   */
  private async getLogFilePath(): Promise<string> {
    if (this.config.rotateDaily) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = path.join(this.config.logDirectory, `audit-${today}.log`);

      // Update current log file if changed
      if (this.currentLogFile !== logFile) {
        this.currentLogFile = logFile;
        logger.info(`Using audit log file: ${logFile}`);
      }

      return logFile;
    } else {
      const logFile = path.join(this.config.logDirectory, 'audit.log');

      // Check file size and rotate if needed
      if (this.config.maxFileSizeMB) {
        try {
          const stats = await fs.stat(logFile);
          const fileSizeMB = stats.size / (1024 * 1024);

          if (fileSizeMB > this.config.maxFileSizeMB) {
            // Rotate log file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archivedFile = path.join(
              this.config.logDirectory,
              `audit-${timestamp}.log`
            );
            await fs.rename(logFile, archivedFile);
            logger.info(`Rotated audit log: ${archivedFile}`);
          }
        } catch (error) {
          // File doesn't exist yet, that's fine
        }
      }

      return logFile;
    }
  }

  /**
   * Get list of log files for date range
   */
  private async getLogFiles(startDate?: Date, endDate?: Date): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .map(file => path.join(this.config.logDirectory, file));

      if (!startDate && !endDate) {
        return logFiles;
      }

      // Filter by date range if specified
      const filteredFiles: string[] = [];

      for (const file of logFiles) {
        const fileName = path.basename(file);
        const dateMatch = fileName.match(/audit-(\d{4}-\d{2}-\d{2})\.log/);

        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);

          if (startDate && fileDate < startDate) {
            continue;
          }

          if (endDate && fileDate > endDate) {
            continue;
          }

          filteredFiles.push(file);
        } else {
          // Include non-dated log files
          filteredFiles.push(file);
        }
      }

      return filteredFiles.sort();
    } catch (error) {
      logger.error('Failed to get log files', { error });
      return [];
    }
  }

  /**
   * Get audit statistics for a release
   */
  async getStatistics(releaseId: string): Promise<{
    total_events: number;
    events_by_type: Record<AuditEventType, number>;
    success_count: number;
    failure_count: number;
    duration_ms?: number;
  }> {
    const events = await this.getByReleaseId(releaseId);

    const eventsByType: Record<string, number> = {};
    let successCount = 0;
    let failureCount = 0;

    for (const event of events) {
      eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;

      if (event.status === 'success') {
        successCount++;
      } else if (event.status === 'failure') {
        failureCount++;
      }
    }

    // Calculate duration if we have start and end events
    let durationMs: number | undefined;
    const startEvent = events.find(e => e.event_type === 'release_started');
    const endEvents = events.filter(e =>
      e.event_type === 'release_completed' || e.event_type === 'release_failed'
    );
    const endEvent = endEvents[endEvents.length - 1];

    if (startEvent && endEvent) {
      const startTime = new Date(startEvent.timestamp).getTime();
      const endTime = new Date(endEvent.timestamp).getTime();
      durationMs = endTime - startTime;
    }

    return {
      total_events: events.length,
      events_by_type: eventsByType as Record<AuditEventType, number>,
      success_count: successCount,
      failure_count: failureCount,
      duration_ms: durationMs,
    };
  }

  /**
   * Export audit logs to JSON file
   */
  async exportToJSON(
    outputPath: string,
    criteria?: {
      releaseId?: string;
      eventType?: AuditEventType;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<void> {
    const events = await this.query(criteria || {});
    const jsonContent = JSON.stringify(events, null, 2);
    await fs.writeFile(outputPath, jsonContent, { encoding: 'utf-8' });
    logger.info(`Exported ${events.length} audit events to ${outputPath}`);
  }
}

/**
 * Singleton instance of audit logger
 */
let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get or create audit logger instance
 */
export async function getAuditLogger(): Promise<AuditLogger> {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
    await auditLoggerInstance.initialize();
  }
  return auditLoggerInstance;
}

/**
 * Reset audit logger instance (for testing)
 */
export function resetAuditLogger(): void {
  auditLoggerInstance = null;
}

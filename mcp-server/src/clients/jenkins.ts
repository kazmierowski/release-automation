import axios, { AxiosInstance } from 'axios';
import { logger, logApiCall } from '../utils/logger.js';
import { retry, JENKINS_RETRY_OPTIONS } from '../utils/retry.js';

/**
 * Jenkins client configuration
 */
export interface JenkinsConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  timeout?: number; // Request timeout in milliseconds (default: 60000)
}

/**
 * Jenkins job trigger result
 */
export interface JenkinsTriggerResult {
  queue_id: number;
  job_name: string;
  triggered_at: string;
}

/**
 * Jenkins job status
 */
export interface JenkinsJobStatus {
  build_number: number;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  result?: 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'UNSTABLE';
  console_output_tail?: string; // Last 50 lines
  cache_clear_status?: 'cleared' | 'skipped' | 'failed' | 'in_progress';
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime?: number;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Jenkins API Client Factory
 *
 * Provides Jenkins REST API integration with:
 * - Circuit breaker pattern (3 failures → open for 1 min)
 * - Automatic retry with exponential backoff
 * - Job triggering and status polling
 * - Console output retrieval
 */
export class JenkinsClient {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    state: 'closed',
  };

  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(config: JenkinsConfig) {
    logger.debug('Initializing Jenkins client', { baseUrl: config.baseUrl });

    // Create axios instance with auth
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 60000,
      auth: {
        username: config.username,
        password: config.apiToken,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for circuit breaker
    this.client.interceptors.response.use(
      (response) => {
        this.onSuccess();
        return response;
      },
      (error) => {
        this.onFailure();
        return Promise.reject(error);
      }
    );

    logger.info('Jenkins client initialized', {
      baseUrl: config.baseUrl,
      username: config.username,
    });
  }

  /**
   * Trigger Jenkins deployment job for tenant
   *
   * @param jobName - Jenkins job name
   * @param parameters - Job parameters (tenant_id, environment, release_version)
   * @returns {Promise<JenkinsTriggerResult>} Trigger result with queue ID
   */
  async triggerJob(
    jobName: string,
    parameters: Record<string, string | number | boolean>
  ): Promise<JenkinsTriggerResult> {
    this.checkCircuitBreaker();

    const operation = async (): Promise<JenkinsTriggerResult> => {
      const startTime = Date.now();

      try {
        logger.info(`Triggering Jenkins job: ${jobName}`, { parameters });

        // Build URL with parameters
        const paramString = Object.entries(parameters)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&');

        const url = `/job/${jobName}/buildWithParameters?${paramString}`;

        const response = await this.client.post(url);

        const duration = Date.now() - startTime;
        logApiCall('POST', url, response.status, duration);

        // Extract queue ID from Location header
        const queueUrl = response.headers['location'] || '';
        const queueIdMatch = queueUrl.match(/queue\/item\/(\d+)/);
        const queueId = queueIdMatch ? parseInt(queueIdMatch[1], 10) : 0;

        const result: JenkinsTriggerResult = {
          queue_id: queueId,
          job_name: jobName,
          triggered_at: new Date().toISOString(),
        };

        logger.info(`Jenkins job triggered: ${jobName}`, {
          queueId,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : 'Unknown error';

        logApiCall('POST', `/job/${jobName}/buildWithParameters`, 500, duration);
        logger.error(`Failed to trigger Jenkins job: ${jobName}`, {
          error: message,
        });

        throw new Error(`Failed to trigger Jenkins job ${jobName}: ${message}`);
      }
    };

    return retry(operation, JENKINS_RETRY_OPTIONS);
  }

  /**
   * Get Jenkins job status by build number
   *
   * @param jobName - Jenkins job name
   * @param buildNumber - Build number
   * @returns {Promise<JenkinsJobStatus>} Job status
   */
  async getJobStatus(jobName: string, buildNumber: number): Promise<JenkinsJobStatus> {
    this.checkCircuitBreaker();

    const operation = async (): Promise<JenkinsJobStatus> => {
      const startTime = Date.now();

      try {
        const url = `/job/${jobName}/${buildNumber}/api/json`;

        const response = await this.client.get(url);

        const duration = Date.now() - startTime;
        logApiCall('GET', url, response.status, duration);

        const data = response.data;

        // Determine status from Jenkins result
        let status: JenkinsJobStatus['status'] = 'running';
        if (data.building === false) {
          switch (data.result) {
            case 'SUCCESS':
              status = 'success';
              break;
            case 'FAILURE':
              status = 'failed';
              break;
            case 'ABORTED':
              status = 'cancelled';
              break;
            case 'UNSTABLE':
              status = 'failed';
              break;
            default:
              status = 'running';
          }
        }

        // Extract cache clear status from environment variables or build parameters
        // Jenkins job sets this as an environment variable or build result property
        const cacheClearStatus = this.extractCacheClearStatus(data);

        const jobStatus: JenkinsJobStatus = {
          build_number: buildNumber,
          status,
          started_at: data.timestamp
            ? new Date(data.timestamp).toISOString()
            : undefined,
          completed_at:
            data.building === false && data.timestamp
              ? new Date(data.timestamp + data.duration).toISOString()
              : undefined,
          duration_ms: data.duration || undefined,
          result: data.result,
          cache_clear_status: cacheClearStatus,
        };

        logger.debug(`Jenkins job status retrieved: ${jobName}#${buildNumber}`, {
          status,
          result: data.result,
        });

        return jobStatus;
      } catch (error) {
        const duration = Date.now() - startTime;
        const message = error instanceof Error ? error.message : 'Unknown error';

        logApiCall('GET', `/job/${jobName}/${buildNumber}/api/json`, 500, duration);

        throw new Error(`Failed to get Jenkins job status: ${message}`);
      }
    };

    return retry(operation, JENKINS_RETRY_OPTIONS);
  }

  /**
   * Get console output for job (last N lines)
   *
   * @param jobName - Jenkins job name
   * @param buildNumber - Build number
   * @param lines - Number of lines to retrieve (default: 50)
   * @returns {Promise<string>} Console output
   */
  async getConsoleOutput(
    jobName: string,
    buildNumber: number,
    lines: number = 50
  ): Promise<string> {
    this.checkCircuitBreaker();

    try {
      const url = `/job/${jobName}/${buildNumber}/logText/progressiveText`;

      const response = await this.client.get(url, {
        params: { start: -lines },
      });

      return response.data || '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get console output: ${message}`);
      return '';
    }
  }

  /**
   * Poll Jenkins queue to get build number once job starts
   *
   * @param queueId - Queue item ID
   * @param maxAttempts - Maximum polling attempts (default: 10)
   * @param intervalMs - Polling interval in milliseconds (default: 2000)
   * @returns {Promise<number>} Build number once started
   */
  async pollQueueForBuildNumber(
    queueId: number,
    maxAttempts: number = 10,
    intervalMs: number = 2000
  ): Promise<number> {
    this.checkCircuitBreaker();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const url = `/queue/item/${queueId}/api/json`;

        const response = await this.client.get(url);
        const data = response.data;

        // Check if executable (build) exists
        if (data.executable && data.executable.number) {
          const buildNumber = data.executable.number;
          logger.info(`Jenkins build started: queue ${queueId} → build ${buildNumber}`);
          return buildNumber;
        }

        // Check if cancelled
        if (data.cancelled === true) {
          throw new Error(`Jenkins queue item ${queueId} was cancelled`);
        }

        logger.debug(`Jenkins queue ${queueId} still pending (attempt ${attempt}/${maxAttempts})`);

        // Wait before next attempt
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw new Error(
      `Jenkins build did not start within ${maxAttempts} attempts (queue ID: ${queueId})`
    );
  }

  /**
   * Extract cache clear status from Jenkins build data
   *
   * Jenkins job sets cache_clear_status as environment variable or build property
   *
   * @param buildData - Jenkins build API response
   * @returns Cache clear status or undefined
   */
  private extractCacheClearStatus(
    buildData: any
  ): 'cleared' | 'skipped' | 'failed' | 'in_progress' | undefined {
    // Check environment variables (injected by Jenkins job)
    if (buildData.actions) {
      for (const action of buildData.actions) {
        if (action._class === 'hudson.model.ParametersAction' && action.parameters) {
          const cacheParam = action.parameters.find(
            (p: any) => p.name === 'cache_clear_status'
          );
          if (cacheParam?.value) {
            return cacheParam.value as any;
          }
        }
      }
    }

    // Default: assume cleared if build successful, failed otherwise
    if (buildData.result === 'SUCCESS') {
      return 'cleared';
    } else if (buildData.building === true) {
      return 'in_progress';
    }

    return undefined;
  }

  /**
   * Check circuit breaker state
   *
   * @throws Error if circuit breaker is open
   */
  private checkCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'open') {
      const now = Date.now();
      const timeSinceFailure = now - (this.circuitBreaker.lastFailureTime || 0);

      if (timeSinceFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
        // Transition to half-open
        this.circuitBreaker.state = 'half-open';
        logger.info('Jenkins circuit breaker: open → half-open');
      } else {
        throw new Error(
          `Jenkins circuit breaker is OPEN - too many failures. Retry in ${Math.ceil((this.CIRCUIT_BREAKER_TIMEOUT - timeSinceFailure) / 1000)}s`
        );
      }
    }
  }

  /**
   * Record successful API call for circuit breaker
   */
  private onSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      // Successful call in half-open → close circuit
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      logger.info('Jenkins circuit breaker: half-open → closed');
    }
  }

  /**
   * Record failed API call for circuit breaker
   */
  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.state = 'open';
      logger.warn(`Jenkins circuit breaker: closed → OPEN (${this.circuitBreaker.failures} failures)`);
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
}

/**
 * Create Jenkins client from environment configuration
 *
 * @param config - Jenkins configuration
 * @returns {JenkinsClient} Initialized Jenkins client
 */
export function createJenkinsClient(config: JenkinsConfig): JenkinsClient {
  return new JenkinsClient(config);
}

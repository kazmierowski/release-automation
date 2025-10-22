import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

/**
 * Environment configuration interface
 * Maps .env variables to typed configuration object
 */
export interface EnvironmentConfig {
  // Environment
  NODE_ENV: string;
  DEFAULT_ENVIRONMENT: 'Integration' | 'UAT' | 'UAT1' | 'PROD';

  // Git Platform
  GIT_PLATFORM: 'bitbucket' | 'github' | 'gitlab';
  GIT_BASE_URL: string;
  GIT_WORKSPACE: string;
  GIT_REPOSITORY: string;

  // Jenkins
  JENKINS_BASE_URL: string;
  JENKINS_USER: string;
  JENKINS_API_TOKEN: string;

  // JIRA
  JIRA_BASE_URL: string;
  JIRA_USER_EMAIL: string;
  JIRA_API_TOKEN: string;
  JIRA_PROJECT_KEY: string;

  // Microsoft Teams
  TEAMS_TENANT_ID: string;
  TEAMS_CLIENT_ID: string;
  TEAMS_CLIENT_SECRET: string;
  TEAMS_CHANNEL_ID: string;

  // Azure Key Vault
  AZURE_KEYVAULT_URL: string;

  // MCP Server
  MCP_SERVER_PORT: number;
  MCP_SERVER_HOST: string;

  // n8n
  N8N_BASE_URL: string;
  N8N_API_KEY: string;

  // Polling Configuration
  JENKINS_POLL_INTERVAL_MS: number;
  JENKINS_POLL_MAX_ATTEMPTS: number;
  CACHE_TTL_SECRETS_MS: number;

  // Retry Configuration
  RETRY_MAX_ATTEMPTS: number;
  RETRY_BASE_DELAY_MS: number;
  RETRY_MAX_DELAY_MS: number;

  // GitFlow Configuration
  MIN_PR_APPROVALS: number;
  DEFAULT_SOURCE_BRANCH: string;
  DEFAULT_TARGET_BRANCH: string;

  // Paths
  TENANT_MANIFEST_PATH: string;
  ENVIRONMENT_MANIFEST_PATH: string;
}

/**
 * Load and validate environment configuration from .env file
 *
 * @throws {Error} If required environment variables are missing
 * @returns {EnvironmentConfig} Validated configuration object
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  // Load .env file
  dotenv.config();

  const config: EnvironmentConfig = {
    // Environment
    NODE_ENV: process.env.NODE_ENV || 'development',
    DEFAULT_ENVIRONMENT: (process.env.DEFAULT_ENVIRONMENT ||
      'Integration') as EnvironmentConfig['DEFAULT_ENVIRONMENT'],

    // Git Platform
    GIT_PLATFORM: (process.env.GIT_PLATFORM ||
      'bitbucket') as EnvironmentConfig['GIT_PLATFORM'],
    GIT_BASE_URL:
      process.env.GIT_BASE_URL || 'https://bitbucket.org/api/2.0',
    GIT_WORKSPACE: process.env.GIT_WORKSPACE || '',
    GIT_REPOSITORY: process.env.GIT_REPOSITORY || '',

    // Jenkins
    JENKINS_BASE_URL: process.env.JENKINS_BASE_URL || '',
    JENKINS_USER: process.env.JENKINS_USER || '',
    JENKINS_API_TOKEN: process.env.JENKINS_API_TOKEN || '',

    // JIRA
    JIRA_BASE_URL: process.env.JIRA_BASE_URL || '',
    JIRA_USER_EMAIL: process.env.JIRA_USER_EMAIL || '',
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || '',
    JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY || '',

    // Microsoft Teams
    TEAMS_TENANT_ID: process.env.TEAMS_TENANT_ID || '',
    TEAMS_CLIENT_ID: process.env.TEAMS_CLIENT_ID || '',
    TEAMS_CLIENT_SECRET: process.env.TEAMS_CLIENT_SECRET || '',
    TEAMS_CHANNEL_ID: process.env.TEAMS_CHANNEL_ID || '',

    // Azure Key Vault
    AZURE_KEYVAULT_URL: process.env.AZURE_KEYVAULT_URL || '',

    // MCP Server
    MCP_SERVER_PORT: parseInt(process.env.MCP_SERVER_PORT || '3001', 10),
    MCP_SERVER_HOST: process.env.MCP_SERVER_HOST || '0.0.0.0',

    // n8n
    N8N_BASE_URL: process.env.N8N_BASE_URL || 'http://localhost:5678',
    N8N_API_KEY: process.env.N8N_API_KEY || '',

    // Polling Configuration
    JENKINS_POLL_INTERVAL_MS: parseInt(
      process.env.JENKINS_POLL_INTERVAL_MS || '10000',
      10
    ),
    JENKINS_POLL_MAX_ATTEMPTS: parseInt(
      process.env.JENKINS_POLL_MAX_ATTEMPTS || '60',
      10
    ),
    CACHE_TTL_SECRETS_MS: parseInt(
      process.env.CACHE_TTL_SECRETS_MS || '300000',
      10
    ), // 5 minutes

    // Retry Configuration
    RETRY_MAX_ATTEMPTS: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    RETRY_BASE_DELAY_MS: parseInt(
      process.env.RETRY_BASE_DELAY_MS || '2000',
      10
    ),
    RETRY_MAX_DELAY_MS: parseInt(
      process.env.RETRY_MAX_DELAY_MS || '8000',
      10
    ),

    // GitFlow Configuration
    MIN_PR_APPROVALS: parseInt(process.env.MIN_PR_APPROVALS || '2', 10),
    DEFAULT_SOURCE_BRANCH: process.env.DEFAULT_SOURCE_BRANCH || 'development',
    DEFAULT_TARGET_BRANCH: process.env.DEFAULT_TARGET_BRANCH || 'development',

    // Paths
    TENANT_MANIFEST_PATH:
      process.env.TENANT_MANIFEST_PATH || './config/tenants.yaml',
    ENVIRONMENT_MANIFEST_PATH:
      process.env.ENVIRONMENT_MANIFEST_PATH || './config/environments.yaml',
  };

  // Validate required fields
  validateConfiguration(config);

  return config;
}

/**
 * Validate that all required configuration fields are present
 *
 * @param {EnvironmentConfig} config - Configuration object to validate
 * @throws {Error} If required fields are missing
 */
function validateConfiguration(config: EnvironmentConfig): void {
  const requiredFields: Array<keyof EnvironmentConfig> = [
    'GIT_BASE_URL',
    'GIT_WORKSPACE',
    'GIT_REPOSITORY',
    'JENKINS_BASE_URL',
    'JIRA_BASE_URL',
  ];

  const missingFields = requiredFields.filter((field) => !config[field]);

  if (missingFields.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingFields.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Validate enum values
  const validEnvironments = ['Integration', 'UAT', 'UAT1', 'PROD'];
  if (!validEnvironments.includes(config.DEFAULT_ENVIRONMENT)) {
    throw new Error(
      `Invalid DEFAULT_ENVIRONMENT: ${config.DEFAULT_ENVIRONMENT}. Must be one of: ${validEnvironments.join(', ')}`
    );
  }

  const validPlatforms = ['bitbucket', 'github', 'gitlab'];
  if (!validPlatforms.includes(config.GIT_PLATFORM)) {
    throw new Error(
      `Invalid GIT_PLATFORM: ${config.GIT_PLATFORM}. Must be one of: ${validPlatforms.join(', ')}`
    );
  }

  logger.info('Environment configuration loaded and validated successfully');
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

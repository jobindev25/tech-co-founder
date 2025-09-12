// Shared utility functions for the automated development pipeline

import { 
  PipelineError, 
  RetryConfig, 
  RateLimitConfig,
  WebhookSignature 
} from './types.ts';

// Retry mechanism with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {
    maxRetries: 3,
    delays: [1000, 2000, 5000],
    backoffMultiplier: 2
  }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if it's not a retryable error
      if (error instanceof PipelineError && !error.retryable) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Calculate delay
      const baseDelay = config.delays[attempt] || config.delays[config.delays.length - 1];
      const delay = baseDelay * Math.pow(config.backoffMultiplier, attempt);
      const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
      
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay + jitter}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
}

// Rate limiting utility
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private config: RateLimitConfig) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this key
    const requests = this.requests.get(key) || [];
    
    // Filter out requests outside the window
    const validRequests = requests.filter(time => time > windowStart);
    
    // Check if we're under the limit
    if (validRequests.length >= this.config.requests) {
      return false;
    }
    
    // Add this request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }
  
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => time > windowStart);
    
    return Math.max(0, this.config.requests - validRequests.length);
  }
  
  getResetTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.config.windowMs;
  }
}

// Global rate limiters for different APIs
export const rateLimiters = {
  openai: new RateLimiter({ requests: 60, windowMs: 60000, skipSuccessfulRequests: false }),
  kiro: new RateLimiter({ requests: 100, windowMs: 60000, skipSuccessfulRequests: false }),
  tavus: new RateLimiter({ requests: 50, windowMs: 60000, skipSuccessfulRequests: false })
};

// Logging utility with structured logging
export class Logger {
  constructor(private context: string) {}
  
  private log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(data && { data })
    };
    
    console.log(JSON.stringify(logEntry));
  }
  
  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }
  
  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }
  
  error(message: string, error?: Error | any, data?: any) {
    this.log('ERROR', message, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      ...data
    });
  }
  
  debug(message: string, data?: any) {
    if (Deno.env.get('LOG_LEVEL') === 'DEBUG') {
      this.log('DEBUG', message, data);
    }
  }
}

// Performance monitoring utility
export class PerformanceMonitor {
  private startTime: number;
  private metrics: Map<string, number> = new Map();
  
  constructor(private logger: Logger) {
    this.startTime = performance.now();
  }
  
  mark(name: string) {
    this.metrics.set(name, performance.now() - this.startTime);
  }
  
  measure(name: string, startMark?: string): number {
    const endTime = performance.now() - this.startTime;
    const startTime = startMark ? this.metrics.get(startMark) || 0 : 0;
    const duration = endTime - startTime;
    
    this.metrics.set(name, duration);
    this.logger.debug(`Performance: ${name}`, { duration: `${duration.toFixed(2)}ms` });
    
    return duration;
  }
  
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
  
  getTotalTime(): number {
    return performance.now() - this.startTime;
  }
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp?: string
): boolean {
  try {
    // Create the expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(timestamp ? `${timestamp}.${payload}` : payload);
    
    // Use Web Crypto API for HMAC
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ).then(key => 
      crypto.subtle.sign('HMAC', key, messageData)
    ).then(signatureBuffer => {
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Compare signatures (constant time comparison)
      return signature.toLowerCase() === expectedSignature.toLowerCase();
    }).catch(() => false);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

// Data validation utilities
export function validateRequired<T>(obj: any, fields: (keyof T)[]): T {
  const missing = fields.filter(field => obj[field] === undefined || obj[field] === null);
  
  if (missing.length > 0) {
    throw new PipelineError(
      `Missing required fields: ${missing.join(', ')}`,
      'VALIDATION_ERROR',
      { missing, provided: Object.keys(obj) }
    );
  }
  
  return obj as T;
}

export function validateProjectPlan(plan: any): boolean {
  const requiredFields = ['name', 'description', 'techStack', 'features'];
  const techStackFields = ['frontend', 'backend', 'database'];
  
  try {
    // Check top-level fields
    for (const field of requiredFields) {
      if (!plan[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Check tech stack
    for (const field of techStackFields) {
      if (!plan.techStack[field]) {
        throw new Error(`Missing tech stack field: ${field}`);
      }
    }
    
    // Check features array
    if (!Array.isArray(plan.features) || plan.features.length === 0) {
      throw new Error('Features must be a non-empty array');
    }
    
    // Validate each feature
    for (const feature of plan.features) {
      if (!feature.name || !feature.description) {
        throw new Error('Each feature must have name and description');
      }
    }
    
    return true;
  } catch (error) {
    throw new PipelineError(
      `Invalid project plan: ${error.message}`,
      'VALIDATION_ERROR',
      { plan }
    );
  }
}

// Environment variable utilities
export function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnvWithDefault(key: string, defaultValue: string): string {
  return Deno.env.get(key) || defaultValue;
}

// JSON utilities with error handling
export function safeJsonParse<T>(json: string, fallback?: T): T | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('Failed to parse JSON:', error.message);
    return fallback || null;
  }
}

export function safeJsonStringify(obj: any, fallback = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn('Failed to stringify JSON:', error.message);
    return fallback;
  }
}

// HTTP utilities
export function createCorsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

export function createJsonResponse(
  data: any, 
  status = 200, 
  headers: Record<string, string> = {}
): Response {
  return new Response(
    safeJsonStringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...createCorsHeaders(),
        ...headers
      }
    }
  );
}

export function createErrorResponse(
  message: string,
  status = 500,
  code?: string,
  context?: any
): Response {
  return createJsonResponse(
    {
      error: message,
      code,
      context,
      timestamp: new Date().toISOString()
    },
    status
  );
}

// Async utilities
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Queue utilities
export function createTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function prioritizeTask(taskType: string): number {
  const priorities: Record<string, number> = {
    'analyze_conversation': 5,
    'generate_plan': 4,
    'trigger_build': 3,
    'process_webhook': 2,
    'send_notification': 1
  };
  
  return priorities[taskType] || 1;
}

// Memory management utilities
export function cleanupLargeObjects(...objects: any[]): void {
  objects.forEach(obj => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        delete obj[key];
      });
    }
  });
}

// Feature flags utility
export async function isFeatureEnabled(feature: string, defaultValue = false): Promise<boolean> {
  try {
    const value = Deno.env.get(`FEATURE_${feature.toUpperCase()}`);
    if (value !== undefined) {
      return value.toLowerCase() === 'true';
    }
    
    // Could also check database config here
    return defaultValue;
  } catch (error) {
    console.warn(`Failed to check feature flag ${feature}:`, error);
    return defaultValue;
  }
}
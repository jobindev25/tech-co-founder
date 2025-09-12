import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse
} from '../_shared/utils.ts'

const logger = new Logger('RateLimiter')

// In-memory rate limit cache for fast lookups
const rateLimitCache = new Map<string, RateLimitEntry>()
const suspiciousIPs = new Set<string>()

interface RateLimitEntry {
  count: number
  resetTime: number
  blocked: boolean
  blockUntil?: number
}

interface RateLimitRule {
  name: string
  requests: number
  window: number // in seconds
  blockDuration: number // in seconds
}

// Rate limit rules
const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  // General API limits
  'api_general': { name: 'General API', requests: 100, window: 60, blockDuration: 300 },
  'api_auth': { name: 'Authentication', requests: 10, window: 60, blockDuration: 900 },
  'api_conversation': { name: 'Conversation Creation', requests: 5, window: 60, blockDuration: 300 },
  'api_build': { name: 'Build Trigger', requests: 3, window: 300, blockDuration: 600 },
  
  // User-specific limits
  'user_projects': { name: 'Project Creation', requests: 10, window: 3600, blockDuration: 1800 },
  'user_api_calls': { name: 'User API Calls', requests: 1000, window: 3600, blockDuration: 3600 },
  
  // IP-based limits for DDoS protection
  'ip_requests': { name: 'IP Requests', requests: 200, window: 60, blockDuration: 600 },
  'ip_auth_attempts': { name: 'IP Auth Attempts', requests: 20, window: 300, blockDuration: 1800 }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'check'
    
    logger.debug('Rate limiter request', { action, method: req.method })

    const db = DatabaseService.create()

    switch (action) {
      case 'check':
        return await handleRateLimitCheck(req, db)
      case 'status':
        return await handleRateLimitStatus(req, db)
      case 'reset':
        return await handleRateLimitReset(req, db)
      case 'block':
        return await handleManualBlock(req, db)
      case 'unblock':
        return await handleManualUnblock(req, db)
      case 'stats':
        return await handleRateLimitStats(req, db)
      default:
        return createErrorResponse('Invalid action', 400, 'INVALID_ACTION')
    }

  } catch (error) {
    logger.error('Rate limiter failed', error)
    return createErrorResponse(
      'Rate limiting failed',
      500,
      'RATE_LIMIT_ERROR'
    )
  }
})

// Handle rate limit check
async function handleRateLimitCheck(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { 
      identifier, 
      rule_name, 
      user_id, 
      endpoint,
      increment = true 
    } = await req.json()

    if (!identifier || !rule_name) {
      return createErrorResponse('Identifier and rule_name required', 400, 'MISSING_PARAMS')
    }

    const rule = RATE_LIMIT_RULES[rule_name]
    if (!rule) {
      return createErrorResponse('Invalid rule name', 400, 'INVALID_RULE')
    }

    // Get client IP for additional checks
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'

    // Check if IP is suspicious or blocked
    const ipBlocked = await checkIPBlocked(clientIP, db)
    if (ipBlocked.blocked) {
      logger.warn('Request from blocked IP', { ip: clientIP, reason: ipBlocked.reason })
      return createJsonResponse({
        allowed: false,
        blocked: true,
        reason: 'IP_BLOCKED',
        block_until: ipBlocked.blockUntil,
        message: 'IP address is temporarily blocked'
      }, 429)
    }

    // Check rate limit
    const rateLimitResult = await checkRateLimit(identifier, rule, increment)
    
    // Log rate limit check
    await logRateLimitCheck(db, {
      identifier,
      rule_name,
      user_id,
      endpoint,
      client_ip: clientIP,
      allowed: rateLimitResult.allowed,
      current_count: rateLimitResult.currentCount,
      limit: rule.requests,
      reset_time: rateLimitResult.resetTime
    })

    // Check for suspicious patterns
    if (!rateLimitResult.allowed) {
      await detectSuspiciousActivity(clientIP, identifier, rule_name, db)
    }

    const response = {
      allowed: rateLimitResult.allowed,
      rule: rule.name,
      limit: rule.requests,
      remaining: Math.max(0, rule.requests - rateLimitResult.currentCount),
      reset_time: rateLimitResult.resetTime,
      retry_after: rateLimitResult.allowed ? null : rule.window
    }

    const statusCode = rateLimitResult.allowed ? 200 : 429
    return createJsonResponse(response, statusCode)

  } catch (error) {
    logger.error('Rate limit check failed', error)
    return createErrorResponse('Rate limit check failed', 500, 'CHECK_ERROR')
  }
}

// Check rate limit for identifier
async function checkRateLimit(
  identifier: string, 
  rule: RateLimitRule, 
  increment: boolean
): Promise<{ allowed: boolean; currentCount: number; resetTime: number }> {
  const now = Date.now()
  const windowStart = now - (rule.window * 1000)
  const resetTime = Math.ceil(now / (rule.window * 1000)) * (rule.window * 1000)

  let entry = rateLimitCache.get(identifier)

  // Initialize or reset if window expired
  if (!entry || entry.resetTime <= now) {
    entry = {
      count: 0,
      resetTime,
      blocked: false
    }
  }

  // Check if currently blocked
  if (entry.blocked && entry.blockUntil && entry.blockUntil > now) {
    return {
      allowed: false,
      currentCount: entry.count,
      resetTime: entry.resetTime
    }
  }

  // Clear block if expired
  if (entry.blocked && entry.blockUntil && entry.blockUntil <= now) {
    entry.blocked = false
    entry.blockUntil = undefined
    entry.count = 0
  }

  // Increment count if requested
  if (increment) {
    entry.count++
  }

  const allowed = entry.count <= rule.requests

  // Block if limit exceeded
  if (!allowed && !entry.blocked) {
    entry.blocked = true
    entry.blockUntil = now + (rule.blockDuration * 1000)
    
    logger.warn('Rate limit exceeded, blocking identifier', {
      identifier,
      rule: rule.name,
      count: entry.count,
      limit: rule.requests,
      block_until: new Date(entry.blockUntil).toISOString()
    })
  }

  // Update cache
  rateLimitCache.set(identifier, entry)

  return {
    allowed,
    currentCount: entry.count,
    resetTime: entry.resetTime
  }
}

// Check if IP is blocked
async function checkIPBlocked(ip: string, db: DatabaseService): Promise<{ blocked: boolean; reason?: string; blockUntil?: number }> {
  try {
    // Check in-memory suspicious IPs
    if (suspiciousIPs.has(ip)) {
      return { blocked: true, reason: 'SUSPICIOUS_ACTIVITY' }
    }

    // Check database for blocked IPs
    const { data: blockedIP } = await db.supabase
      .from('blocked_ips')
      .select('reason, blocked_until, permanent')
      .eq('ip_address', ip)
      .eq('active', true)
      .single()

    if (blockedIP) {
      // Check if temporary block has expired
      if (!blockedIP.permanent && blockedIP.blocked_until && new Date(blockedIP.blocked_until) <= new Date()) {
        // Unblock expired IP
        await db.supabase
          .from('blocked_ips')
          .update({ active: false })
          .eq('ip_address', ip)
        
        return { blocked: false }
      }

      return { 
        blocked: true, 
        reason: blockedIP.reason,
        blockUntil: blockedIP.blocked_until ? new Date(blockedIP.blocked_until).getTime() : undefined
      }
    }

    return { blocked: false }

  } catch (error) {
    logger.warn('Error checking IP block status', error, { ip })
    return { blocked: false }
  }
}

// Detect suspicious activity patterns
async function detectSuspiciousActivity(
  ip: string, 
  identifier: string, 
  ruleName: string, 
  db: DatabaseService
): Promise<void> {
  try {
    // Count recent violations for this IP
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data: recentViolations } = await db.supabase
      .from('rate_limit_logs')
      .select('count(*)')
      .eq('client_ip', ip)
      .eq('allowed', false)
      .gte('created_at', fiveMinutesAgo)

    const violationCount = recentViolations?.[0]?.count || 0

    // Block IP if too many violations
    if (violationCount >= 10) {
      await blockIP(ip, 'EXCESSIVE_RATE_LIMIT_VIOLATIONS', 30 * 60 * 1000, db) // 30 minutes
      suspiciousIPs.add(ip)
      
      logger.warn('IP blocked for excessive rate limit violations', {
        ip,
        violation_count: violationCount,
        rule_name: ruleName
      })
    }

    // Check for distributed attacks (same identifier from multiple IPs)
    const { data: distributedAttack } = await db.supabase
      .from('rate_limit_logs')
      .select('client_ip, count(*)')
      .eq('identifier', identifier)
      .eq('allowed', false)
      .gte('created_at', fiveMinutesAgo)

    if (distributedAttack && distributedAttack.length >= 5) {
      // Multiple IPs hitting same identifier - potential distributed attack
      logger.warn('Potential distributed attack detected', {
        identifier,
        attacking_ips: distributedAttack.length,
        rule_name: ruleName
      })

      // Block all attacking IPs temporarily
      for (const attack of distributedAttack) {
        if (attack.count >= 3) {
          await blockIP(attack.client_ip, 'DISTRIBUTED_ATTACK', 60 * 60 * 1000, db) // 1 hour
          suspiciousIPs.add(attack.client_ip)
        }
      }
    }

  } catch (error) {
    logger.error('Error detecting suspicious activity', error)
  }
}

// Block IP address
async function blockIP(
  ip: string, 
  reason: string, 
  durationMs: number, 
  db: DatabaseService
): Promise<void> {
  try {
    const blockedUntil = new Date(Date.now() + durationMs).toISOString()

    await db.supabase
      .from('blocked_ips')
      .upsert({
        ip_address: ip,
        reason,
        blocked_until: blockedUntil,
        permanent: false,
        active: true,
        created_at: new Date().toISOString()
      })

    logger.info('IP blocked', { ip, reason, blocked_until: blockedUntil })

  } catch (error) {
    logger.error('Failed to block IP', error, { ip, reason })
  }
}

// Log rate limit check
async function logRateLimitCheck(
  db: DatabaseService, 
  logData: any
): Promise<void> {
  try {
    await db.supabase
      .from('rate_limit_logs')
      .insert({
        ...logData,
        created_at: new Date().toISOString()
      })
  } catch (error) {
    logger.warn('Failed to log rate limit check', error)
  }
}

// Handle rate limit status
async function handleRateLimitStatus(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { identifier } = await req.json()

    if (!identifier) {
      return createErrorResponse('Identifier required', 400, 'MISSING_IDENTIFIER')
    }

    const entry = rateLimitCache.get(identifier)
    
    if (!entry) {
      return createJsonResponse({
        identifier,
        status: 'no_limits',
        message: 'No rate limit data found'
      })
    }

    const now = Date.now()
    const status = {
      identifier,
      blocked: entry.blocked,
      current_count: entry.count,
      reset_time: entry.resetTime,
      block_until: entry.blockUntil,
      time_until_reset: Math.max(0, entry.resetTime - now),
      time_until_unblock: entry.blockUntil ? Math.max(0, entry.blockUntil - now) : null
    }

    return createJsonResponse(status)

  } catch (error) {
    logger.error('Rate limit status check failed', error)
    return createErrorResponse('Status check failed', 500, 'STATUS_ERROR')
  }
}

// Handle rate limit reset
async function handleRateLimitReset(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { identifier, admin_token } = await req.json()

    // Verify admin authorization
    if (!admin_token || admin_token !== Deno.env.get('ADMIN_TOKEN')) {
      return createErrorResponse('Unauthorized', 403, 'UNAUTHORIZED')
    }

    if (identifier) {
      // Reset specific identifier
      rateLimitCache.delete(identifier)
      logger.info('Rate limit reset for identifier', { identifier })
    } else {
      // Reset all rate limits
      rateLimitCache.clear()
      suspiciousIPs.clear()
      logger.info('All rate limits reset')
    }

    return createJsonResponse({ reset: true, identifier })

  } catch (error) {
    logger.error('Rate limit reset failed', error)
    return createErrorResponse('Reset failed', 500, 'RESET_ERROR')
  }
}

// Handle manual IP block
async function handleManualBlock(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { ip_address, reason, duration_hours = 24, admin_token } = await req.json()

    // Verify admin authorization
    if (!admin_token || admin_token !== Deno.env.get('ADMIN_TOKEN')) {
      return createErrorResponse('Unauthorized', 403, 'UNAUTHORIZED')
    }

    if (!ip_address || !reason) {
      return createErrorResponse('IP address and reason required', 400, 'MISSING_PARAMS')
    }

    await blockIP(ip_address, reason, duration_hours * 60 * 60 * 1000, db)
    suspiciousIPs.add(ip_address)

    return createJsonResponse({ 
      blocked: true, 
      ip_address, 
      reason,
      duration_hours 
    })

  } catch (error) {
    logger.error('Manual IP block failed', error)
    return createErrorResponse('Block failed', 500, 'BLOCK_ERROR')
  }
}

// Handle manual IP unblock
async function handleManualUnblock(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { ip_address, admin_token } = await req.json()

    // Verify admin authorization
    if (!admin_token || admin_token !== Deno.env.get('ADMIN_TOKEN')) {
      return createErrorResponse('Unauthorized', 403, 'UNAUTHORIZED')
    }

    if (!ip_address) {
      return createErrorResponse('IP address required', 400, 'MISSING_IP')
    }

    // Unblock IP in database
    await db.supabase
      .from('blocked_ips')
      .update({ active: false })
      .eq('ip_address', ip_address)

    // Remove from suspicious IPs
    suspiciousIPs.delete(ip_address)

    logger.info('IP manually unblocked', { ip_address })

    return createJsonResponse({ 
      unblocked: true, 
      ip_address 
    })

  } catch (error) {
    logger.error('Manual IP unblock failed', error)
    return createErrorResponse('Unblock failed', 500, 'UNBLOCK_ERROR')
  }
}

// Handle rate limit statistics
async function handleRateLimitStats(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const url = new URL(req.url)
    const timeframe = url.searchParams.get('timeframe') || '1h'
    
    const timeframeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }[timeframe] || 60 * 60 * 1000

    const startTime = new Date(Date.now() - timeframeMs).toISOString()

    // Get rate limit statistics
    const { data: stats } = await db.supabase
      .from('rate_limit_logs')
      .select('rule_name, allowed, client_ip, created_at')
      .gte('created_at', startTime)

    const { data: blockedIPs } = await db.supabase
      .from('blocked_ips')
      .select('ip_address, reason, created_at, blocked_until')
      .eq('active', true)

    const analysis = {
      timeframe,
      total_requests: stats?.length || 0,
      blocked_requests: stats?.filter(s => !s.allowed).length || 0,
      unique_ips: new Set(stats?.map(s => s.client_ip)).size || 0,
      blocked_ips_count: blockedIPs?.length || 0,
      by_rule: stats?.reduce((acc: any, stat: any) => {
        if (!acc[stat.rule_name]) {
          acc[stat.rule_name] = { total: 0, blocked: 0 }
        }
        acc[stat.rule_name].total++
        if (!stat.allowed) acc[stat.rule_name].blocked++
        return acc
      }, {}) || {},
      top_blocked_ips: blockedIPs?.slice(0, 10) || [],
      cache_stats: {
        cached_identifiers: rateLimitCache.size,
        suspicious_ips: suspiciousIPs.size
      }
    }

    return createJsonResponse(analysis)

  } catch (error) {
    logger.error('Rate limit stats failed', error)
    return createErrorResponse('Stats failed', 500, 'STATS_ERROR')
  }
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  let cleanedCount = 0

  for (const [identifier, entry] of rateLimitCache.entries()) {
    // Remove expired entries
    if (entry.resetTime <= now && !entry.blocked) {
      rateLimitCache.delete(identifier)
      cleanedCount++
    }
    // Remove expired blocks
    else if (entry.blocked && entry.blockUntil && entry.blockUntil <= now) {
      entry.blocked = false
      entry.blockUntil = undefined
      entry.count = 0
    }
  }

  if (cleanedCount > 0) {
    logger.debug('Cleaned up expired rate limit entries', { cleaned_count: cleanedCount })
  }
}, 60000) // Run every minute
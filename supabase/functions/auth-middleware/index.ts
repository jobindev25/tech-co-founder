import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  generateApiKey,
  hashApiKey
} from '../_shared/utils.ts'

const logger = new Logger('AuthMiddleware')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    logger.info('Auth middleware request', { action, method: req.method })

    const db = DatabaseService.create()

    switch (action) {
      case 'login':
        return await handleLogin(req, db)
      case 'register':
        return await handleRegister(req, db)
      case 'refresh':
        return await handleTokenRefresh(req, db)
      case 'logout':
        return await handleLogout(req, db)
      case 'verify':
        return await handleTokenVerification(req, db)
      case 'generate-api-key':
        return await handleApiKeyGeneration(req, db)
      case 'revoke-api-key':
        return await handleApiKeyRevocation(req, db)
      case 'check-permissions':
        return await handlePermissionCheck(req, db)
      default:
        return createErrorResponse('Invalid action', 400, 'INVALID_ACTION')
    }

  } catch (error) {
    logger.error('Auth middleware failed', error)
    return createErrorResponse(
      'Authentication failed',
      500,
      'AUTH_ERROR'
    )
  }
})

// Handle user login
async function handleLogin(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { email, password, remember_me = false } = await req.json()

    if (!email || !password) {
      return createErrorResponse('Email and password required', 400, 'MISSING_CREDENTIALS')
    }

    // Get user from database
    const { data: user, error: userError } = await db.supabase
      .from('users')
      .select('id, email, password_hash, role, status, last_login_at, failed_login_attempts, locked_until')
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !user) {
      logger.warn('Login attempt for non-existent user', { email })
      return createErrorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      logger.warn('Login attempt for locked account', { email, locked_until: user.locked_until })
      return createErrorResponse('Account temporarily locked', 423, 'ACCOUNT_LOCKED')
    }

    // Check if account is active
    if (user.status !== 'active') {
      logger.warn('Login attempt for inactive account', { email, status: user.status })
      return createErrorResponse('Account not active', 403, 'ACCOUNT_INACTIVE')
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash)
    if (!isValidPassword) {
      // Increment failed login attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1
      const lockUntil = failedAttempts >= 5 
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString() // Lock for 30 minutes
        : null

      await db.supabase
        .from('users')
        .update({ 
          failed_login_attempts: failedAttempts,
          locked_until: lockUntil
        })
        .eq('id', user.id)

      logger.warn('Invalid password attempt', { email, failed_attempts: failedAttempts })
      return createErrorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS')
    }

    // Generate tokens
    const accessToken = await generateJWT({
      user_id: user.id,
      email: user.email,
      role: user.role
    }, '1h')

    const refreshToken = await generateJWT({
      user_id: user.id,
      type: 'refresh'
    }, remember_me ? '30d' : '7d')

    // Update user login info
    await db.supabase
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null
      })
      .eq('id', user.id)

    // Create session record
    const { data: session } = await db.supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + (remember_me ? 30 : 7) * 24 * 60 * 60 * 1000).toISOString(),
        user_agent: req.headers.get('user-agent') || '',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      })
      .select()
      .single()

    logger.info('User logged in successfully', { 
      user_id: user.id, 
      email: user.email,
      session_id: session?.id
    })

    return createJsonResponse({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 1 hour
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        last_login_at: user.last_login_at
      }
    })

  } catch (error) {
    logger.error('Login failed', error)
    return createErrorResponse('Login failed', 500, 'LOGIN_ERROR')
  }
}

// Handle user registration
async function handleRegister(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { email, password, name, company } = await req.json()

    if (!email || !password || !name) {
      return createErrorResponse('Email, password, and name required', 400, 'MISSING_FIELDS')
    }

    // Validate password strength
    if (password.length < 8) {
      return createErrorResponse('Password must be at least 8 characters', 400, 'WEAK_PASSWORD')
    }

    // Check if user already exists
    const { data: existingUser } = await db.supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      return createErrorResponse('User already exists', 409, 'USER_EXISTS')
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const { data: newUser, error: createError } = await db.supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
        company,
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (createError) {
      logger.error('User creation failed', createError)
      return createErrorResponse('Registration failed', 500, 'REGISTRATION_ERROR')
    }

    logger.info('User registered successfully', { 
      user_id: newUser.id, 
      email: newUser.email 
    })

    // Generate initial tokens
    const accessToken = await generateJWT({
      user_id: newUser.id,
      email: newUser.email,
      role: newUser.role
    }, '1h')

    const refreshToken = await generateJWT({
      user_id: newUser.id,
      type: 'refresh'
    }, '7d')

    // Create session
    await db.supabase
      .from('user_sessions')
      .insert({
        user_id: newUser.id,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        user_agent: req.headers.get('user-agent') || '',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      })

    return createJsonResponse({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    })

  } catch (error) {
    logger.error('Registration failed', error)
    return createErrorResponse('Registration failed', 500, 'REGISTRATION_ERROR')
  }
}

// Handle token refresh
async function handleTokenRefresh(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { refresh_token } = await req.json()

    if (!refresh_token) {
      return createErrorResponse('Refresh token required', 400, 'MISSING_TOKEN')
    }

    // Verify refresh token
    const payload = await verifyJWT(refresh_token)
    if (!payload || payload.type !== 'refresh') {
      return createErrorResponse('Invalid refresh token', 401, 'INVALID_TOKEN')
    }

    // Check if session exists and is valid
    const { data: session, error: sessionError } = await db.supabase
      .from('user_sessions')
      .select('id, user_id, expires_at')
      .eq('refresh_token', refresh_token)
      .eq('active', true)
      .single()

    if (sessionError || !session) {
      return createErrorResponse('Invalid session', 401, 'INVALID_SESSION')
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await db.supabase
        .from('user_sessions')
        .update({ active: false })
        .eq('id', session.id)

      return createErrorResponse('Session expired', 401, 'SESSION_EXPIRED')
    }

    // Get user info
    const { data: user } = await db.supabase
      .from('users')
      .select('id, email, role, status')
      .eq('id', session.user_id)
      .single()

    if (!user || user.status !== 'active') {
      return createErrorResponse('User not active', 403, 'USER_INACTIVE')
    }

    // Generate new access token
    const accessToken = await generateJWT({
      user_id: user.id,
      email: user.email,
      role: user.role
    }, '1h')

    logger.info('Token refreshed successfully', { user_id: user.id })

    return createJsonResponse({
      access_token: accessToken,
      expires_in: 3600
    })

  } catch (error) {
    logger.error('Token refresh failed', error)
    return createErrorResponse('Token refresh failed', 500, 'REFRESH_ERROR')
  }
}

// Handle logout
async function handleLogout(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { refresh_token } = await req.json()

    if (refresh_token) {
      // Deactivate session
      await db.supabase
        .from('user_sessions')
        .update({ active: false })
        .eq('refresh_token', refresh_token)
    }

    logger.info('User logged out')

    return createJsonResponse({ logged_out: true })

  } catch (error) {
    logger.error('Logout failed', error)
    return createErrorResponse('Logout failed', 500, 'LOGOUT_ERROR')
  }
}

// Handle token verification
async function handleTokenVerification(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Missing or invalid authorization header', 401, 'MISSING_AUTH')
    }

    const token = authHeader.substring(7)
    const payload = await verifyJWT(token)

    if (!payload) {
      return createErrorResponse('Invalid token', 401, 'INVALID_TOKEN')
    }

    // Get user info
    const { data: user } = await db.supabase
      .from('users')
      .select('id, email, role, status')
      .eq('id', payload.user_id)
      .single()

    if (!user || user.status !== 'active') {
      return createErrorResponse('User not active', 403, 'USER_INACTIVE')
    }

    return createJsonResponse({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    })

  } catch (error) {
    logger.error('Token verification failed', error)
    return createErrorResponse('Token verification failed', 500, 'VERIFICATION_ERROR')
  }
}

// Handle API key generation
async function handleApiKeyGeneration(req: Request, db: DatabaseService): Promise<Response> {
  try {
    // Verify user authentication
    const authResult = await verifyUserAuth(req, db)
    if (!authResult.success) {
      return createErrorResponse(authResult.error, 401, 'UNAUTHORIZED')
    }

    const { name, permissions = [], expires_in_days = 365 } = await req.json()

    if (!name) {
      return createErrorResponse('API key name required', 400, 'MISSING_NAME')
    }

    // Generate API key
    const apiKey = generateApiKey()
    const hashedKey = await hashApiKey(apiKey)

    // Create API key record
    const { data: keyRecord, error: keyError } = await db.supabase
      .from('api_keys')
      .insert({
        user_id: authResult.user.id,
        name,
        key_hash: hashedKey,
        permissions,
        expires_at: new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        last_used_at: null,
        active: true
      })
      .select()
      .single()

    if (keyError) {
      logger.error('API key creation failed', keyError)
      return createErrorResponse('API key creation failed', 500, 'KEY_CREATION_ERROR')
    }

    logger.info('API key generated', { 
      user_id: authResult.user.id, 
      key_id: keyRecord.id,
      name 
    })

    return createJsonResponse({
      api_key: apiKey, // Only returned once
      key_id: keyRecord.id,
      name: keyRecord.name,
      permissions: keyRecord.permissions,
      expires_at: keyRecord.expires_at
    })

  } catch (error) {
    logger.error('API key generation failed', error)
    return createErrorResponse('API key generation failed', 500, 'KEY_GENERATION_ERROR')
  }
}

// Handle API key revocation
async function handleApiKeyRevocation(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const authResult = await verifyUserAuth(req, db)
    if (!authResult.success) {
      return createErrorResponse(authResult.error, 401, 'UNAUTHORIZED')
    }

    const { key_id } = await req.json()

    if (!key_id) {
      return createErrorResponse('API key ID required', 400, 'MISSING_KEY_ID')
    }

    // Revoke API key
    const { error: revokeError } = await db.supabase
      .from('api_keys')
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq('id', key_id)
      .eq('user_id', authResult.user.id)

    if (revokeError) {
      logger.error('API key revocation failed', revokeError)
      return createErrorResponse('API key revocation failed', 500, 'REVOCATION_ERROR')
    }

    logger.info('API key revoked', { 
      user_id: authResult.user.id, 
      key_id 
    })

    return createJsonResponse({ revoked: true })

  } catch (error) {
    logger.error('API key revocation failed', error)
    return createErrorResponse('API key revocation failed', 500, 'REVOCATION_ERROR')
  }
}

// Handle permission check
async function handlePermissionCheck(req: Request, db: DatabaseService): Promise<Response> {
  try {
    const { resource, action, project_id } = await req.json()

    if (!resource || !action) {
      return createErrorResponse('Resource and action required', 400, 'MISSING_PARAMS')
    }

    const authResult = await verifyUserAuth(req, db)
    if (!authResult.success) {
      return createErrorResponse(authResult.error, 401, 'UNAUTHORIZED')
    }

    const hasPermission = await checkUserPermission(
      db, 
      authResult.user.id, 
      resource, 
      action, 
      project_id
    )

    return createJsonResponse({
      has_permission: hasPermission,
      user_id: authResult.user.id,
      resource,
      action,
      project_id
    })

  } catch (error) {
    logger.error('Permission check failed', error)
    return createErrorResponse('Permission check failed', 500, 'PERMISSION_ERROR')
  }
}

// Verify user authentication
async function verifyUserAuth(req: Request, db: DatabaseService): Promise<any> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing authorization header' }
    }

    const token = authHeader.substring(7)
    const payload = await verifyJWT(token)

    if (!payload) {
      return { success: false, error: 'Invalid token' }
    }

    const { data: user } = await db.supabase
      .from('users')
      .select('id, email, role, status')
      .eq('id', payload.user_id)
      .single()

    if (!user || user.status !== 'active') {
      return { success: false, error: 'User not active' }
    }

    return { success: true, user }

  } catch (error) {
    return { success: false, error: 'Authentication failed' }
  }
}

// Check user permission for resource/action
async function checkUserPermission(
  db: DatabaseService,
  userId: string,
  resource: string,
  action: string,
  projectId?: string
): Promise<boolean> {
  try {
    // Get user role
    const { data: user } = await db.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (!user) return false

    // Admin has all permissions
    if (user.role === 'admin') return true

    // Check project-specific permissions
    if (projectId) {
      const { data: projectAccess } = await db.supabase
        .from('project_access')
        .select('permissions')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .single()

      if (projectAccess) {
        const permissions = projectAccess.permissions || []
        return permissions.includes(`${resource}:${action}`) || permissions.includes(`${resource}:*`)
      }
    }

    // Check general role-based permissions
    const rolePermissions: Record<string, string[]> = {
      user: [
        'project:read',
        'project:create',
        'conversation:read',
        'conversation:create'
      ],
      premium: [
        'project:read',
        'project:create',
        'project:update',
        'conversation:read',
        'conversation:create',
        'build:trigger'
      ],
      admin: ['*:*'] // All permissions
    }

    const userPermissions = rolePermissions[user.role] || []
    return userPermissions.includes(`${resource}:${action}`) || 
           userPermissions.includes(`${resource}:*`) ||
           userPermissions.includes('*:*')

  } catch (error) {
    logger.error('Permission check failed', error)
    return false
  }
}
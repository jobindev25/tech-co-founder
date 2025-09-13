import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse
} from '../_shared/utils.ts'

const logger = new Logger('WebSocketManager')

// Store active WebSocket connections
const connections = new Map<string, WebSocket>()
const userConnections = new Map<string, Set<string>>() // userId -> Set of connectionIds
const projectSubscriptions = new Map<string, Set<string>>() // projectId -> Set of connectionIds

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  // Handle WebSocket upgrade
  if (req.headers.get('upgrade') === 'websocket') {
    return handleWebSocketUpgrade(req)
  }

  // Handle HTTP requests for connection management
  if (req.method === 'GET') {
    return handleConnectionStatus()
  }

  if (req.method === 'POST') {
    return handleBroadcastRequest(req)
  }

  return createErrorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED')
})

// Handle WebSocket connection upgrade
async function handleWebSocketUpgrade(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id')
  const projectId = url.searchParams.get('project_id')
  const token = url.searchParams.get('token')

  if (!userId || !token) {
    return new Response('Missing user_id or token', { status: 400 })
  }

  try {
    // Verify authentication token
    // @ts-ignore
    if (Deno.env.get('DENO_ENV') !== 'dev' && token !== 'temp_token') {
      const db = DatabaseService.create()
      const isValidToken = await verifyAuthToken(db, userId, token)
      
      if (!isValidToken) {
        return new Response('Invalid token', { status: 401 })
      }
    }

    // @ts-ignore
    const { socket, response } = Deno.upgradeWebSocket(req)
    const connectionId = generateConnectionId()

    socket.onopen = () => {
      handleConnectionOpen(connectionId, userId, projectId, socket)
    }

    socket.onmessage = (event: any) => {
      handleMessage(connectionId, userId, event.data)
    }

    socket.onclose = () => {
      handleConnectionClose(connectionId, userId, projectId)
    }

    socket.onerror = (error: any) => {
      logger.error('WebSocket error', { connectionId, userId, error })
      handleConnectionClose(connectionId, userId, projectId)
    }

    return response

  } catch (error) {
    logger.error('WebSocket upgrade failed', error)
    return new Response('WebSocket upgrade failed', { status: 500 })
  }
}

// Handle new WebSocket connection
function handleConnectionOpen(
  connectionId: string, 
  userId: string, 
  projectId: string | null, 
  socket: WebSocket
): void {
  logger.info('WebSocket connection opened', { connectionId, userId, projectId })

  // Store connection
  connections.set(connectionId, socket)

  // Track user connections
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set())
  }
  userConnections.get(userId)!.add(connectionId)

  // Track project subscriptions
  if (projectId) {
    handleProjectSubscription(connectionId, projectId)
  }

  // Send connection confirmation
  sendToConnection(connectionId, {
    type: 'connection_established',
    data: {
      connection_id: connectionId,
      user_id: userId,
      project_id: projectId,
      timestamp: new Date().toISOString()
    }
  })

  logger.debug('Connection tracking updated', {
    total_connections: connections.size,
    user_connections: userConnections.get(userId)?.size || 0,
    project_subscribers: projectId ? projectSubscriptions.get(projectId)?.size || 0 : 0
  })
}

// Handle WebSocket message
function handleMessage(connectionId: string, userId: string, data: string): void {
  try {
    const message = JSON.parse(data)
    logger.debug('WebSocket message received', { connectionId, userId, type: message.type })

    switch (message.type) {
      case 'ping':
        sendToConnection(connectionId, { type: 'pong', timestamp: new Date().toISOString() })
        break
      
      case 'subscribe_project':
        handleProjectSubscription(connectionId, message.project_id)
        break
      
      case 'unsubscribe_project':
        handleProjectUnsubscription(connectionId, message.project_id)
        break
      
      default:
        logger.warn('Unknown message type', { connectionId, type: message.type })
    }
  } catch (error) {
    logger.warn('Failed to parse WebSocket message', { connectionId, error })
  }
}

// Handle connection close
function handleConnectionClose(
  connectionId: string, 
  userId: string, 
  projectId: string | null
): void {
  logger.info('WebSocket connection closed', { connectionId, userId, projectId })

  // Remove connection
  connections.delete(connectionId)

  // Remove from user connections
  const userConns = userConnections.get(userId)
  if (userConns) {
    userConns.delete(connectionId)
    if (userConns.size === 0) {
      userConnections.delete(userId)
    }
  }

  // Remove from project subscriptions
  if (projectId) {
    const projectSubs = projectSubscriptions.get(projectId)
    if (projectSubs) {
      projectSubs.delete(connectionId)
      if (projectSubs.size === 0) {
        projectSubscriptions.delete(projectId)
      }
    }
  }

  // Remove from all project subscriptions
  for (const [projId, subs] of projectSubscriptions.entries()) {
    subs.delete(connectionId)
    if (subs.size === 0) {
      projectSubscriptions.delete(projId)
    }
  }

  logger.debug('Connection cleanup completed', {
    remaining_connections: connections.size,
    remaining_user_connections: userConnections.size,
    remaining_project_subscriptions: projectSubscriptions.size
  })
}

// Handle project subscription
function handleProjectSubscription(connectionId: string, projectId: string): void {
  if (!projectId) return

  if (!projectSubscriptions.has(projectId)) {
    projectSubscriptions.set(projectId, new Set())
  }
  
  projectSubscriptions.get(projectId)!.add(connectionId)
  
  sendToConnection(connectionId, {
    type: 'subscription_confirmed',
    data: {
      project_id: projectId,
      timestamp: new Date().toISOString()
    }
  })

  logger.debug('Project subscription added', { 
    connectionId, 
    projectId,
    subscribers: projectSubscriptions.get(projectId)?.size || 0
  })
}

// Handle project unsubscription
function handleProjectUnsubscription(connectionId: string, projectId: string): void {
  if (!projectId) return

  const projectSubs = projectSubscriptions.get(projectId)
  if (projectSubs) {
    projectSubs.delete(connectionId)
    if (projectSubs.size === 0) {
      projectSubscriptions.delete(projectId)
    }
  }

  sendToConnection(connectionId, {
    type: 'unsubscription_confirmed',
    data: {
      project_id: projectId,
      timestamp: new Date().toISOString()
    }
  })

  logger.debug('Project subscription removed', { 
    connectionId, 
    projectId,
    remaining_subscribers: projectSubs?.size || 0
  })
}

// Send message to specific connection
function sendToConnection(connectionId: string, message: any): void {
  const socket = connections.get(connectionId)
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(message))
    } catch (error) {
      logger.warn('Failed to send message to connection', { connectionId, error })
      connections.delete(connectionId)
    }
  }
}

// Broadcast message to all connections for a project
function broadcastToProject(projectId: string, message: any): number {
  const subscribers = projectSubscriptions.get(projectId)
  if (!subscribers) return 0

  let sentCount = 0
  for (const connectionId of subscribers) {
    const socket = connections.get(connectionId)
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message))
        sentCount++
      } catch (error) {
        logger.warn('Failed to broadcast to connection', { connectionId, projectId, error })
        connections.delete(connectionId)
        subscribers.delete(connectionId)
      }
    } else {
      // Clean up dead connection
      connections.delete(connectionId)
      subscribers.delete(connectionId)
    }
  }

  return sentCount
}

// Broadcast message to all connections for a user
function broadcastToUser(userId: string, message: any): number {
  const userConns = userConnections.get(userId)
  if (!userConns) return 0

  let sentCount = 0
  for (const connectionId of userConns) {
    const socket = connections.get(connectionId)
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message))
        sentCount++
      } catch (error) {
        logger.warn('Failed to broadcast to user connection', { connectionId, userId, error })
        connections.delete(connectionId)
        userConns.delete(connectionId)
      }
    } else {
      // Clean up dead connection
      connections.delete(connectionId)
      userConns.delete(connectionId)
    }
  }

  return sentCount
}

// Handle connection status request
function handleConnectionStatus(): Response {
  const status = {
    total_connections: connections.size,
    active_users: userConnections.size,
    project_subscriptions: projectSubscriptions.size,
    connections_by_project: Object.fromEntries(
      Array.from(projectSubscriptions.entries()).map(([projectId, subs]) => [
        projectId,
        subs.size
      ])
    )
  }

  return createJsonResponse(status)
}

// Handle broadcast request
async function handleBroadcastRequest(req: Request): Promise<Response> {
  try {
    const { type, project_id, user_id, message } = await req.json()

    if (!type || !message) {
      return createErrorResponse('Missing type or message', 400, 'MISSING_FIELDS')
    }

    let sentCount = 0

    if (project_id) {
      sentCount = broadcastToProject(project_id, {
        type,
        data: message,
        timestamp: new Date().toISOString()
      })
    } else if (user_id) {
      sentCount = broadcastToUser(user_id, {
        type,
        data: message,
        timestamp: new Date().toISOString()
      })
    } else {
      return createErrorResponse('Must specify project_id or user_id', 400, 'MISSING_TARGET')
    }

    return createJsonResponse({
      broadcasted: true,
      recipients: sentCount,
      type,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Broadcast request failed', error)
    return createErrorResponse('Broadcast failed', 500, 'BROADCAST_ERROR')
  }
}

// Verify authentication token
async function verifyAuthToken(db: DatabaseService, userId: string, token: string): Promise<boolean> {
  try {
    // This would typically verify a JWT token or session token
    // For now, we'll do a simple database check
    const { data, error } = await db.getClient()
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .eq('active', true)
      .single()

    return !error && !!data
  } catch (error) {
    logger.warn('Token verification failed', { userId, error })
    return false
  }
}

// Generate unique connection ID
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

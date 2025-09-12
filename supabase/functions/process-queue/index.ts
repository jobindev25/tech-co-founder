import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DatabaseService } from '../_shared/database.ts'
import { 
  Logger, 
  createCorsHeaders, 
  createJsonResponse, 
  createErrorResponse,
  retryWithBackoff,
  PerformanceMonitor,
  delay
} from '../_shared/utils.ts'
import { QueueTask, TaskType, TaskStatus } from '../_shared/types.ts'

const logger = new Logger('ProcessQueue')

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders() })
  }

  const monitor = new PerformanceMonitor(logger)
  
  try {
    const { batch_size = 5, max_concurrent = 3 } = await req.json().catch(() => ({}))
    
    logger.info('Starting queue processing', { batch_size, max_concurrent })

    const db = DatabaseService.create()
    monitor.mark('db_initialized')

    // Check if queue processing is enabled
    const queueEnabled = await db.config.getConfig('queue_processing_enabled')
    if (queueEnabled === 'false') {
      logger.info('Queue processing disabled')
      return createJsonResponse({ 
        processed: 0, 
        message: 'Queue processing disabled' 
      })
    }

    // Get pending tasks with priority ordering
    const pendingTasks = await db.queue.getPendingTasks(batch_size)
    
    if (pendingTasks.length === 0) {
      logger.info('No pending tasks found')
      return createJsonResponse({ 
        processed: 0, 
        message: 'No pending tasks' 
      })
    }

    monitor.mark('tasks_retrieved')
    
    logger.info('Processing tasks', { 
      task_count: pendingTasks.length,
      task_types: pendingTasks.map(t => t.task_type)
    })

    // Process tasks with concurrency control
    const results = await processConcurrentTasks(db, pendingTasks, max_concurrent)
    
    monitor.mark('tasks_processed')

    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    const totalTime = monitor.getTotalTime()
    logger.info('Queue processing completed', {
      total_tasks: pendingTasks.length,
      successful,
      failed,
      total_time_ms: totalTime.toFixed(2),
      metrics: monitor.getMetrics()
    })

    return createJsonResponse({
      processed: pendingTasks.length,
      successful,
      failed,
      processing_time_ms: totalTime,
      next_batch_available: await hasMoreTasks(db)
    })

  } catch (error) {
    const totalTime = monitor.getTotalTime()
    logger.error('Queue processing failed', error, { 
      total_time_ms: totalTime.toFixed(2) 
    })
    return createErrorResponse(
      'Queue processing failed',
      500,
      'QUEUE_PROCESSING_ERROR'
    )
  }
})

// Process tasks with concurrency control
async function processConcurrentTasks(
  db: DatabaseService, 
  tasks: QueueTask[], 
  maxConcurrent: number
): Promise<PromiseSettledResult<any>[]> {
  const results: PromiseSettledResult<any>[] = []
  
  // Process tasks in batches to control concurrency
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent)
    
    logger.debug('Processing batch', { 
      batch_start: i,
      batch_size: batch.length,
      task_ids: batch.map(t => t.id)
    })
    
    const batchPromises = batch.map(task => processTask(db, task))
    const batchResults = await Promise.allSettled(batchPromises)
    
    results.push(...batchResults)
    
    // Small delay between batches to prevent overwhelming the system
    if (i + maxConcurrent < tasks.length) {
      await delay(100)
    }
  }
  
  return results
}

// Process individual task
async function processTask(db: DatabaseService, task: QueueTask): Promise<any> {
  const taskLogger = new Logger(`Task-${task.id}`)
  const taskMonitor = new PerformanceMonitor(taskLogger)
  
  try {
    taskLogger.info('Processing task', {
      task_id: task.id,
      task_type: task.task_type,
      priority: task.priority,
      retry_count: task.retry_count
    })

    // Mark task as processing
    await db.queue.updateTaskStatus(task.id, 'processing')
    taskMonitor.mark('task_started')

    // Execute task based on type
    const result = await executeTask(db, task)
    taskMonitor.mark('task_executed')

    // Mark task as completed
    await db.queue.updateTaskStatus(task.id, 'completed')
    
    const executionTime = taskMonitor.getTotalTime()
    taskLogger.info('Task completed successfully', {
      task_id: task.id,
      execution_time_ms: executionTime.toFixed(2),
      result_summary: summarizeResult(result)
    })

    return result

  } catch (error) {
    const executionTime = taskMonitor.getTotalTime()
    taskLogger.error('Task failed', error, {
      task_id: task.id,
      execution_time_ms: executionTime.toFixed(2)
    })

    // Handle task failure
    await handleTaskFailure(db, task, error)
    throw error
  }
}

// Execute task based on its type
async function executeTask(db: DatabaseService, task: QueueTask): Promise<any> {
  const { task_type, task_data } = task
  
  switch (task_type) {
    case 'analyze_conversation':
      return await executeAnalyzeConversation(task_data)
    
    case 'generate_plan':
      return await executeGeneratePlan(task_data)
    
    case 'trigger_build':
      return await executeTriggerBuild(task_data)
    
    case 'process_webhook':
      return await executeProcessWebhook(task_data)
    
    case 'send_notification':
      return await executeSendNotification(task_data)
    
    default:
      throw new Error(`Unknown task type: ${task_type}`)
  }
}

// Execute conversation analysis task
async function executeAnalyzeConversation(taskData: any): Promise<any> {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-conversation`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Analyze conversation failed: ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

// Execute project plan generation task
async function executeGeneratePlan(taskData: any): Promise<any> {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-project-plan`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Generate plan failed: ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

// Execute Kiro build trigger task
async function executeTriggerBuild(taskData: any): Promise<any> {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/trigger-kiro-build`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Trigger build failed: ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

// Execute webhook processing task
async function executeProcessWebhook(taskData: any): Promise<any> {
  // This would handle any webhook processing that needs to be queued
  logger.info('Processing webhook task', { taskData })
  return { processed: true }
}

// Execute notification sending task
async function executeSendNotification(taskData: any): Promise<any> {
  // This would handle sending notifications (email, SMS, etc.)
  logger.info('Sending notification', { taskData })
  return { sent: true }
}

// Handle task failure with retry logic
async function handleTaskFailure(
  db: DatabaseService, 
  task: QueueTask, 
  error: Error
): Promise<void> {
  const maxRetries = 3
  const retryCount = task.retry_count || 0
  
  if (retryCount >= maxRetries) {
    // Mark as permanently failed
    await db.queue.updateTaskStatus(task.id, 'failed')
    logger.error('Task permanently failed after max retries', {
      task_id: task.id,
      retry_count: retryCount,
      error: error.message
    })
    return
  }
  
  // Calculate retry delay with exponential backoff
  const baseDelay = 5000 // 5 seconds
  const retryDelay = baseDelay * Math.pow(2, retryCount)
  const nextRetryAt = new Date(Date.now() + retryDelay)
  
  // Update task for retry
  await db.queue.updateTask(task.id, {
    status: 'pending',
    retry_count: retryCount + 1,
    error_message: error.message,
    next_retry_at: nextRetryAt.toISOString(),
    metadata: {
      ...task.metadata,
      last_error: error.message,
      last_failure_at: new Date().toISOString()
    }
  })
  
  logger.info('Task scheduled for retry', {
    task_id: task.id,
    retry_count: retryCount + 1,
    next_retry_at: nextRetryAt.toISOString(),
    retry_delay_ms: retryDelay
  })
}

// Check if there are more tasks to process
async function hasMoreTasks(db: DatabaseService): Promise<boolean> {
  try {
    const { data, error } = await db.supabase
      .from('processing_queue')
      .select('id')
      .eq('status', 'pending')
      .limit(1)
    
    if (error) {
      logger.warn('Error checking for more tasks', error)
      return false
    }
    
    return data && data.length > 0
  } catch (error) {
    logger.warn('Error checking for more tasks', error)
    return false
  }
}

// Summarize task result for logging
function summarizeResult(result: any): string {
  if (!result) return 'No result'
  
  if (typeof result === 'object') {
    const keys = Object.keys(result)
    if (keys.length === 0) return 'Empty object'
    
    const summary = keys.slice(0, 3).map(key => {
      const value = result[key]
      if (typeof value === 'string') {
        return `${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`
      }
      return `${key}: ${typeof value}`
    }).join(', ')
    
    return keys.length > 3 ? `${summary}, +${keys.length - 3} more` : summary
  }
  
  return String(result).substring(0, 100)
}
# Automated Development Pipeline API Documentation

This document provides comprehensive API documentation for the Automated Development Pipeline system.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Core Pipeline APIs](#core-pipeline-apis)
4. [Webhook APIs](#webhook-apis)
5. [Monitoring APIs](#monitoring-apis)
6. [Security APIs](#security-apis)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Examples](#examples)

## Overview

The Automated Development Pipeline provides a set of Edge Functions that automate the process of converting conversations into deployed applications. The system integrates with Tavus for conversation management and Kiro for application building.

**Base URL:** `https://your-project.supabase.co/functions/v1`

**Content Type:** `application/json`

**Authentication:** Bearer token or API key

## Authentication

### Bearer Token Authentication

Include the authorization header in your requests:

```http
Authorization: Bearer <your-access-token>
```

### API Key Authentication

Alternatively, use an API key:

```http
X-API-Key: <your-api-key>
```

### Getting Access Tokens

**POST** `/auth-middleware?action=login`

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expires_in": 3600,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "user"
  }
}
```

## Core Pipeline APIs

### 1. Conversation Analysis

Analyzes a conversation transcript and creates a project record.

**POST** `/analyze-conversation`

**Request Body:**
```json
{
  "conversation_id": "conv_123",
  "transcript_url": "https://api.tavus.io/transcripts/123",
  "summary": "Optional conversation summary",
  "metadata": {
    "duration_seconds": 1800,
    "participant_count": 2
  }
}
```

**Response:**
```json
{
  "project_id": 42,
  "project_name": "E-commerce Platform",
  "status": "analysis_complete",
  "analysis_summary": {
    "requirements_count": 8,
    "features_count": 12,
    "complexity": "medium",
    "timeline": "2-3 weeks"
  }
}
```

### 2. Project Plan Generation

Generates a detailed project plan from conversation analysis.

**POST** `/generate-project-plan`

**Request Body:**
```json
{
  "project_id": 42,
  "analysis": {
    "projectName": "E-commerce Platform",
    "description": "A modern e-commerce platform...",
    "requirements": ["User authentication", "Product catalog"],
    "features": ["Shopping cart", "Payment processing"],
    "preferences": {
      "techStack": ["React", "Node.js"],
      "timeline": "2-3 weeks",
      "complexity": "medium"
    }
  }
}
```

**Response:**
```json
{
  "project_id": 42,
  "plan_generated": true,
  "plan_summary": {
    "tech_stack": {
      "frontend": ["React", "TypeScript"],
      "backend": ["Node.js", "Express"],
      "database": "PostgreSQL"
    },
    "estimated_hours": 120,
    "features_count": 12,
    "components_count": 8
  }
}
```

### 3. Build Trigger

Triggers a Kiro build for a project.

**POST** `/trigger-kiro-build`

**Request Body:**
```json
{
  "project_id": 42,
  "project_plan": {
    "name": "E-commerce Platform",
    "description": "A modern e-commerce platform",
    "techStack": {
      "frontend": ["React", "TypeScript"],
      "backend": ["Node.js", "Express"],
      "database": "PostgreSQL"
    },
    "features": [...],
    "kiroConfig": {
      "projectType": "web-application",
      "buildSettings": {...},
      "webhookSettings": {
        "url": "https://your-project.supabase.co/functions/v1/kiro-webhook",
        "events": ["build_started", "build_progress", "build_completed", "build_failed"]
      }
    }
  }
}
```

**Response:**
```json
{
  "build_triggered": true,
  "kiro_build_id": "build_abc123",
  "kiro_project_id": "proj_xyz789",
  "estimated_completion": "2024-01-15T14:30:00Z",
  "webhook_configured": true
}
```

### 4. Queue Processing

Processes queued tasks in the pipeline.

**POST** `/process-queue`

**Request Body:**
```json
{
  "batch_size": 5,
  "max_concurrent": 3
}
```

**Response:**
```json
{
  "processed": 5,
  "successful": 4,
  "failed": 1,
  "processing_time_ms": 2500,
  "next_batch_available": true
}
```

## Webhook APIs

### 1. Tavus Webhook

Receives webhook events from Tavus when conversations end.

**POST** `/tavus-webhook`

**Headers:**
```http
X-Tavus-Signature: sha256=abc123...
X-Tavus-Timestamp: 1640995200
```

**Request Body:**
```json
{
  "event_type": "conversation_ended",
  "conversation_id": "conv_123",
  "data": {
    "transcript_url": "https://api.tavus.io/transcripts/123",
    "summary": "Discussion about building an e-commerce platform",
    "duration_seconds": 1800,
    "participant_count": 2
  }
}
```

**Response:**
```json
{
  "received": true,
  "conversation_id": "conv_123",
  "event_processed": "conversation_ended",
  "request_id": "tavus_webhook_1640995200_abc123",
  "timestamp": "2024-01-15T12:00:00Z",
  "processing_time_ms": 150
}
```

### 2. Kiro Webhook

Receives build status updates from Kiro.

**POST** `/kiro-webhook`

**Headers:**
```http
X-Kiro-Signature: sha256=def456...
X-Kiro-Timestamp: 1640995200
X-Kiro-Webhook-Id: webhook_789
```

**Request Body:**
```json
{
  "build_id": "build_abc123",
  "project_id": "proj_xyz789",
  "event_type": "build.progress",
  "data": {
    "progress": 75,
    "current_step": "Deploying application",
    "estimated_completion": "2024-01-15T14:30:00Z"
  },
  "timestamp": "2024-01-15T14:15:00Z"
}
```

**Response:**
```json
{
  "received": true,
  "project_id": 42,
  "event_processed": "build.progress",
  "request_id": "kiro_webhook_1640995200_def456",
  "timestamp": "2024-01-15T14:15:00Z",
  "processing_time_ms": 200
}
```

## Monitoring APIs

### 1. System Monitor

Provides system health and metrics information.

**GET** `/system-monitor?action=health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 25
    },
    "queue": {
      "status": "healthy",
      "pending_tasks": 5,
      "processing_tasks": 2
    },
    "api": {
      "status": "healthy",
      "recent_requests": 150,
      "avg_response_time": 250
    }
  }
}
```

**GET** `/system-monitor?action=metrics&timeframe=24h`

**Response:**
```json
{
  "timeframe": "24h",
  "start_time": "2024-01-14T12:00:00Z",
  "end_time": "2024-01-15T12:00:00Z",
  "projects": {
    "total_created": 25,
    "by_status": {
      "completed": 18,
      "building": 3,
      "failed": 2,
      "analyzing": 2
    }
  },
  "conversations": {
    "total_processed": 30,
    "avg_duration": 1200
  },
  "builds": {
    "total_events": 150,
    "unique_projects": 25
  }
}
```

### 2. Performance Dashboard

Provides performance metrics and analytics.

**GET** `/performance-dashboard?timeframe=1h`

**Response:**
```json
{
  "timeframe": "1h",
  "api_performance": {
    "analyze-conversation": {
      "total_requests": 15,
      "avg_response_time_ms": 2500,
      "success_rate": 0.93,
      "error_rate": 0.07
    }
  },
  "database_performance": {
    "slow_queries_count": 2,
    "slowest_queries": [...]
  },
  "queue_performance": {
    "analyze_conversation": {
      "total_tasks": 15,
      "avg_wait_time_ms": 500,
      "avg_processing_time_ms": 2000
    }
  }
}
```

## Security APIs

### 1. Rate Limiter

Checks and manages rate limits.

**POST** `/rate-limiter?action=check`

**Request Body:**
```json
{
  "identifier": "user_123",
  "rule_name": "api_general",
  "user_id": "user_123",
  "endpoint": "/analyze-conversation",
  "increment": true
}
```

**Response:**
```json
{
  "allowed": true,
  "rule": "General API",
  "limit": 100,
  "remaining": 85,
  "reset_time": 1640995800,
  "retry_after": null
}
```

### 2. Audit Logger

Logs and queries audit events.

**POST** `/audit-logger?action=log`

**Request Body:**
```json
{
  "user_id": "user_123",
  "action": "project_created",
  "resource_type": "project",
  "resource_id": "42",
  "success": true,
  "details": {
    "project_name": "E-commerce Platform"
  }
}
```

**Response:**
```json
{
  "logged": true,
  "log_id": 789,
  "timestamp": "2024-01-15T12:00:00Z"
}
```

**POST** `/audit-logger?action=query`

**Request Body:**
```json
{
  "user_id": "user_123",
  "action": "project_created",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-15T23:59:59Z",
  "limit": 50,
  "offset": 0
}
```

**Response:**
```json
{
  "logs": [
    {
      "id": 789,
      "user_id": "user_123",
      "action": "project_created",
      "resource_type": "project",
      "resource_id": "42",
      "success": true,
      "timestamp": "2024-01-15T12:00:00Z",
      "details": {...}
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

## Real-time APIs

### 1. WebSocket Manager

Manages WebSocket connections for real-time updates.

**WebSocket Connection:**
```
wss://your-project.supabase.co/functions/v1/websocket-manager?user_id=user_123&token=abc123
```

**Connection Messages:**
```json
{
  "type": "subscribe_project",
  "project_id": "42"
}
```

**Received Messages:**
```json
{
  "type": "kiro_update",
  "project_id": 42,
  "event_type": "build_progress",
  "data": {
    "progress": 75,
    "current_step": "Deploying application"
  },
  "timestamp": "2024-01-15T14:15:00Z"
}
```

### 2. Broadcast Events

Broadcasts events to subscribed clients.

**POST** `/broadcast-events`

**Request Body:**
```json
{
  "event_type": "project_status_changed",
  "event_data": {
    "project_id": 42,
    "old_status": "building",
    "new_status": "completed"
  },
  "project_id": 42,
  "message": "Project build completed successfully",
  "channel": "project_updates"
}
```

**Response:**
```json
{
  "event_id": 456,
  "broadcasted": true,
  "channel": "project_updates",
  "timestamp": "2024-01-15T14:30:00Z",
  "subscribers_notified": 5
}
```

## Error Handling

All APIs return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "context": {
    "additional": "context"
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400) - Invalid request data
- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `RATE_LIMIT_EXCEEDED` (429) - Rate limit exceeded
- `INTERNAL_ERROR` (500) - Server error

## Rate Limiting

Rate limits are applied per user/IP address:

- **General API**: 100 requests per minute
- **Authentication**: 10 requests per minute
- **Conversation Creation**: 5 requests per minute
- **Build Trigger**: 3 requests per 5 minutes

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1640995800
```

## Examples

### Complete Pipeline Flow

1. **Conversation ends** (Tavus webhook triggers pipeline)
2. **Analyze conversation** (Extract requirements and features)
3. **Generate project plan** (Create detailed technical plan)
4. **Trigger build** (Send plan to Kiro for building)
5. **Monitor progress** (Receive build updates via webhook)
6. **Notify completion** (Broadcast completion to clients)

### Example: Manual Project Creation

```javascript
// 1. Analyze conversation
const analysisResponse = await fetch('/functions/v1/analyze-conversation', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversation_id: 'conv_123',
    transcript_url: 'https://api.tavus.io/transcripts/123'
  })
});

const { project_id } = await analysisResponse.json();

// 2. Check project status
const statusResponse = await fetch(`/functions/v1/system-monitor?action=project&id=${project_id}`, {
  headers: { 'Authorization': 'Bearer ' + accessToken }
});

const projectStatus = await statusResponse.json();

// 3. Trigger build when ready
if (projectStatus.status === 'ready_to_build') {
  const buildResponse = await fetch('/functions/v1/trigger-kiro-build', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: project_id
    })
  });
  
  const buildResult = await buildResponse.json();
  console.log('Build triggered:', buildResult.kiro_build_id);
}
```

### Example: Real-time Updates

```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket(`wss://your-project.supabase.co/functions/v1/websocket-manager?user_id=${userId}&token=${accessToken}`);

ws.onopen = () => {
  // Subscribe to project updates
  ws.send(JSON.stringify({
    type: 'subscribe_project',
    project_id: projectId
  }));
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  if (update.type === 'kiro_update') {
    console.log(`Build progress: ${update.data.progress}%`);
    console.log(`Current step: ${update.data.current_step}`);
  }
};
```

## SDK and Client Libraries

### JavaScript/TypeScript SDK

```bash
npm install @your-org/pipeline-sdk
```

```javascript
import { PipelineClient } from '@your-org/pipeline-sdk';

const client = new PipelineClient({
  baseUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'your-api-key'
});

// Analyze conversation
const project = await client.analyzeConversation({
  conversationId: 'conv_123',
  transcriptUrl: 'https://api.tavus.io/transcripts/123'
});

// Subscribe to real-time updates
client.subscribe('project_updates', project.id, (update) => {
  console.log('Project update:', update);
});
```

### Python SDK

```bash
pip install pipeline-sdk
```

```python
from pipeline_sdk import PipelineClient

client = PipelineClient(
    base_url='https://your-project.supabase.co/functions/v1',
    api_key='your-api-key'
)

# Analyze conversation
project = client.analyze_conversation(
    conversation_id='conv_123',
    transcript_url='https://api.tavus.io/transcripts/123'
)

# Monitor project status
status = client.get_project_status(project.id)
print(f"Project status: {status.status}")
```

---

For more information, see the [Developer Guide](./developer-guide.md) and [Troubleshooting Guide](./troubleshooting-guide.md).
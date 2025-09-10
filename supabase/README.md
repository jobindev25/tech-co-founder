# Supabase Edge Functions Setup

This directory contains the Supabase Edge Functions for the Tech Co-Founder application.

## 🚀 Functions Overview

### 1. `create-conversation`
- **Purpose**: Creates new Tavus conversations and stores them in the database
- **Endpoint**: `https://your-project.supabase.co/functions/v1/create-conversation`
- **Method**: POST
- **Body**: `{ "conversation_name": "optional name" }`

### 2. `tavus-webhook`
- **Purpose**: Handles Tavus webhook events and updates conversation status
- **Endpoint**: `https://your-project.supabase.co/functions/v1/tavus-webhook`
- **Method**: POST
- **Used by**: Tavus API for sending webhook events

### 3. `get-conversations`
- **Purpose**: Retrieves all stored conversations
- **Endpoint**: `https://your-project.supabase.co/functions/v1/get-conversations`
- **Method**: GET

## 📋 Setup Instructions

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link to your project
```bash
supabase link --project-ref your-project-ref
```

### 4. Set Environment Variables
In your Supabase dashboard, go to Settings > Edge Functions and add:

```
TAVUS_API_KEY=your_tavus_api_key
TAVUS_DEFAULT_PERSONA_ID=your_persona_id
TAVUS_DEFAULT_REPLICA_ID=your_replica_id
```

### 5. Deploy Functions
```bash
# Deploy all functions
supabase functions deploy

# Or deploy individual functions
supabase functions deploy create-conversation
supabase functions deploy tavus-webhook
supabase functions deploy get-conversations
```

### 6. Update Tavus Webhook URL
In your Tavus dashboard, update the webhook URL to:
```
https://your-project.supabase.co/functions/v1/tavus-webhook
```

## 🧪 Testing Functions

### Test create-conversation locally:
```bash
supabase functions serve

# In another terminal:
curl -X POST http://localhost:54321/functions/v1/create-conversation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{"conversation_name": "Test Session"}'
```

### Test get-conversations:
```bash
curl http://localhost:54321/functions/v1/get-conversations \
  -H "Authorization: Bearer your-anon-key"
```

## 🔧 Environment Variables

The functions automatically have access to:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

You need to add:
- `TAVUS_API_KEY` - Your Tavus API key
- `TAVUS_DEFAULT_PERSONA_ID` - Your Tavus persona ID
- `TAVUS_DEFAULT_REPLICA_ID` - Your Tavus replica ID

## 📊 Database Schema

Make sure you have run the SQL schema from `../backend/supabase-schema.sql` in your Supabase SQL editor to create the required tables:
- `conversations`
- `conversation_events`

## 🔗 Frontend Integration

Update your frontend environment variables:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The frontend will now call the Edge Functions instead of the Express.js backend.
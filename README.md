# Tech Co-Founder Landing Page

A modern, responsive landing page for an AI Tech Co-Founder service with integrated Tavus video conversations.

## 🚀 Features

- **Modern React Frontend**: Built with React, Vite, and styled-components
- **Tavus Video Integration**: AI-powered video conversations with your tech co-founder
- **Responsive Design**: Mobile-first approach with smooth animations
- **Accessibility**: WCAG AA compliant with proper semantic HTML
- **Component Library**: Reusable, well-tested components
- **Express Backend**: RESTful API for Tavus integration

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- Styled Components
- Framer Motion
- React Icons
- Vitest (Testing)

### Backend (Serverless)
- Supabase Edge Functions (Deno runtime)
- Supabase Database (PostgreSQL)
- Tavus API Integration
- Real-time webhooks

## 📁 Project Structure

```
tech-co-founder/
├── tech-cofounder-landing/     # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── styles/            # Global styles and theme
│   │   └── test/              # Test utilities
├── supabase/                  # Serverless backend
│   ├── functions/             # Edge Functions (Deno)
│   │   ├── create-conversation/
│   │   ├── tavus-webhook/
│   │   └── get-conversations/
│   └── config.toml           # Supabase configuration
├── backend/                   # Legacy files (can be removed)
└── .kiro/                    # Kiro specs and documentation
    └── specs/
        └── tech-cofounder-landing-page/
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Tavus API account and credentials
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tech-co-founder
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../tech-cofounder-landing
   npm install
   ```

4. **Set up Supabase database**
   
   Create a new Supabase project and run the SQL schema:
   ```bash
   # Copy the SQL from backend/supabase-schema.sql
   # Run it in your Supabase SQL editor
   ```

5. **Set up environment variables**
   
   **Backend (.env in backend/ directory):**
   ```env
   # Server Configuration
   PORT=3003

   # Tavus API Configuration
   TAVUS_API_KEY=your_tavus_api_key_here
   TAVUS_DEFAULT_PERSONA_ID=your_persona_id_here
   TAVUS_DEFAULT_REPLICA_ID=your_replica_id_here
   TAVUS_CALLBACK_URL=http://localhost:3003/api/tavus/webhook

   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174
   ```

   **Frontend (.env in tech-cofounder-landing/ directory):**
   ```env
   VITE_API_BASE_URL=http://localhost:3003
   ```

### Running the Application

1. **Deploy Supabase Edge Functions** (one-time setup)
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login and link to your project
   supabase login
   supabase link --project-ref your-project-ref
   
   # Deploy functions
   supabase functions deploy
   ```

2. **Start the frontend development server**
   ```bash
   cd tech-cofounder-landing
   npm run dev
   ```
   Frontend will run on http://localhost:5173 or 5174

## 🧪 Testing

Run the test suite:
```bash
cd tech-cofounder-landing
npm test
```

## 🎯 Key Components

### Frontend Components
- **Hero**: Main landing section with CTA
- **Features**: Service highlights grid
- **HowItWorks**: Process explanation timeline
- **Testimonials**: Customer feedback cards
- **CallToAction**: Secondary conversion section
- **TavusModal**: Video conversation interface
- **Modal**: Reusable modal component

### Serverless Functions (Edge Functions)
- `POST /functions/v1/create-conversation` - Create new Tavus conversation
- `POST /functions/v1/tavus-webhook` - Handle Tavus webhooks
- `GET /functions/v1/get-conversations` - Get all stored conversations
- Direct database access via Supabase client for real-time data

## 🔧 Tavus Integration

The application integrates with Tavus API to provide AI-powered video conversations:

1. User clicks "Get Started" button
2. Frontend calls backend API (`POST /api/tavus/create-conversation`)
3. Backend creates Tavus conversation using both `replica_id` and `persona_id`
4. Tavus returns conversation URL and ID
5. Frontend displays video interface in modal
6. User interacts with AI tech co-founder through Tavus video chat

### Tavus API Configuration
The backend uses both `replica_id` and `persona_id` as required by Tavus API v2:
```javascript
{
  replica_id: "your_replica_id",
  persona_id: "your_persona_id"
}
```

### Database Schema
The application stores conversation data in Supabase with two main tables:

**conversations table:**
- `conversation_id`: Unique Tavus conversation ID
- `conversation_url`: Tavus conversation URL
- `conversation_name`: Custom name for the conversation
- `replica_id` & `persona_id`: Tavus configuration
- `status`: Conversation status (created, active, completed)
- Timestamps for creation, start, end, participant events

**conversation_events table:**
- `conversation_id`: Reference to conversation
- `event_type`: Type of webhook event received
- `event_data`: JSON data from webhook
- `received_at`: When the event was received

## 🚀 Deployment

### Backend Deployment Options

**Railway:**
- Push to GitHub
- Connect Railway to repository
- Set environment variables in Railway dashboard
- Deploy automatically

**Render:**
- Connect GitHub repository
- Use the included `render.yaml` configuration
- Set environment variables in Render dashboard

### Frontend Deployment Options

**Vercel:**
```bash
npm install -g vercel
cd tech-cofounder-landing
vercel
```

**Netlify:**
```bash
cd tech-cofounder-landing
npm run build
# Upload dist/ folder to Netlify
```

## 📝 Environment Variables

### Required Backend Variables
- `TAVUS_API_KEY`: Your Tavus API key
- `TAVUS_DEFAULT_PERSONA_ID`: Your Tavus persona ID
- `TAVUS_DEFAULT_REPLICA_ID`: Your Tavus replica ID
- `TAVUS_CALLBACK_URL`: Webhook URL for Tavus events
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `PORT`: Server port (default: 3003)

### Required Frontend Variables
- `VITE_API_BASE_URL`: Backend API base URL (http://localhost:3003)

### Getting Credentials

**Tavus Setup:**
1. Sign up at [Tavus.io](https://tavus.io)
2. Create a replica and persona in your Tavus dashboard
3. Get your API key from the Tavus dashboard
4. Copy the replica_id and persona_id from your created assets

**Supabase Setup:**
1. Sign up at [Supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API to get your URL and anon key
4. Run the SQL schema from `backend/supabase-schema.sql` in the SQL editor

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔧 Troubleshooting

### Common Issues

**Backend server won't start on port 3003:**
```bash
# Check if port is in use
netstat -ano | findstr :3003
# Kill process if needed, then restart
```

**Tavus API "Invalid access token" error:**
- Verify your `TAVUS_API_KEY` in backend/.env
- Ensure the API key is active in your Tavus dashboard
- Check that both `TAVUS_DEFAULT_REPLICA_ID` and `TAVUS_DEFAULT_PERSONA_ID` are set

**Frontend can't connect to backend:**
- Ensure backend is running on port 3003
- Check that `VITE_API_BASE_URL=http://localhost:3003` in frontend/.env
- Verify CORS settings in backend allow your frontend origin

**Styled-components warnings:**
- These are development warnings and don't affect functionality
- Can be fixed by using transient props ($ prefix) in styled-components

### Testing Tavus API
You can test your Tavus credentials directly:
```bash
curl --request POST \
  --url https://tavusapi.com/v2/conversations \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: YOUR_API_KEY' \
  --data '{"replica_id": "YOUR_REPLICA_ID","persona_id": "YOUR_PERSONA_ID"}'
```

## 🆘 Support

For support and questions:
- Check the documentation in `.kiro/specs/`
- Review component tests for usage examples
- Check the troubleshooting section above
- Open an issue for bugs or feature requests

## 🔗 Links

- [Tavus API Documentation](https://docs.tavus.io/)
- [React Documentation](https://react.dev/)
- [Styled Components](https://styled-components.com/)
- [Framer Motion](https://www.framer.com/motion/)
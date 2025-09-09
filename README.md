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

### Backend
- Node.js
- Express.js
- Tavus API Integration
- CORS enabled

## 📁 Project Structure

```
tech-co-founder/
├── tech-cofounder-landing/     # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── styles/            # Global styles and theme
│   │   └── test/              # Test utilities
├── backend/                   # Express.js API server
│   ├── server.js             # Main server file
│   └── package.json          # Backend dependencies
└── .kiro/                    # Kiro specs and documentation
    └── specs/
        └── tech-cofounder-landing-page/
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Tavus API account and credentials

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

4. **Set up environment variables**
   
   **Backend (.env in backend/ directory):**
   ```env
   PORT=3002
   TAVUS_API_KEY=your_tavus_api_key_here
   TAVUS_DEFAULT_PERSONA_ID=your_default_persona_id_here
   TAVUS_CALLBACK_URL=http://localhost:3002/api/tavus/webhook
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

   **Frontend (.env in tech-cofounder-landing/ directory):**
   ```env
   REACT_APP_TAVUS_PERSONA_ID=your_tavus_persona_id_here
   REACT_APP_API_BASE_URL=http://localhost:3002
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```
   Server will run on http://localhost:3002

2. **Start the frontend development server**
   ```bash
   cd tech-cofounder-landing
   npm run dev
   ```
   Frontend will run on http://localhost:5173

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

### Backend Endpoints
- `POST /api/tavus/create-conversation` - Create new Tavus conversation
- `POST /api/tavus/webhook` - Handle Tavus webhooks
- `GET /api/health` - Health check endpoint

## 🔧 Tavus Integration

The application integrates with Tavus API to provide AI-powered video conversations:

1. User clicks "Get Started" button
2. Frontend calls backend API
3. Backend creates Tavus conversation
4. Frontend displays video interface in modal
5. User interacts with AI tech co-founder

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
- `TAVUS_DEFAULT_PERSONA_ID`: Default persona/replica ID
- `TAVUS_CALLBACK_URL`: Webhook URL for Tavus events

### Required Frontend Variables
- `REACT_APP_TAVUS_PERSONA_ID`: Tavus persona ID for frontend
- `REACT_APP_API_BASE_URL`: Backend API base URL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation in `.kiro/specs/`
- Review component tests for usage examples
- Open an issue for bugs or feature requests

## 🔗 Links

- [Tavus API Documentation](https://docs.tavus.io/)
- [React Documentation](https://react.dev/)
- [Styled Components](https://styled-components.com/)
- [Framer Motion](https://www.framer.com/motion/)
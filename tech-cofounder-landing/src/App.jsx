import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/GlobalStyles';
import Header from './components/Header/Header';
import Hero from './components/Hero/Hero';
import Features from './components/Features/Features';
import HowItWorks from './components/HowItWorks/HowItWorks';
import Testimonials from './components/Testimonials/Testimonials';
import CallToAction from './components/CallToAction/CallToAction';
import Footer from './components/Footer/Footer';
import TavusModal from './components/TavusModal/TavusModal';
import ProjectDashboard from './components/ProjectDashboard/ProjectDashboard';

// Landing Page Component
function LandingPage() {
  const [isTavusModalOpen, setIsTavusModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleCtaClick = () => {
    setIsTavusModalOpen(true);
  };

  // Development helper function
  const handleTestDashboard = () => {
    if (import.meta.env.DEV) {
      navigate('/project/test-conversation-123');
    }
  };

  const handleTavusModalClose = () => {
    setIsTavusModalOpen(false);
  };

  const handleConversationStart = (conversationData) => {
    console.log('Tavus conversation started:', {
      conversation_id: conversationData.conversation_id,
      timestamp: new Date().toISOString(),
    });
    
    // Store conversation ID for WebSocket tracking
    if (conversationData.conversation_id) {
      sessionStorage.setItem('current_conversation_id', conversationData.conversation_id);
    }
  };

  return (
    <div>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Header onCtaClick={handleCtaClick} />
      {import.meta.env.DEV && (
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          zIndex: 9999,
          background: '#007bff',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }} onClick={handleTestDashboard}>
          Test Dashboard
        </div>
      )}
      <main id="main">
        <Hero onCtaClick={handleCtaClick} />
        <section id="features">
          <Features />
        </section>
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <section id="testimonials">
          <Testimonials />
        </section>
        <CallToAction onButtonClick={handleCtaClick} />
      </main>
      <Footer />
      
      <TavusModal
        isOpen={isTavusModalOpen}
        onClose={handleTavusModalClose}
        onConversationStart={handleConversationStart}
      />
    </div>
  );
}

// Main App Component with WebSocket and Routing
function App() {
  const [wsConnection, setWsConnection] = useState(null);

  // WebSocket connection setup
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    
    const connectWebSocket = () => {
      // Skip WebSocket connection in development or if we've exceeded max attempts
      if (import.meta.env.DEV || reconnectAttempts >= maxReconnectAttempts) {
        console.log('WebSocket connection skipped (development mode or max attempts reached)');
        return null;
      }
      
      try {
        // For development, we'll use a mock WebSocket or skip WebSocket connection
        if (!import.meta.env.VITE_SUPABASE_URL) {
          console.warn('VITE_SUPABASE_URL not configured, skipping WebSocket connection');
          return null;
        }
        
        const wsUrl = import.meta.env.VITE_SUPABASE_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/functions/v1/websocket-manager';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setWsConnection(ws);
          reconnectAttempts = 0; // Reset attempts on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            // Handle conversation completion
            if (message.event_type === 'conversation_completed') {
              console.log('Conversation completed, redirecting to dashboard');
              // The navigation will be handled by the WebSocketHandler component
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setWsConnection(null);
          
          // Only attempt to reconnect if we haven't exceeded max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect WebSocket (${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(connectWebSocket, 3000 * reconnectAttempts); // Exponential backoff
          }
        };

        ws.onerror = (error) => {
          console.warn('WebSocket connection failed:', error.type);
          // Don't log the full error object as it's not very useful
        };

        return ws;
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Router>
        <WebSocketHandler wsConnection={wsConnection} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/project/:conversationId" element={<ProjectDashboard />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

// WebSocket Handler Component
function WebSocketHandler({ wsConnection }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!wsConnection) return;

    const handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event_type === 'conversation_completed') {
          const conversationId = message.conversation_id;
          const currentConversationId = sessionStorage.getItem('current_conversation_id');
          
          // Only redirect if this is for the current conversation
          if (conversationId === currentConversationId) {
            console.log('Redirecting to project dashboard:', conversationId);
            navigate(`/project/${conversationId}`);
            // Clear the stored conversation ID
            sessionStorage.removeItem('current_conversation_id');
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };

    wsConnection.addEventListener('message', handleMessage);

    return () => {
      wsConnection.removeEventListener('message', handleMessage);
    };
  }, [wsConnection, navigate]);

  return null; // This component doesn't render anything
}

export default App;

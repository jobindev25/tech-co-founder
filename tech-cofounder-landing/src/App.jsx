import React, { useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/GlobalStyles';
import Header from './components/Header';
import Hero from './components/Hero';
import { Features } from './components/Features';
import HowItWorks from './components/HowItWorks';
import Testimonials from './components/Testimonials';
import CallToAction from './components/CallToAction';
import Footer from './components/Footer';
import TavusModal from './components/TavusModal/TavusModal';

function App() {
  const [isTavusModalOpen, setIsTavusModalOpen] = useState(false);

  const handleCtaClick = () => {
    // Open Tavus modal for AI conversation
    setIsTavusModalOpen(true);
  };

  const handleTavusModalClose = () => {
    setIsTavusModalOpen(false);
  };

  const handleConversationStart = (conversationData) => {
    // Log conversation start for analytics
    console.log('Tavus conversation started:', {
      conversation_id: conversationData.conversation_id,
      timestamp: new Date().toISOString(),
    });
    
    // You can add additional tracking or analytics here
    // For example, send to Google Analytics, Mixpanel, etc.
  };

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <div>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Header onCtaClick={handleCtaClick} />
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
        
        {/* Tavus AI Conversation Modal */}
        <TavusModal
          isOpen={isTavusModalOpen}
          onClose={handleTavusModalClose}
          onConversationStart={handleConversationStart}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;

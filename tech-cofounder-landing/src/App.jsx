import React, { useState } from 'react';
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

function App() {
  const [isTavusModalOpen, setIsTavusModalOpen] = useState(false);

  const handleCtaClick = () => {
    setIsTavusModalOpen(true);
  };

  const handleTavusModalClose = () => {
    setIsTavusModalOpen(false);
  };

  const handleConversationStart = (conversationData) => {
    console.log('Tavus conversation started:', {
      conversation_id: conversationData.conversation_id,
      timestamp: new Date().toISOString(),
    });
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

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCtaClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
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
        <TavusModal isOpen={isModalOpen} onClose={handleCloseModal} />
      </div>
    </ThemeProvider>
  );
}

export default App;

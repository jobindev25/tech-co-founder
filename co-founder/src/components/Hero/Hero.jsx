import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { motion, useReducedMotion } from 'framer-motion';
import Button from '../common/Button/Button';
import Container from '../common/Container/Container';
import {
  HeroSection,
  HeroBackground,
  HeroContent,
  HeroTitle,
  HeroSubheading,
  HeroActions,
} from './Hero.styles';
import { animations } from '../../styles/animations';

const Hero = ({
  title = "Meet Your AI Tech Co-Founder",
  subheading = "Your intelligent AI developer and CTO partner to bring ideas to life",
  ctaText = "Get Started",
  onCtaClick,
  className,
  ...props
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Subtle parallax effect based on mouse movement
  useEffect(() => {
    if (shouldReduceMotion) return;

    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [shouldReduceMotion]);

  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    }
  };

  // Adjust animations based on reduced motion preference
  const heroAnimations = shouldReduceMotion 
    ? {
        container: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
        title: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
        subtitle: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
        cta: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
        background: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
      }
    : animations.hero;

  return (
    <HeroSection
      as={motion.section}
      initial="hidden"
      animate="visible"
      variants={heroAnimations.container}
      className={className}
      aria-label="Hero section"
      style={{
        transform: shouldReduceMotion 
          ? 'none' 
          : `translate3d(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px, 0)`,
      }}
      {...props}
    >
      <HeroBackground
        as={motion.div}
        initial="hidden"
        animate="visible"
        variants={heroAnimations.background}
        style={{
          transform: shouldReduceMotion 
            ? 'none' 
            : `translate3d(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3}px, 0)`,
        }}
      />
      <Container maxWidth="desktop" padding="large">
        <HeroContent>
          <motion.div variants={heroAnimations.title}>
            <HeroTitle as="h1">
              {title}
            </HeroTitle>
          </motion.div>
          
          <motion.div variants={heroAnimations.subtitle}>
            <HeroSubheading as="h2">
              {subheading}
            </HeroSubheading>
          </motion.div>
          
          <motion.div variants={heroAnimations.cta}>
            <HeroActions>
              <Button
                variant="primary"
                size="large"
                onClick={handleCtaClick}
                ariaLabel={`${ctaText} - Begin your AI development journey`}
              >
                {ctaText}
              </Button>
            </HeroActions>
          </motion.div>
        </HeroContent>
      </Container>
    </HeroSection>
  );
};

Hero.propTypes = {
  title: PropTypes.string,
  subheading: PropTypes.string,
  ctaText: PropTypes.string,
  onCtaClick: PropTypes.func,
  className: PropTypes.string,
};

export default Hero;
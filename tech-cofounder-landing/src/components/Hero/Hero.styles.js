import styled from 'styled-components';

export const HeroSection = styled.section`
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.gradient.hero};
  color: ${({ theme }) => theme.colors.background};
  
  /* Subtle grid pattern overlay */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 50px 50px;
    opacity: 0.5;
    animation: gridShift 20s linear infinite;
    pointer-events: none;
  }
  
  @keyframes gridShift {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(50px, 50px);
    }
  }
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    &::before {
      animation: none;
    }
  }
`;

export const HeroBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colors.gradient.hero};
  overflow: hidden;
  
  /* Animated gradient overlay */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      ellipse at center,
      rgba(59, 130, 246, 0.15) 0%,
      rgba(30, 58, 138, 0.08) 50%,
      transparent 100%
    );
    animation: pulse 4s ease-in-out infinite alternate;
  }
  
  /* Floating particles effect */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(30, 58, 138, 0.05) 0%, transparent 50%);
    animation: float 8s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0% {
      opacity: 0.4;
      transform: scale(1);
    }
    100% {
      opacity: 0.7;
      transform: scale(1.05);
    }
  }
  
  @keyframes float {
    0%, 100% {
      transform: translateY(0px) rotate(0deg);
      opacity: 0.3;
    }
    33% {
      transform: translateY(-10px) rotate(1deg);
      opacity: 0.5;
    }
    66% {
      transform: translateY(5px) rotate(-1deg);
      opacity: 0.4;
    }
  }
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    &::before,
    &::after {
      animation: none;
    }
  }
`;

export const HeroContent = styled.div`
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl} 0;
  z-index: 1;
  position: relative;
`;

export const HeroTitle = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme }) => theme.typography.sizes.h1};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
  color: ${({ theme }) => theme.colors.background};
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 2.5rem;
    line-height: 1.2;
  }
  
  @media (max-width: 480px) {
    font-size: 2rem;
  }
`;

export const HeroSubheading = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: 1.25rem;
  font-weight: ${({ theme }) => theme.typography.weights.regular};
  line-height: ${({ theme }) => theme.typography.lineHeights.relaxed};
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 ${({ theme }) => theme.spacing.xl} 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 1.125rem;
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }
  
  @media (max-width: 480px) {
    font-size: 1rem;
  }
`;

export const HeroActions = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  
  /* Enhanced button styling for hero CTA */
  button {
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.2),
        transparent
      );
      transition: left 0.5s ease;
    }
    
    &:hover::before {
      left: 100%;
    }
    
    /* Subtle glow effect on hover */
    &:hover {
      box-shadow: 
        0 0 20px rgba(59, 130, 246, 0.3),
        0 4px 15px rgba(0, 0, 0, 0.2);
    }
  }
  
  @media (max-width: 480px) {
    flex-direction: column;
    width: 100%;
    
    button {
      width: 100%;
      max-width: 280px;
    }
  }
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    button {
      &::before {
        display: none;
      }
      
      &:hover {
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      }
    }
  }
`;
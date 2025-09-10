import styled from 'styled-components';

export const FeaturesSection = styled.section`
  padding: ${({ theme }) => theme.spacing.section.desktop} 0;
  background: ${({ theme }) => theme.colors.surface};
  position: relative;
  
  /* Subtle background pattern */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 75% 75%, rgba(6, 182, 212, 0.03) 0%, transparent 50%);
    pointer-events: none;
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.section.mobile} 0;
  }
`;

export const FeaturesHeader = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  position: relative;
  z-index: 1;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  }
`;

export const FeaturesTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme }) => theme.typography.sizes.h2};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
  
  /* Subtle text gradient */
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.text.primary} 0%,
    ${({ theme }) => theme.colors.primary} 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 2rem;
    line-height: 1.2;
  }
  
  @media (max-width: 480px) {
    font-size: 1.75rem;
  }
`;

export const FeaturesSubtitle = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: 1.125rem;
  font-weight: ${({ theme }) => theme.typography.weights.regular};
  line-height: ${({ theme }) => theme.typography.lineHeights.relaxed};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 1rem;
  }
  
  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

export const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing.xl};
  position: relative;
  z-index: 1;
  
  /* Responsive grid layout */
  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    gap: ${({ theme }) => theme.spacing.lg};
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.lg};
  }
  
  @media (max-width: 480px) {
    gap: ${({ theme }) => theme.spacing.md};
  }
  
  /* Enhanced grid animation */
  & > * {
    transform-origin: center;
  }
  
  /* Staggered animation delay for grid items */
  & > *:nth-child(1) { animation-delay: 0ms; }
  & > *:nth-child(2) { animation-delay: 100ms; }
  & > *:nth-child(3) { animation-delay: 200ms; }
  & > *:nth-child(4) { animation-delay: 300ms; }
  
  /* Subtle hover effect for the entire grid */
  &:hover > * {
    transform: scale(0.98);
    transition: transform 0.3s ease;
  }
  
  &:hover > *:hover {
    transform: scale(1.02);
  }
  
  /* Respect reduced motion preferences */
  @media (prefers-reduced-motion: reduce) {
    & > * {
      animation-delay: 0ms !important;
    }
    
    &:hover > * {
      transform: none;
    }
    
    &:hover > *:hover {
      transform: none;
    }
  }
`;
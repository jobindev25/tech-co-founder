import styled from 'styled-components';

export const HowItWorksSection = styled.section`
  padding: ${({ theme }) => theme.spacing.section.desktop} 0;
  background: ${({ theme }) => theme.colors.surface};
  position: relative;
  overflow: hidden;
  
  /* Subtle background pattern */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at 20% 80%,
      ${({ theme }) => theme.colors.primary}08 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 20%,
      ${({ theme }) => theme.colors.secondary}08 0%,
      transparent 50%
    );
    pointer-events: none;
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.section.mobile} 0;
  }
`;

export const SectionHeader = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xxl};
  position: relative;
  z-index: 1;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  }
`;

export const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme }) => theme.typography.sizes.h2};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
  
  /* Gradient text effect */
  background: ${({ theme }) => theme.colors.gradient.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    font-size: 2rem;
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 1.75rem;
  }
`;

export const SectionSubtitle = styled.p`
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
    max-width: 100%;
  }
`;

export const ProcessContainer = styled.div`
  position: relative;
  z-index: 1;
  
  /* Desktop horizontal layout */
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.lg};
    max-width: 1200px;
    margin: 0 auto;
    
    /* Ensure equal spacing */
    > * {
      flex: 1;
      min-width: 0; /* Prevent flex items from overflowing */
    }
  }
  
  /* Mobile vertical layout */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    
    /* Remove connecting lines on mobile for cleaner look */
    > *:not(:last-child) {
      margin-bottom: ${({ theme }) => theme.spacing.lg};
    }
  }
  
  /* Tablet layout adjustments */
  @media (min-width: ${({ theme }) => theme.breakpoints.mobile}) and (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.xl};
    max-width: 800px;
    margin: 0 auto;
    
    /* Handle odd number of items */
    > *:last-child:nth-child(odd) {
      grid-column: 1 / -1;
      max-width: 400px;
      margin: 0 auto;
    }
  }
`;
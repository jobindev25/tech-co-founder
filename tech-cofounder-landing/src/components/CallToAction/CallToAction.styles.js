import styled from 'styled-components';
import { motion } from 'framer-motion';

export const CTASection = styled(motion.section)`
  padding: ${({ theme }) => theme.spacing.xxl} 0;
  background: ${({ theme }) => theme.colors.gradient.primary};
  position: relative;
  overflow: hidden;
  
  /* Add subtle background pattern */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.xl} 0;
  }
`;

export const CTAContent = styled(motion.div)`
  text-align: center;
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
`;

export const CTATitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme }) => theme.typography.sizes.h2};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
  color: white;
  margin: 0 0 ${({ theme }) => theme.spacing.lg} 0;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 2rem;
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }
`;

export const CTASubtitle = styled.p`
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
`;

export const CTAButtonWrapper = styled(motion.div)`
  display: flex;
  justify-content: center;
  align-items: center;
  
  button {
    min-width: 200px;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    font-size: 1.125rem;
    font-weight: ${({ theme }) => theme.typography.weights.semibold};
    background: white;
    color: ${({ theme }) => theme.colors.primary};
    border: none;
    box-shadow: ${({ theme }) => theme.shadows.lg};
    
    &:hover {
      background: ${({ theme }) => theme.colors.surface};
      transform: translateY(-2px);
      box-shadow: ${({ theme }) => theme.shadows.xl};
    }
    
    &:active {
      transform: translateY(0);
    }
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      min-width: 180px;
      font-size: 1rem;
      padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    }
  }
`;
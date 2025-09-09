import styled from 'styled-components';

export const ProcessStepContainer = styled.div`
  display: flex;
  align-items: flex-start;
  position: relative;
  padding: ${({ theme }) => theme.spacing.lg} 0;
  
  /* Desktop horizontal layout */
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    flex-direction: column;
    align-items: center;
    text-align: center;
    flex: 1;
    padding: 0 ${({ theme }) => theme.spacing.md};
  }
  
  /* Mobile vertical layout */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: row;
    align-items: flex-start;
    text-align: left;
    padding: ${({ theme }) => theme.spacing.md} 0;
  }
`;

export const StepIndicator = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.gradient.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${({ theme }) => theme.shadows.lg};
  z-index: 2;
  
  /* Subtle glow effect */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.gradient.primary};
    opacity: 0.3;
    filter: blur(12px);
    z-index: -1;
    transition: opacity 0.3s ease;
  }
  
  &:hover::after {
    opacity: 0.5;
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 60px;
    height: 60px;
    margin-right: ${({ theme }) => theme.spacing.lg};
    flex-shrink: 0;
  }
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }
`;

export const StepNumber = styled.div`
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: ${({ theme }) => theme.colors.accent};
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 20px;
    height: 20px;
    font-size: 0.7rem;
    top: -6px;
    right: -6px;
  }
`;

export const StepIcon = styled.div`
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    transition: transform 0.3s ease;
  }
  
  ${StepIndicator}:hover & svg {
    transform: scale(1.1) rotate(5deg);
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

export const ConnectingLine = styled.div`
  background: linear-gradient(
    to right,
    ${({ theme }) => theme.colors.primary}20,
    ${({ theme }) => theme.colors.secondary}20
  );
  transform-origin: top;
  
  /* Desktop horizontal connecting line */
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    position: absolute;
    top: 40px;
    left: calc(50% + 40px);
    right: calc(-50% + 40px);
    height: 2px;
    width: calc(100% - 80px);
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${({ theme }) => theme.colors.gradient.primary};
      opacity: 0.3;
      border-radius: 1px;
    }
  }
  
  /* Mobile vertical connecting line */
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    position: absolute;
    left: 30px;
    top: 60px;
    bottom: -${({ theme }) => theme.spacing.md};
    width: 2px;
    height: calc(100% + ${({ theme }) => theme.spacing.md});
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${({ theme }) => theme.colors.gradient.primary};
      opacity: 0.3;
      border-radius: 1px;
    }
  }
`;

export const StepContent = styled.div`
  flex: 1;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.tablet}) {
    max-width: 250px;
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding-top: ${({ theme }) => theme.spacing.xs};
  }
`;

export const StepTitle = styled.h3`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme }) => theme.typography.sizes.h3};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeights.tight};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 1.25rem;
  }
  
  @media (max-width: 480px) {
    font-size: 1.125rem;
  }
`;

export const StepDescription = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-size: ${({ theme }) => theme.typography.sizes.body};
  font-weight: ${({ theme }) => theme.typography.weights.regular};
  line-height: ${({ theme }) => theme.typography.lineHeights.loose};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    font-size: 0.9rem;
  }
  
  @media (max-width: 480px) {
    font-size: 0.85rem;
  }
`;
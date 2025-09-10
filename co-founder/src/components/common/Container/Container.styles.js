import styled, { css } from 'styled-components';

// Max width variants
const maxWidthStyles = {
  mobile: css`
    max-width: 480px;
  `,
  tablet: css`
    max-width: 768px;
  `,
  desktop: css`
    max-width: 1200px;
  `,
  wide: css`
    max-width: 1400px;
  `,
  full: css`
    max-width: 100%;
  `,
};

// Padding variants
const paddingStyles = {
  none: css`
    padding: 0;
  `,
  small: css`
    padding: 0 ${({ theme }) => theme.spacing.sm};
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      padding: 0 ${({ theme }) => theme.spacing.xs};
    }
  `,
  default: css`
    padding: 0 ${({ theme }) => theme.spacing.lg};
    
    @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
      padding: 0 ${({ theme }) => theme.spacing.md};
    }
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      padding: 0 ${({ theme }) => theme.spacing.sm};
    }
  `,
  large: css`
    padding: 0 ${({ theme }) => theme.spacing.xl};
    
    @media (max-width: ${({ theme }) => theme.breakpoints.tablet}) {
      padding: 0 ${({ theme }) => theme.spacing.lg};
    }
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      padding: 0 ${({ theme }) => theme.spacing.md};
    }
  `,
};

// Centered styles
const centeredStyles = css`
  margin-left: auto;
  margin-right: auto;
`;

// Fluid styles (full width)
const fluidStyles = css`
  width: 100%;
  max-width: none;
`;

// Main styled container component
export const StyledContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['maxWidth', 'padding', 'centered', 'fluid'].includes(prop),
})`
  width: 100%;
  
  ${({ maxWidth }) => !maxWidth || maxWidth === 'full' ? '' : maxWidthStyles[maxWidth]}
  ${({ padding }) => paddingStyles[padding]}
  ${({ centered }) => centered && centeredStyles}
  ${({ fluid }) => fluid && fluidStyles}
  
  /* Ensure container doesn't exceed viewport width */
  ${({ fluid }) => !fluid && css`
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      max-width: calc(100vw - ${({ theme }) => theme.spacing.sm});
    }
  `}
`;
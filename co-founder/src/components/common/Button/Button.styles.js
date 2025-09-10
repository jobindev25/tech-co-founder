import styled, { css, keyframes } from 'styled-components';

// Loading spinner animation
const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Base button styles
const baseButtonStyles = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.typography.fontFamily};
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  text-decoration: none;
  transition: all ${({ theme }) => theme.animations?.duration?.normal || '0.3s'} ease;
  position: relative;
  overflow: hidden;
  user-select: none;
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Ripple effect */
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }

  &:active::before {
    width: 300px;
    height: 300px;
  }
`;

// Size variants
const sizeStyles = {
  small: css`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.typography.sizes.small};
    min-height: 36px;
  `,
  medium: css`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    font-size: ${({ theme }) => theme.typography.sizes.body};
    min-height: 44px;
  `,
  large: css`
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    font-size: ${({ theme }) => theme.typography.sizes.body};
    min-height: 52px;
  `,
};

// Variant styles
const variantStyles = {
  primary: css`
    background: ${({ theme }) => theme.colors.gradient.primary};
    color: white;
    box-shadow: ${({ theme }) => theme.shadows.sm};

    &:hover:not(:disabled) {
      box-shadow: ${({ theme }) => theme.shadows.lg};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: ${({ theme }) => theme.shadows.sm};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.secondary};
    color: white;
    box-shadow: ${({ theme }) => theme.shadows.sm};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primary};
      box-shadow: ${({ theme }) => theme.shadows.md};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: ${({ theme }) => theme.shadows.sm};
    }
  `,
  outline: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    border: 2px solid ${({ theme }) => theme.colors.primary};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primary};
      color: white;
      transform: translateY(-1px);
      box-shadow: ${({ theme }) => theme.shadows.md};
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  `,
  ghost: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surface};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      background: ${({ theme }) => theme.colors.primary}10;
    }
  `,
  danger: css`
    background: #ef4444;
    color: white;
    box-shadow: ${({ theme }) => theme.shadows.sm};

    &:hover:not(:disabled) {
      background: #dc2626;
      box-shadow: ${({ theme }) => theme.shadows.md};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: ${({ theme }) => theme.shadows.sm};
    }
  `,
};

// Full width styles
const fullWidthStyles = css`
  width: 100%;
`;

// Main styled button component
export const StyledButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['size', 'variant', 'fullWidth', 'loading'].includes(prop),
})`
  ${baseButtonStyles}
  ${({ size }) => sizeStyles[size]}
  ${({ variant }) => variantStyles[variant]}
  ${({ fullWidth }) => fullWidth && fullWidthStyles}
`;

// Button content wrapper (for loading state)
export const ButtonContent = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'loading',
})`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  opacity: ${({ loading }) => (loading ? 0.7 : 1)};
  transition: opacity 0.2s ease;
`;

// Loading spinner
export const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;
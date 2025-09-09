import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

export const VideoContainer = styled.div`
  width: 100%;
  height: 70vh;
  min-height: 500px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.text.primary};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    height: 60vh;
    min-height: 400px;
  }
`;

export const VideoIframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`;

export const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const LoadingSpinner = styled.div.attrs({
  'data-testid': 'loading-spinner'
})`
  width: 48px;
  height: 48px;
  border: 4px solid ${({ theme }) => theme.colors.text.light}30;
  border-top: 4px solid ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

export const LoadingText = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.body};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-align: center;
  margin: 0;
`;

export const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

export const ErrorMessage = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.body};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  max-width: 400px;
  line-height: ${({ theme }) => theme.typography.lineHeights.relaxed};
`;

export const RetryButton = styled.button`
  background-color: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.sizes.body};
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.secondary};
    transform: translateY(-1px);
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:active {
    transform: translateY(0);
  }
`;
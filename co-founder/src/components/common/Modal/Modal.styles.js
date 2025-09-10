import styled from 'styled-components';

export const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: ${({ theme }) => theme.spacing.md};
  backdrop-filter: blur(4px);
`;

export const ModalContainer = styled.div.attrs(({ size = 'large' }) => ({
  'data-size': size
}))`
  background-color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  max-height: 90vh;
  overflow: hidden;
  position: relative;
  
  ${({ size }) => {
    switch (size) {
      case 'small':
        return `
          width: 100%;
          max-width: 400px;
        `;
      case 'medium':
        return `
          width: 100%;
          max-width: 600px;
        `;
      case 'large':
        return `
          width: 100%;
          max-width: 900px;
        `;
      case 'fullscreen':
        return `
          width: 95vw;
          height: 90vh;
          max-width: none;
          max-height: none;
        `;
      default:
        return `
          width: 100%;
          max-width: 900px;
        `;
    }
  }}

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: 95vw;
    max-width: none;
    ${({ size }) => size === 'fullscreen' && `
      width: 100vw;
      height: 100vh;
      border-radius: 0;
    `}
  }
`;

export const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.text.light}20;
  background-color: ${({ theme }) => theme.colors.surface};
`;

export const ModalTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.sizes.h3};
  font-weight: ${({ theme }) => theme.typography.weights.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.secondary};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: ${({ theme }) => theme.colors.text.light}20;
    color: ${({ theme }) => theme.colors.text.primary};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

export const ModalContent = styled.div`
  padding: ${({ $hasHeader, theme }) => 
    $hasHeader ? theme.spacing.lg : `${theme.spacing.lg} ${theme.spacing.lg} ${theme.spacing.lg}`
  };
  overflow-y: auto;
  max-height: ${({ $hasHeader }) => $hasHeader ? 'calc(90vh - 80px)' : '90vh'};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

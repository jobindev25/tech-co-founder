import styled from 'styled-components';

export const FooterSection = styled.footer`
  background-color: ${({ theme }) => theme.colors.surface};
  border-top: 1px solid ${({ theme }) => theme.colors.text.light}20;
  padding: ${({ theme }) => theme.spacing.lg} 0;
  margin-top: auto;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.md} 0;
  }
`;

export const FooterContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};

  @media (min-width: ${({ theme }) => theme.breakpoints.mobile}) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

export const FooterLinks = styled.nav`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  align-items: center;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
    justify-content: center;
  }
`;

export const FooterLink = styled.a`
  color: ${({ theme }) => theme.colors.text.secondary};
  text-decoration: none;
  font-size: ${({ theme }) => theme.typography.sizes.small};
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  transition: color 0.2s ease;
  position: relative;

  &:hover,
  &:focus {
    color: ${({ theme }) => theme.colors.primary};
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
    border-radius: 2px;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 1px;
    background-color: ${({ theme }) => theme.colors.primary};
    transition: width 0.2s ease;
  }

  &:hover::after,
  &:focus::after {
    width: 100%;
  }
`;

export const Copyright = styled.p`
  color: ${({ theme }) => theme.colors.text.light};
  font-size: ${({ theme }) => theme.typography.sizes.small};
  margin: 0;
  text-align: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.mobile}) {
    text-align: right;
  }
`;
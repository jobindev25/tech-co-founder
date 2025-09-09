import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  /* Import Inter font from Google Fonts */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  /* CSS Reset and Base Styles */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    scroll-behavior: smooth;
    
    @media (prefers-reduced-motion: reduce) {
      scroll-behavior: auto;
    }
  }

  body {
    font-family: ${({ theme }) => theme.typography.fontFamily};
    font-size: ${({ theme }) => theme.typography.sizes.body};
    font-weight: ${({ theme }) => theme.typography.weights.regular};
    line-height: ${({ theme }) => theme.typography.lineHeights.loose};
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.background};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    padding-top: 80px; /* Account for fixed header */
    
    @media (max-width: 768px) {
      padding-top: 70px; /* Smaller padding on mobile */
    }
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    font-weight: ${({ theme }) => theme.typography.weights.semibold};
    line-height: ${({ theme }) => theme.typography.lineHeights.tight};
    color: ${({ theme }) => theme.colors.text.primary};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }

  h1 {
    font-size: ${({ theme }) => theme.typography.sizes.h1};
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    line-height: ${({ theme }) => theme.typography.lineHeights.tight};
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      font-size: 2.5rem;
    }
  }

  h2 {
    font-size: ${({ theme }) => theme.typography.sizes.h2};
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      font-size: 2rem;
    }
  }

  h3 {
    font-size: ${({ theme }) => theme.typography.sizes.h3};
    
    @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
      font-size: 1.5rem;
    }
  }

  p {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.colors.text.secondary};
    line-height: ${({ theme }) => theme.typography.lineHeights.loose};
  }

  /* Links */
  a {
    color: ${({ theme }) => theme.colors.secondary};
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }

    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 2px;
    }
  }

  /* Lists */
  ul, ol {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    padding-left: ${({ theme }) => theme.spacing.lg};
  }

  li {
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  }

  /* Images */
  img {
    max-width: 100%;
    height: auto;
    display: block;
  }

  /* Buttons */
  button {
    font-family: inherit;
    cursor: pointer;
    border: none;
    background: none;
    
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 2px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  /* Form elements */
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 2px;
    }
  }

  /* Accessibility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Skip navigation link */
  .skip-link {
    position: absolute;
    top: -40px;
    left: 6px;
    background: ${({ theme }) => theme.colors.primary};
    color: white;
    padding: 8px;
    text-decoration: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    z-index: 1000;
    
    &:focus {
      top: 6px;
    }
  }

  /* Smooth scrolling for reduced motion users */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    * {
      border-color: currentColor !important;
    }
  }

  /* Print styles */
  @media print {
    * {
      background: transparent !important;
      color: black !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    
    a, a:visited {
      text-decoration: underline;
    }
    
    img {
      max-width: 100% !important;
    }
    
    @page {
      margin: 0.5cm;
    }
  }
`;

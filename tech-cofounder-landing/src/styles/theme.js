export const theme = {
  colors: {
    primary: '#1e3a8a', // Deep blue
    secondary: '#3b82f6', // Bright blue
    accent: '#06b6d4', // Cyan accent
    background: '#ffffff', // Pure white
    surface: '#f8fafc', // Light gray
    text: {
      primary: '#1f2937', // Dark gray
      secondary: '#6b7280', // Medium gray
      light: '#9ca3af', // Light gray
    },
    gradient: {
      primary: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      hero: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    sizes: {
      h1: '3.5rem',
      h2: '2.5rem',
      h3: '1.875rem',
      body: '1rem',
      small: '0.875rem',
    },
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.1,
      normal: 1.2,
      relaxed: 1.3,
      loose: 1.6,
    },
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    xxl: '4rem',
    section: {
      desktop: '5rem',
      mobile: '2.5rem',
    },
  },
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1200px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
};

import React from 'react';
import { render, screen } from '../../test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import Footer from './Footer';

describe('Footer', () => {
  const customLinks = [
    { id: 'about', label: 'About', href: '/about' },
    { id: 'support', label: 'Support', href: '/support' }
  ];

  beforeEach(() => {
    // Mock current year to ensure consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with default props', () => {
    render(<Footer />);
    
    // Check for default links
    expect(screen.getByRole('link', { name: 'Terms page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact page' })).toBeInTheDocument();
    
    // Check for copyright with current year
    expect(screen.getByText('© 2024 Tech Co-Founder. All rights reserved.')).toBeInTheDocument();
  });

  it('renders with custom links', () => {
    render(<Footer links={customLinks} />);
    
    expect(screen.getByRole('link', { name: 'About page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support page' })).toBeInTheDocument();
    
    // Should not render default links
    expect(screen.queryByRole('link', { name: 'Terms page' })).not.toBeInTheDocument();
  });

  it('renders with custom company name', () => {
    const customCompanyName = 'Custom Company';
    render(<Footer companyName={customCompanyName} />);
    
    expect(screen.getByText(`© 2024 ${customCompanyName}. All rights reserved.`)).toBeInTheDocument();
  });

  it('has proper semantic HTML structure', () => {
    render(<Footer />);
    
    // Check for footer element with contentinfo role
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveAttribute('aria-label', 'Site footer');
    
    // Check for navigation element
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('renders links with correct href attributes', () => {
    render(<Footer />);
    
    expect(screen.getByRole('link', { name: 'Terms page' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy page' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Contact page' })).toHaveAttribute('href', '/contact');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-footer';
    render(<Footer className={customClass} />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass(customClass);
  });

  it('passes through additional props', () => {
    render(<Footer data-testid="footer-section" />);
    
    expect(screen.getByTestId('footer-section')).toBeInTheDocument();
  });

  it('handles empty links array', () => {
    render(<Footer links={[]} />);
    
    // Should still render copyright
    expect(screen.getByText('© 2024 Tech Co-Founder. All rights reserved.')).toBeInTheDocument();
    
    // Should not render any links
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('displays current year dynamically', () => {
    // Test with different year
    vi.setSystemTime(new Date('2025-06-15'));
    render(<Footer />);
    
    expect(screen.getByText('© 2025 Tech Co-Founder. All rights reserved.')).toBeInTheDocument();
  });

  it('renders multiple custom links correctly', () => {
    const manyLinks = [
      { id: 'terms', label: 'Terms', href: '/terms' },
      { id: 'privacy', label: 'Privacy', href: '/privacy' },
      { id: 'contact', label: 'Contact', href: '/contact' },
      { id: 'about', label: 'About', href: '/about' },
      { id: 'careers', label: 'Careers', href: '/careers' }
    ];
    
    render(<Footer links={manyLinks} />);
    
    manyLinks.forEach(link => {
      expect(screen.getByRole('link', { name: `${link.label} page` })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: `${link.label} page` })).toHaveAttribute('href', link.href);
    });
  });

  it('has accessible link labels', () => {
    render(<Footer />);
    
    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('aria-label');
      expect(link.getAttribute('aria-label')).toMatch(/page$/);
    });
  });

  it('maintains proper focus management', () => {
    render(<Footer />);
    
    const links = screen.getAllByRole('link');
    links.forEach(link => {
      // Links should be focusable
      expect(link).toHaveAttribute('href');
      // Links should not have tabindex (default behavior)
      expect(link).not.toHaveAttribute('tabindex');
    });
  });

  it('renders with single link', () => {
    const singleLink = [{ id: 'contact', label: 'Contact', href: '/contact' }];
    render(<Footer links={singleLink} />);
    
    expect(screen.getByRole('link', { name: 'Contact page' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('handles special characters in company name', () => {
    const specialCompanyName = 'Tech & Co-Founder™';
    render(<Footer companyName={specialCompanyName} />);
    
    expect(screen.getByText(`© 2024 ${specialCompanyName}. All rights reserved.`)).toBeInTheDocument();
  });

  it('renders navigation with proper structure', () => {
    render(<Footer />);
    
    const nav = screen.getByRole('navigation');
    const links = screen.getAllByRole('link');
    
    // All links should be within the navigation
    links.forEach(link => {
      expect(nav).toContainElement(link);
    });
  });

  it('maintains consistent link structure', () => {
    render(<Footer />);
    
    const links = screen.getAllByRole('link');
    
    links.forEach(link => {
      // Each link should have text content
      expect(link.textContent).toBeTruthy();
      // Each link should have href
      expect(link).toHaveAttribute('href');
      // Each link should have aria-label
      expect(link).toHaveAttribute('aria-label');
    });
  });
});
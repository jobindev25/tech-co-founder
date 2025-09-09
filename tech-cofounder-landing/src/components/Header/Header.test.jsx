import React from 'react';
import { render, screen, fireEvent } from '../../test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import Header from './Header';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    header: ({ children, ...props }) => <header {...props}>{children}</header>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

describe('Header', () => {
  const mockOnCtaClick = vi.fn();
  
  const customNavItems = [
    { id: 'about', label: 'About', href: '#about' },
    { id: 'services', label: 'Services', href: '#services' }
  ];

  beforeEach(() => {
    mockOnCtaClick.mockClear();
  });

  it('renders with default props', () => {
    render(<Header />);
    
    expect(screen.getByText('Tech Co-Founder')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
    expect(screen.getByText('Testimonials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('renders with custom logo and nav items', () => {
    render(
      <Header 
        logo="Custom Logo" 
        navItems={customNavItems}
        onCtaClick={mockOnCtaClick}
      />
    );
    
    expect(screen.getByText('Custom Logo')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    
    // Should not render default nav items
    expect(screen.queryByText('Features')).not.toBeInTheDocument();
  });

  it('has proper semantic HTML structure', () => {
    render(<Header />);
    
    // Check for header element with banner role
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    // Check for navigation element
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('aria-label', 'Main navigation');
  });

  it('handles CTA button click', () => {
    render(<Header onCtaClick={mockOnCtaClick} />);
    
    const ctaButton = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(ctaButton);
    
    expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
  });

  it('toggles mobile menu', () => {
    render(<Header />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();
    
    // Click to open menu
    fireEvent.click(menuButton);
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
  });

  it('renders navigation links with correct href attributes', () => {
    render(<Header />);
    
    const featuresLink = screen.getByRole('link', { name: 'Features' });
    expect(featuresLink).toHaveAttribute('href', '#features');
    
    const howItWorksLink = screen.getByRole('link', { name: 'How It Works' });
    expect(howItWorksLink).toHaveAttribute('href', '#how-it-works');
    
    const testimonialsLink = screen.getByRole('link', { name: 'Testimonials' });
    expect(testimonialsLink).toHaveAttribute('href', '#testimonials');
  });

  it('handles navigation link clicks', () => {
    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn();
    const mockQuerySelector = vi.fn().mockReturnValue({
      scrollIntoView: mockScrollIntoView
    });
    
    Object.defineProperty(document, 'querySelector', {
      value: mockQuerySelector,
      writable: true
    });

    render(<Header />);
    
    const featuresLink = screen.getByRole('link', { name: 'Features' });
    fireEvent.click(featuresLink);
    
    expect(mockQuerySelector).toHaveBeenCalledWith('#features');
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('has accessible logo link', () => {
    render(<Header />);
    
    const logoLink = screen.getByRole('link', { name: 'Tech Co-Founder home' });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-header';
    render(<Header className={customClass} />);
    
    const header = screen.getByRole('banner');
    expect(header).toHaveClass(customClass);
  });

  it('passes through additional props', () => {
    render(<Header data-testid="header-section" />);
    
    expect(screen.getByTestId('header-section')).toBeInTheDocument();
  });

  it('handles empty nav items array', () => {
    render(<Header navItems={[]} />);
    
    // Should still render logo and CTA
    expect(screen.getByText('Tech Co-Founder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    
    // Should not render any nav links
    expect(screen.queryByText('Features')).not.toBeInTheDocument();
  });

  it('mobile menu button has proper ARIA attributes', () => {
    render(<Header />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    
    // Click to open menu
    fireEvent.click(menuButton);
    
    const closeButton = screen.getByRole('button', { name: /close menu/i });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders custom nav items with correct structure', () => {
    render(<Header navItems={customNavItems} />);
    
    customNavItems.forEach(item => {
      const link = screen.getByRole('link', { name: item.label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', item.href);
    });
  });

  it('handles navigation without scroll target', () => {
    // Mock querySelector to return null (element not found)
    const mockQuerySelector = vi.fn().mockReturnValue(null);
    
    Object.defineProperty(document, 'querySelector', {
      value: mockQuerySelector,
      writable: true
    });

    render(<Header />);
    
    const featuresLink = screen.getByRole('link', { name: 'Features' });
    
    // Should not throw error when element is not found
    expect(() => {
      fireEvent.click(featuresLink);
    }).not.toThrow();
    
    expect(mockQuerySelector).toHaveBeenCalledWith('#features');
  });

  it('closes mobile menu when nav link is clicked', () => {
    render(<Header />);
    
    // Open mobile menu
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(menuButton);
    
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    
    // Click a nav link
    const featuresLink = screen.getByRole('link', { name: 'Features' });
    fireEvent.click(featuresLink);
    
    // Menu should be closed
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('closes mobile menu when CTA is clicked', () => {
    render(<Header onCtaClick={mockOnCtaClick} />);
    
    // Open mobile menu
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(menuButton);
    
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    
    // Click CTA button
    const ctaButton = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(ctaButton);
    
    // Menu should be closed and callback should be called
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
  });
});
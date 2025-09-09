import React from 'react';
import { render, screen, fireEvent } from '../../test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import TestimonialCard from './TestimonialCard';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

describe('TestimonialCard', () => {
  const defaultProps = {
    quote: 'This is an amazing product that changed our workflow completely.',
    author: 'John Doe',
    title: 'CEO, Tech Company',
    avatar: '/avatars/john-doe.jpg',
  };

  it('renders with all required props', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    expect(screen.getByText(`"${defaultProps.quote}"`)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.author)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
  });

  it('renders quote with proper quotation marks', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    const quoteText = screen.getByText(`"${defaultProps.quote}"`);
    expect(quoteText).toBeInTheDocument();
  });

  it('renders avatar image when provided', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    const avatarImage = screen.getByAltText(`${defaultProps.author} avatar`);
    expect(avatarImage).toBeInTheDocument();
    expect(avatarImage).toHaveAttribute('src', defaultProps.avatar);
    expect(avatarImage).toHaveAttribute('loading', 'lazy');
  });

  it('shows initials when avatar is not provided', () => {
    const propsWithoutAvatar = { ...defaultProps, avatar: undefined };
    render(<TestimonialCard {...propsWithoutAvatar} />);
    
    const initialsElement = screen.getByLabelText(`${defaultProps.author} initials`);
    expect(initialsElement).toBeInTheDocument();
    expect(initialsElement).toHaveTextContent('JD'); // John Doe -> JD
  });

  it('shows initials when avatar fails to load', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    const avatarImage = screen.getByAltText(`${defaultProps.author} avatar`);
    
    // Simulate image load error
    fireEvent.error(avatarImage);
    
    const initialsElement = screen.getByLabelText(`${defaultProps.author} initials`);
    expect(initialsElement).toBeInTheDocument();
    expect(initialsElement).toHaveTextContent('JD');
  });

  it('generates correct initials for different name formats', () => {
    const testCases = [
      { name: 'John Doe', expected: 'JD' },
      { name: 'Mary Jane Watson', expected: 'MJ' },
      { name: 'SingleName', expected: 'S' },
      { name: 'Jean-Claude Van Damme', expected: 'JV' },
    ];

    testCases.forEach(({ name, expected }) => {
      const props = { ...defaultProps, author: name, avatar: undefined };
      const { unmount } = render(<TestimonialCard {...props} />);
      
      const initialsElement = screen.getByLabelText(`${name} initials`);
      expect(initialsElement).toHaveTextContent(expected);
      
      unmount();
    });
  });

  it('includes quote icon with proper accessibility attributes', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    const quoteIcon = screen.getByRole('img', { hidden: true });
    expect(quoteIcon).toBeInTheDocument();
    expect(quoteIcon).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-testimonial';
    render(<TestimonialCard {...defaultProps} className={customClass} />);
    
    // The className should be applied to the container
    const container = screen.getByText(`"${defaultProps.quote}"`).closest('div');
    expect(container).toHaveClass(customClass);
  });

  it('passes through additional props', () => {
    render(<TestimonialCard {...defaultProps} data-testid="testimonial-card" />);
    
    expect(screen.getByTestId('testimonial-card')).toBeInTheDocument();
  });

  it('handles delay prop for animations', () => {
    const delay = 0.5;
    render(<TestimonialCard {...defaultProps} delay={delay} />);
    
    // Since we're mocking framer-motion, we can't test the actual animation
    // but we can verify the component renders without errors
    expect(screen.getByText(defaultProps.author)).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    // Check that author name and title are properly structured
    expect(screen.getByText(defaultProps.author)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    
    // Check that quote is properly formatted
    expect(screen.getByText(`"${defaultProps.quote}"`)).toBeInTheDocument();
  });

  it('handles empty or whitespace author names gracefully', () => {
    const propsWithEmptyAuthor = { ...defaultProps, author: '  ', avatar: undefined };
    render(<TestimonialCard {...propsWithEmptyAuthor} />);
    
    // Should still render without crashing
    expect(screen.getByText(`"${defaultProps.quote}"`)).toBeInTheDocument();
  });

  it('handles very long quotes', () => {
    const longQuote = 'This is a very long testimonial quote that goes on and on and provides extensive detail about the amazing experience with the product and how it has transformed the entire business workflow and improved productivity significantly.';
    const propsWithLongQuote = { ...defaultProps, quote: longQuote };
    
    render(<TestimonialCard {...propsWithLongQuote} />);
    
    expect(screen.getByText(`"${longQuote}"`)).toBeInTheDocument();
  });

  it('handles special characters in names and quotes', () => {
    const specialProps = {
      ...defaultProps,
      author: 'José María García-López',
      quote: 'Amazing product! It\'s truly "game-changing" & revolutionary.',
    };
    
    render(<TestimonialCard {...specialProps} />);
    
    expect(screen.getByText(specialProps.author)).toBeInTheDocument();
    expect(screen.getByText(`"${specialProps.quote}"`)).toBeInTheDocument();
  });

  it('maintains proper contrast and accessibility', () => {
    render(<TestimonialCard {...defaultProps} />);
    
    // Verify that all text content is accessible
    expect(screen.getByText(defaultProps.author)).toBeVisible();
    expect(screen.getByText(defaultProps.title)).toBeVisible();
    expect(screen.getByText(`"${defaultProps.quote}"`)).toBeVisible();
  });
});
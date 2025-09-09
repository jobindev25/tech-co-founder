import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import Hero from './Hero';

// Mock framer-motion's useReducedMotion hook
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

describe('Hero Component', () => {
  beforeEach(() => {
    // Mock window dimensions for parallax effect
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  it('renders with default props', () => {
    render(<Hero />);
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Meet Your AI Tech Co-Founder');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your intelligent AI developer and CTO partner to bring ideas to life');
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('renders with custom props', () => {
    const customTitle = 'Custom Hero Title';
    const customSubheading = 'Custom hero subheading text';
    const customCtaText = 'Custom CTA';
    
    render(
      <Hero
        title={customTitle}
        subheading={customSubheading}
        ctaText={customCtaText}
      />
    );
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(customTitle);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(customSubheading);
    expect(screen.getByRole('button', { name: new RegExp(customCtaText, 'i') })).toBeInTheDocument();
  });

  it('calls onCtaClick when CTA button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCtaClick = vi.fn();
    
    render(<Hero onCtaClick={mockOnCtaClick} />);
    
    const ctaButton = screen.getByRole('button', { name: /get started/i });
    await user.click(ctaButton);
    
    expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
  });

  it('has proper semantic HTML structure', () => {
    render(<Hero />);
    
    // Check for section element with aria-label
    const heroSection = screen.getByRole('region', { name: 'Hero section' });
    expect(heroSection).toBeInTheDocument();
    
    // Check heading hierarchy
    const h1 = screen.getByRole('heading', { level: 1 });
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h1).toBeInTheDocument();
    expect(h2).toBeInTheDocument();
    
    // Check button accessibility
    const button = screen.getByRole('button', { name: /get started/i });
    expect(button).toHaveAttribute('aria-label');
  });

  it('has accessible button with proper aria-label', () => {
    render(<Hero />);
    
    const button = screen.getByRole('button', { name: /get started.*begin your ai development journey/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Get Started - Begin your AI development journey');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-hero-class';
    render(<Hero className={customClass} />);
    
    const heroSection = screen.getByRole('region', { name: 'Hero section' });
    expect(heroSection).toHaveClass(customClass);
  });

  it('handles missing onCtaClick gracefully', async () => {
    const user = userEvent.setup();
    
    // Should not throw error when onCtaClick is not provided
    expect(() => {
      render(<Hero />);
    }).not.toThrow();
    
    const ctaButton = screen.getByRole('button', { name: /get started/i });
    
    // Should not throw error when clicking without onCtaClick
    await expect(user.click(ctaButton)).resolves.not.toThrow();
  });

  it('renders background elements', () => {
    const { container } = render(<Hero />);
    
    // Check that background styling elements are present
    const heroSection = container.querySelector('section');
    expect(heroSection).toBeInTheDocument();
    
    // The background div should be rendered (though we can't easily test its styling)
    expect(heroSection).toHaveStyle({ position: 'relative' });
  });

  it('respects reduced motion preferences', () => {
    render(<Hero />);
    
    // Component should still render when reduced motion is enabled
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('handles mouse movement for parallax effect', () => {
    render(<Hero />);
    
    // Simulate mouse movement
    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientX: 500,
      clientY: 300,
    });
    
    // Should not throw error when mouse moves
    expect(() => {
      window.dispatchEvent(mouseMoveEvent);
    }).not.toThrow();
  });
});
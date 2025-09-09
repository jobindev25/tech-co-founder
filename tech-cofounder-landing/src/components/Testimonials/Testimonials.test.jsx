import React from 'react';
import { render, screen } from '../../test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import Testimonials from './Testimonials';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

// Mock TestimonialCard component to focus on container logic
vi.mock('./TestimonialCard', () => ({
  default: ({ quote, author, title, avatar, delay }) => (
    <div data-testid="testimonial-card" data-delay={delay}>
      <div data-testid="quote">{quote}</div>
      <div data-testid="author">{author}</div>
      <div data-testid="title">{title}</div>
      {avatar && <div data-testid="avatar">{avatar}</div>}
    </div>
  ),
}));

describe('Testimonials', () => {
  const customTestimonials = [
    {
      id: 'test-1',
      quote: 'First testimonial quote',
      author: 'John Smith',
      title: 'CEO, Company A',
      avatar: '/avatars/john.jpg'
    },
    {
      id: 'test-2',
      quote: 'Second testimonial quote',
      author: 'Jane Doe',
      title: 'CTO, Company B',
      avatar: '/avatars/jane.jpg'
    }
  ];

  it('renders with default props', () => {
    render(<Testimonials />);
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('What Our Users Say');
    expect(screen.getByText("Hear from founders and developers who've transformed their workflow with AI assistance")).toBeInTheDocument();
  });

  it('renders with custom title and subtitle', () => {
    const customTitle = 'Customer Reviews';
    const customSubtitle = 'See what our customers think';
    
    render(
      <Testimonials
        title={customTitle}
        subtitle={customSubtitle}
      />
    );
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(customTitle);
    expect(screen.getByText(customSubtitle)).toBeInTheDocument();
  });

  it('renders default testimonials', () => {
    render(<Testimonials />);
    
    // Check for default testimonial content
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Marcus Rodriguez')).toBeInTheDocument();
    expect(screen.getByText('Emily Watson')).toBeInTheDocument();
    
    // Check for default testimonial quotes
    expect(screen.getByText('Tech Co-Founder transformed how we approach software development. The AI CTO capabilities are game-changing.')).toBeInTheDocument();
    expect(screen.getByText('Finally, an AI partner that understands both technical requirements and business needs.')).toBeInTheDocument();
    expect(screen.getByText('The spec-driven development approach saved us months of development time.')).toBeInTheDocument();
  });

  it('renders custom testimonials', () => {
    render(<Testimonials testimonials={customTestimonials} />);
    
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('First testimonial quote')).toBeInTheDocument();
    expect(screen.getByText('Second testimonial quote')).toBeInTheDocument();
  });

  it('passes correct props to TestimonialCard components', () => {
    render(<Testimonials testimonials={customTestimonials} />);
    
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    expect(testimonialCards).toHaveLength(2);
    
    // Check first testimonial
    expect(screen.getByText('First testimonial quote')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('CEO, Company A')).toBeInTheDocument();
    
    // Check second testimonial
    expect(screen.getByText('Second testimonial quote')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('CTO, Company B')).toBeInTheDocument();
  });

  it('applies staggered delays to testimonial cards', () => {
    render(<Testimonials testimonials={customTestimonials} />);
    
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    
    // Check that delays are applied incrementally
    expect(testimonialCards[0]).toHaveAttribute('data-delay', '0');
    expect(testimonialCards[1]).toHaveAttribute('data-delay', '0.1');
  });

  it('has proper semantic HTML structure', () => {
    render(<Testimonials />);
    
    // Check for section with aria-labelledby
    const section = screen.getByRole('region');
    expect(section).toHaveAttribute('aria-labelledby', 'testimonials-title');
    
    // Check for proper heading
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'testimonials-title');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-testimonials';
    render(<Testimonials className={customClass} />);
    
    const section = screen.getByRole('region');
    expect(section).toHaveClass(customClass);
  });

  it('passes through additional props', () => {
    render(<Testimonials data-testid="testimonials-section" />);
    
    expect(screen.getByTestId('testimonials-section')).toBeInTheDocument();
  });

  it('handles empty testimonials array', () => {
    render(<Testimonials testimonials={[]} />);
    
    // Should still render title and subtitle
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('What Our Users Say');
    expect(screen.getByText("Hear from founders and developers who've transformed their workflow with AI assistance")).toBeInTheDocument();
    
    // Should not render any testimonial cards
    expect(screen.queryAllByTestId('testimonial-card')).toHaveLength(0);
  });

  it('renders correct number of testimonial cards', () => {
    render(<Testimonials />);
    
    // Should render 3 default testimonials
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    expect(testimonialCards).toHaveLength(3);
  });

  it('handles single testimonial', () => {
    const singleTestimonial = [customTestimonials[0]];
    render(<Testimonials testimonials={singleTestimonial} />);
    
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    expect(testimonialCards).toHaveLength(1);
    
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('First testimonial quote')).toBeInTheDocument();
  });

  it('renders all default testimonial authors and titles', () => {
    render(<Testimonials />);
    
    // Check authors
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Marcus Rodriguez')).toBeInTheDocument();
    expect(screen.getByText('Emily Watson')).toBeInTheDocument();
    
    // Check titles
    expect(screen.getByText('Founder, InnovateLab')).toBeInTheDocument();
    expect(screen.getByText('CEO, StartupFlow')).toBeInTheDocument();
    expect(screen.getByText('Product Manager, TechVenture')).toBeInTheDocument();
  });

  it('maintains proper heading hierarchy', () => {
    render(<Testimonials />);
    
    // Main section heading should be h2
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toHaveTextContent('What Our Users Say');
  });

  it('handles testimonials with missing optional fields', () => {
    const testimonialsWithMissingFields = [
      {
        id: 'test-1',
        quote: 'Great product!',
        author: 'Test Author',
        title: 'Test Title',
        // avatar is missing
      }
    ];
    
    render(<Testimonials testimonials={testimonialsWithMissingFields} />);
    
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('Great product!')).toBeInTheDocument();
    
    // Avatar should not be rendered
    expect(screen.queryByTestId('avatar')).not.toBeInTheDocument();
  });

  it('renders testimonials in correct order', () => {
    render(<Testimonials testimonials={customTestimonials} />);
    
    const quotes = screen.getAllByTestId('quote');
    expect(quotes[0]).toHaveTextContent('First testimonial quote');
    expect(quotes[1]).toHaveTextContent('Second testimonial quote');
  });

  it('handles large number of testimonials', () => {
    const manyTestimonials = Array.from({ length: 10 }, (_, index) => ({
      id: `test-${index}`,
      quote: `Quote ${index + 1}`,
      author: `Author ${index + 1}`,
      title: `Title ${index + 1}`,
      avatar: `/avatar-${index + 1}.jpg`
    }));
    
    render(<Testimonials testimonials={manyTestimonials} />);
    
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    expect(testimonialCards).toHaveLength(10);
    
    // Check first and last testimonials
    expect(screen.getByText('Author 1')).toBeInTheDocument();
    expect(screen.getByText('Author 10')).toBeInTheDocument();
  });

  it('applies correct delay values for multiple testimonials', () => {
    const manyTestimonials = Array.from({ length: 5 }, (_, index) => ({
      id: `test-${index}`,
      quote: `Quote ${index + 1}`,
      author: `Author ${index + 1}`,
      title: `Title ${index + 1}`,
    }));
    
    render(<Testimonials testimonials={manyTestimonials} />);
    
    const testimonialCards = screen.getAllByTestId('testimonial-card');
    
    // Check that delays increment by 0.1
    testimonialCards.forEach((card, index) => {
      expect(card).toHaveAttribute('data-delay', (index * 0.1).toString());
    });
  });

  it('handles testimonials with special characters', () => {
    const specialTestimonials = [
      {
        id: 'special-1',
        quote: 'Amazing! It\'s "revolutionary" & game-changing.',
        author: 'José María García',
        title: 'CEO & Founder',
        avatar: '/avatar.jpg'
      }
    ];
    
    render(<Testimonials testimonials={specialTestimonials} />);
    
    expect(screen.getByText('José María García')).toBeInTheDocument();
    expect(screen.getByText('CEO & Founder')).toBeInTheDocument();
    expect(screen.getByText('Amazing! It\'s "revolutionary" & game-changing.')).toBeInTheDocument();
  });
});
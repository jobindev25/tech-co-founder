import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import Features from './Features';

// Mock framer-motion for testing
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      section: ({ children, ...props }) => <section {...props}>{children}</section>,
      div: ({ children, ...props }) => <div {...props}>{children}</div>,
    },
  };
});

describe('Features Component', () => {
  it('renders with default props', () => {
    render(<Features />);
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Powerful Features for Modern Development');
    expect(screen.getByText('Everything you need to build, deploy, and scale your applications with AI assistance')).toBeInTheDocument();
    
    // Check that all four default features are rendered
    expect(screen.getByText('Conversational Planning')).toBeInTheDocument();
    expect(screen.getByText('Spec-Driven Development')).toBeInTheDocument();
    expect(screen.getByText('Seamless Collaboration')).toBeInTheDocument();
    expect(screen.getByText('Real-time Code Reviews')).toBeInTheDocument();
  });

  it('renders with custom title and subtitle', () => {
    const customTitle = 'Custom Features Title';
    const customSubtitle = 'Custom features subtitle text';
    
    render(<Features title={customTitle} subtitle={customSubtitle} />);
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(customTitle);
    expect(screen.getByText(customSubtitle)).toBeInTheDocument();
  });

  it('renders with custom features data', () => {
    const customFeatures = [
      {
        id: 'feature-1',
        title: 'Custom Feature 1',
        description: 'Description for custom feature 1',
        icon: 'FiStar'
      },
      {
        id: 'feature-2',
        title: 'Custom Feature 2',
        description: 'Description for custom feature 2',
        icon: 'FiHeart'
      }
    ];
    
    render(<Features features={customFeatures} />);
    
    expect(screen.getByText('Custom Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Custom Feature 2')).toBeInTheDocument();
    expect(screen.getByText('Description for custom feature 1')).toBeInTheDocument();
    expect(screen.getByText('Description for custom feature 2')).toBeInTheDocument();
    
    // Should not render default features
    expect(screen.queryByText('Conversational Planning')).not.toBeInTheDocument();
  });

  it('has proper semantic HTML structure', () => {
    render(<Features />);
    
    // Check for section element
    const section = screen.getByRole('region');
    expect(section).toBeInTheDocument();
    
    // Check for proper heading hierarchy
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toBeInTheDocument();
    expect(mainHeading).toHaveAttribute('id', 'features-title');
    
    // Check that section has proper aria-labelledby
    expect(section).toHaveAttribute('aria-labelledby', 'features-title');
    
    // Check for feature card headings (h3)
    const featureHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(featureHeadings).toHaveLength(4); // Default features
  });

  it('renders all default feature data correctly', () => {
    render(<Features />);
    
    // Test all default features
    const expectedFeatures = [
      {
        title: 'Conversational Planning',
        description: 'Interactive AI CTO to plan and iterate projects with natural language conversations.'
      },
      {
        title: 'Spec-Driven Development',
        description: 'Automated code generation from detailed specifications and requirements.'
      },
      {
        title: 'Seamless Collaboration',
        description: 'Notion and GitHub integrated workflows for streamlined project management.'
      },
      {
        title: 'Real-time Code Reviews',
        description: 'Instant AI feedback and automated PR reviews for code quality assurance.'
      }
    ];

    expectedFeatures.forEach(feature => {
      expect(screen.getByText(feature.title)).toBeInTheDocument();
      expect(screen.getByText(feature.description)).toBeInTheDocument();
    });
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-features-class';
    const { container } = render(<Features className={customClass} />);
    
    const sectionElement = container.querySelector('section');
    expect(sectionElement).toHaveClass(customClass);
  });

  it('handles empty features array gracefully', () => {
    render(<Features features={[]} />);
    
    // Should still render header
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    
    // Should not render any feature cards
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('renders correct number of feature cards', () => {
    const threeFeatures = [
      {
        id: 'feature-1',
        title: 'Feature 1',
        description: 'Description 1',
        icon: 'FiStar'
      },
      {
        id: 'feature-2',
        title: 'Feature 2',
        description: 'Description 2',
        icon: 'FiHeart'
      },
      {
        id: 'feature-3',
        title: 'Feature 3',
        description: 'Description 3',
        icon: 'FiThumbsUp'
      }
    ];
    
    render(<Features features={threeFeatures} />);
    
    const featureHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(featureHeadings).toHaveLength(3);
  });

  it('has proper grid layout structure', () => {
    const { container } = render(<Features />);
    
    // Check that the grid container exists
    const gridContainer = container.querySelector('section > div > div:last-child');
    expect(gridContainer).toBeInTheDocument();
    
    // Check that feature cards are direct children of the grid
    const featureCards = gridContainer.children;
    expect(featureCards).toHaveLength(4); // Default features
  });

  it('passes correct delay props to feature cards', () => {
    const customFeatures = [
      {
        id: 'feature-1',
        title: 'Feature 1',
        description: 'Description 1',
        icon: 'FiStar'
      },
      {
        id: 'feature-2',
        title: 'Feature 2',
        description: 'Description 2',
        icon: 'FiHeart'
      }
    ];
    
    // Should not throw error when rendering with delays
    expect(() => {
      render(<Features features={customFeatures} />);
    }).not.toThrow();
    
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
  });
});
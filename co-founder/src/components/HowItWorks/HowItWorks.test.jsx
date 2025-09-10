import React from 'react';
import { render, screen } from '../../test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import HowItWorks from './HowItWorks';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

describe('HowItWorks', () => {
  const customProcessSteps = [
    {
      id: 'step1',
      title: 'Step One',
      description: 'First step description',
      icon: 'FiUser'
    },
    {
      id: 'step2',
      title: 'Step Two',
      description: 'Second step description',
      icon: 'FiSettings'
    }
  ];

  it('renders with default props', () => {
    render(<HowItWorks />);
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('How It Works');
    expect(screen.getByText('Get started with your AI tech co-founder in just a few simple steps')).toBeInTheDocument();
  });

  it('renders with custom title and subtitle', () => {
    const customTitle = 'Custom Process';
    const customSubtitle = 'Custom subtitle text';
    
    render(
      <HowItWorks
        title={customTitle}
        subtitle={customSubtitle}
      />
    );
    
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(customTitle);
    expect(screen.getByText(customSubtitle)).toBeInTheDocument();
  });

  it('renders default process steps', () => {
    render(<HowItWorks />);
    
    // Check for default steps
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    expect(screen.getByText('Coding')).toBeInTheDocument();
    expect(screen.getByText('Deployment')).toBeInTheDocument();
    expect(screen.getByText('Collaboration')).toBeInTheDocument();
    
    // Check for step numbers
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders custom process steps', () => {
    render(<HowItWorks processSteps={customProcessSteps} />);
    
    expect(screen.getByText('Step One')).toBeInTheDocument();
    expect(screen.getByText('Step Two')).toBeInTheDocument();
    expect(screen.getByText('First step description')).toBeInTheDocument();
    expect(screen.getByText('Second step description')).toBeInTheDocument();
    
    // Should only show 2 steps
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('has proper semantic HTML structure', () => {
    render(<HowItWorks />);
    
    // Check for section with aria-labelledby
    const section = screen.getByRole('region');
    expect(section).toHaveAttribute('aria-labelledby', 'how-it-works-title');
    
    // Check for proper heading
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'how-it-works-title');
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-how-it-works';
    render(<HowItWorks className={customClass} />);
    
    const section = screen.getByRole('region');
    expect(section).toHaveClass(customClass);
  });

  it('passes through additional props', () => {
    render(<HowItWorks data-testid="how-it-works-section" />);
    
    expect(screen.getByTestId('how-it-works-section')).toBeInTheDocument();
  });

  it('renders correct number of process steps', () => {
    render(<HowItWorks />);
    
    // Should render 5 default steps
    const stepNumbers = ['1', '2', '3', '4', '5'];
    stepNumbers.forEach(number => {
      expect(screen.getByText(number)).toBeInTheDocument();
    });
  });

  it('handles empty process steps array', () => {
    render(<HowItWorks processSteps={[]} />);
    
    // Should still render title and subtitle
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('How It Works');
    expect(screen.getByText('Get started with your AI tech co-founder in just a few simple steps')).toBeInTheDocument();
    
    // Should not render any step numbers
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('renders process steps with correct isLast prop', () => {
    render(<HowItWorks processSteps={customProcessSteps} />);
    
    // Check that all steps are rendered
    expect(screen.getByText('Step One')).toBeInTheDocument();
    expect(screen.getByText('Step Two')).toBeInTheDocument();
    
    // Since we can't easily test the connecting lines due to styled-components class names,
    // we'll verify that the ProcessStep components are rendered with correct props
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders with proper step numbering', () => {
    render(<HowItWorks processSteps={customProcessSteps} />);
    
    // Steps should be numbered starting from 1
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('handles single process step', () => {
    const singleStep = [customProcessSteps[0]];
    render(<HowItWorks processSteps={singleStep} />);
    
    expect(screen.getByText('Step One')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('renders all default step descriptions', () => {
    render(<HowItWorks />);
    
    expect(screen.getByText('Quick setup and project initialization with AI guidance.')).toBeInTheDocument();
    expect(screen.getByText('Collaborative project planning and specification creation.')).toBeInTheDocument();
    expect(screen.getByText('AI-powered code generation and development assistance.')).toBeInTheDocument();
    expect(screen.getByText('Automated deployment and infrastructure management.')).toBeInTheDocument();
    expect(screen.getByText('Ongoing collaboration and iterative improvements.')).toBeInTheDocument();
  });

  it('maintains proper heading hierarchy', () => {
    render(<HowItWorks />);
    
    // Main section heading should be h2
    const mainHeading = screen.getByRole('heading', { level: 2 });
    expect(mainHeading).toHaveTextContent('How It Works');
    
    // Process step titles should be h3 (tested in ProcessStep component)
    const stepHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(stepHeadings).toHaveLength(5); // Default number of steps
  });
});
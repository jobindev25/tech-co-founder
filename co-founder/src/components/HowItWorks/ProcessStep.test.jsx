import React from 'react';
import { render, screen } from '../../test/test-utils';
import { describe, it, expect, vi } from 'vitest';
import ProcessStep from './ProcessStep';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

describe('ProcessStep', () => {
  const defaultProps = {
    step: 1,
    title: 'Test Step',
    description: 'This is a test step description',
    icon: 'FiUser',
  };

  it('renders step number, title, and description', () => {
    render(<ProcessStep {...defaultProps} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Test Step')).toBeInTheDocument();
    expect(screen.getByText('This is a test step description')).toBeInTheDocument();
  });

  it('renders with correct heading level for title', () => {
    render(<ProcessStep {...defaultProps} />);

    const title = screen.getByRole('heading', { level: 3 });
    expect(title).toHaveTextContent('Test Step');
  });

  it('renders icon with proper accessibility attributes', () => {
    const { container } = render(<ProcessStep {...defaultProps} />);

    // Icon should be hidden from screen readers
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('does not render connecting line when isLast is true', () => {
    const { container } = render(
      <ProcessStep {...defaultProps} isLast={true} />
    );

    // Check that connecting line is not present - look for the styled component
    const connectingLine = container.querySelector('[class*="sc-dTvVRJ"]');
    expect(connectingLine).not.toBeInTheDocument();
  });

  it('renders connecting line when isLast is false', () => {
    const { container } = render(
      <ProcessStep {...defaultProps} isLast={false} />
    );

    // Check that connecting line is present - look for the styled component
    const connectingLine = container.querySelector('[class*="sc-dTvVRJ"]');
    expect(connectingLine).toBeInTheDocument();
  });

  it('renders connecting line by default (when isLast is not specified)', () => {
    const { container } = render(<ProcessStep {...defaultProps} />);

    // Check that connecting line is present by default - look for the styled component
    const connectingLine = container.querySelector('[class*="sc-dTvVRJ"]');
    expect(connectingLine).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <ProcessStep {...defaultProps} className="custom-class" />
    );

    const stepContainer = container.firstChild;
    expect(stepContainer).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(
      <ProcessStep {...defaultProps} data-testid="process-step" />
    );

    expect(screen.getByTestId('process-step')).toBeInTheDocument();
  });

  it('handles different step numbers correctly', () => {
    render(<ProcessStep {...defaultProps} step={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('handles different icons correctly', () => {
    const { container } = render(<ProcessStep {...defaultProps} icon="FiSettings" />);

    // Icon should still be rendered (we can't easily test which specific icon)
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('falls back to default icon when invalid icon is provided', () => {
    const { container } = render(<ProcessStep {...defaultProps} icon="InvalidIcon" />);

    // Should still render an icon (fallback to FiCircle)
    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });

  it('renders with proper semantic structure', () => {
    render(<ProcessStep {...defaultProps} />);

    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toBeInTheDocument();

    // Check for step number
    expect(screen.getByText('1')).toBeInTheDocument();

    // Check for description text
    expect(screen.getByText('This is a test step description')).toBeInTheDocument();
  });

  it('handles long titles and descriptions gracefully', () => {
    const longProps = {
      ...defaultProps,
      title: 'This is a very long title that should wrap properly on smaller screens',
      description: 'This is a very long description that contains multiple sentences and should wrap properly across different screen sizes while maintaining readability and proper spacing.',
    };

    render(<ProcessStep {...longProps} />);

    expect(screen.getByText(longProps.title)).toBeInTheDocument();
    expect(screen.getByText(longProps.description)).toBeInTheDocument();
  });
});
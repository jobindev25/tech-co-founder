import React from 'react';
import { render, screen } from '../../test/test-utils';
import { describe, it, expect } from 'vitest';
import TestCard from './TestCard';

describe('TestimonialCard Simple Test', () => {
  it('renders without crashing', () => {
    const props = {
      quote: 'Test quote',
      author: 'Test Author',
      title: 'Test Title',
    };
    
    render(<TestCard {...props} />);
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });
});
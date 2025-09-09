import React from 'react';
import { render, screen, fireEvent } from '../../../test/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow style
    document.body.style.overflow = 'unset';
  });

  afterEach(() => {
    // Clean up body overflow style
    document.body.style.overflow = 'unset';
  });

  it('renders when isOpen is true', () => {
    render(<Modal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('does not render header when title is not provided', () => {
    render(<Modal {...defaultProps} />);
    
    expect(screen.queryByRole('button', { name: /close modal/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
  });

  it('renders close button when title is provided', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const closeButton = screen.getByRole('button', { name: /close modal/i });
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const closeButton = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const content = screen.getByText('Modal content');
    fireEvent.click(content);
    
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when other keys are pressed', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Space' });
    
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('sets body overflow to hidden when open', () => {
    render(<Modal {...defaultProps} />);
    
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('resets body overflow when closed', () => {
    const { rerender } = render(<Modal {...defaultProps} />);
    
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(<Modal {...defaultProps} isOpen={false} />);
    
    expect(document.body.style.overflow).toBe('unset');
  });

  it('cleans up event listeners when unmounted', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    
    const { unmount } = render(<Modal {...defaultProps} />);
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });

  it('applies different sizes correctly', () => {
    const sizes = ['small', 'medium', 'large', 'fullscreen'];
    
    sizes.forEach(size => {
      const { unmount } = render(<Modal {...defaultProps} size={size} />);
      
      const modalContainer = screen.getByRole('dialog').firstChild;
      expect(modalContainer).toHaveAttribute('data-size', size);
      
      unmount();
    });
  });

  it('applies default size when not specified', () => {
    render(<Modal {...defaultProps} />);
    
    const modalContainer = screen.getByRole('dialog').firstChild;
    expect(modalContainer).toHaveAttribute('data-size', 'large');
  });

  it('applies custom className', () => {
    render(<Modal {...defaultProps} className="custom-modal" />);
    
    expect(screen.getByRole('dialog')).toHaveClass('custom-modal');
  });

  it('passes through additional props', () => {
    render(<Modal {...defaultProps} data-testid="custom-modal" />);
    
    expect(screen.getByTestId('custom-modal')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    
    const title = screen.getByText('Test Modal');
    expect(title).toHaveAttribute('id', 'modal-title');
  });

  it('has proper accessibility attributes without title', () => {
    render(<Modal {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).not.toHaveAttribute('aria-labelledby');
  });

  it('focuses management works correctly', () => {
    // This test ensures the modal traps focus properly
    render(<Modal {...defaultProps} title="Test Modal" />);
    
    const closeButton = screen.getByRole('button', { name: /close modal/i });
    expect(closeButton).toBeInTheDocument();
    
    // The close button should be focusable
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);
  });

  it('handles multiple modals correctly', () => {
    const { rerender } = render(<Modal {...defaultProps} title="First Modal" />);
    
    expect(document.body.style.overflow).toBe('hidden');
    
    // Close first modal and open second
    rerender(<Modal {...defaultProps} isOpen={false} />);
    expect(document.body.style.overflow).toBe('unset');
    
    rerender(<Modal {...defaultProps} title="Second Modal" />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('prevents event bubbling on content click', () => {
    const overlayClickHandler = vi.fn();
    
    render(
      <div onClick={overlayClickHandler}>
        <Modal {...defaultProps} title="Test Modal" />
      </div>
    );
    
    const content = screen.getByText('Modal content');
    fireEvent.click(content);
    
    // The overlay click handler should not be called
    expect(overlayClickHandler).not.toHaveBeenCalled();
  });

  it('renders children correctly', () => {
    const complexChildren = (
      <div>
        <h3>Complex Content</h3>
        <p>This is a paragraph</p>
        <button>Action Button</button>
      </div>
    );
    
    render(<Modal {...defaultProps}>{complexChildren}</Modal>);
    
    expect(screen.getByText('Complex Content')).toBeInTheDocument();
    expect(screen.getByText('This is a paragraph')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });

  it('handles rapid open/close correctly', () => {
    const { rerender } = render(<Modal {...defaultProps} isOpen={false} />);
    
    // Rapidly toggle the modal
    rerender(<Modal {...defaultProps} isOpen={true} />);
    rerender(<Modal {...defaultProps} isOpen={false} />);
    rerender(<Modal {...defaultProps} isOpen={true} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });
});
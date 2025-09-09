import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TavusModal from './TavusModal';

// Mock the Modal component
vi.mock('../common/Modal/Modal', () => ({
  default: ({ isOpen, onClose, title, children, ...props }) => (
    isOpen ? (
      <div data-testid="modal" {...props}>
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        <div data-testid="modal-content">{children}</div>
      </div>
    ) : null
  ),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TavusModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  const mockConversationResponse = {
    conversation_id: 'test-conversation-123',
    conversation_url: 'https://tavus.io/conversations/test-conversation-123',
    status: 'active',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variable
    process.env.REACT_APP_TAVUS_PERSONA_ID = 'test-persona-id';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal when open', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} />);
    
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Meet Your AI Tech Co-Founder');
  });

  it('does not render when closed', () => {
    render(<TavusModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    
    render(<TavusModal {...defaultProps} />);
    
    expect(screen.getByText('Starting your AI conversation...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('creates conversation when modal opens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tavus/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          persona_id: 'test-persona-id',
        }),
      });
    });
  });

  it('displays video iframe when conversation is created successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      const iframe = screen.getByTitle('AI Tech Co-Founder Conversation');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', mockConversationResponse.conversation_url);
      expect(iframe).toHaveAttribute('allow', 'camera; microphone; fullscreen');
      expect(iframe).toHaveAttribute('allowFullScreen');
    });
  });

  it('calls onConversationStart when conversation is created', async () => {
    const onConversationStart = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} onConversationStart={onConversationStart} />);
    
    await waitFor(() => {
      expect(onConversationStart).toHaveBeenCalledWith(mockConversationResponse);
    });
  });

  it('displays error message when conversation creation fails', async () => {
    const errorMessage = 'Failed to create conversation: Server Error';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    });

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to create conversation: Server Error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('displays error message when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('displays error when no conversation URL is received', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ conversation_id: 'test-123' }), // Missing conversation_url
    });

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No conversation URL received from server')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('retries conversation creation when retry button is clicked', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Server Error',
    });

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    fireEvent.click(screen.getByText('Try Again'));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(screen.getByTitle('AI Tech Co-Founder Conversation')).toBeInTheDocument();
    });
  });

  it('resets state when modal is closed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    const { rerender } = render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTitle('AI Tech Co-Founder Conversation')).toBeInTheDocument();
    });

    // Close modal
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(defaultProps.onClose).toHaveBeenCalled();

    // Reopen modal - should start fresh
    rerender(<TavusModal {...defaultProps} isOpen={false} />);
    rerender(<TavusModal {...defaultProps} isOpen={true} />);
    
    expect(screen.getByText('Starting your AI conversation...')).toBeInTheDocument();
  });

  it('does not create conversation if already loading', () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    
    const { rerender } = render(<TavusModal {...defaultProps} />);
    
    // Rerender with same props - should not trigger another fetch
    rerender(<TavusModal {...defaultProps} />);
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not create conversation if error exists', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { rerender } = render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Rerender - should not trigger another fetch
    rerender(<TavusModal {...defaultProps} />);
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not create conversation if conversation URL already exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    const { rerender } = render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTitle('AI Tech Co-Founder Conversation')).toBeInTheDocument();
    });

    // Rerender - should not trigger another fetch
    rerender(<TavusModal {...defaultProps} />);
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} className="custom-tavus-modal" />);
    
    expect(screen.getByTestId('modal')).toHaveClass('custom-tavus-modal');
  });

  it('passes through additional props to Modal', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} data-testid="custom-modal" />);
    
    expect(screen.getByTestId('custom-modal')).toBeInTheDocument();
  });

  it('handles missing persona_id gracefully', async () => {
    delete process.env.REACT_APP_TAVUS_PERSONA_ID;
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversationResponse),
    });

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tavus/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          persona_id: undefined,
        }),
      });
    });
  });

  it('logs errors to console', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');
    
    mockFetch.mockRejectedValueOnce(error);

    render(<TavusModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error creating Tavus conversation:', error);
    });

    consoleSpy.mockRestore();
  });
});
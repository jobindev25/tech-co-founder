import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { vi } from 'vitest';
import ProjectDashboard from './ProjectDashboard';
import { theme } from '../../styles/theme';

// Mock useParams
const mockUseParams = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockUseParams(),
  };
});

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
}));

// Mock fetch
global.fetch = vi.fn();

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('ProjectDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ conversationId: 'test-conversation-123' });
    
    // Mock successful fetch response
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        project_name: 'Test Project',
        project_description: 'A test project description',
        status: 'building'
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    renderWithProviders(<ProjectDashboard />);
    
    expect(screen.getByText('Loading your project...')).toBeInTheDocument();
  });

  it('renders project dashboard with stages', async () => {
    renderWithProviders(<ProjectDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
    
    expect(screen.getByText('A test project description')).toBeInTheDocument();
    expect(screen.getByText('Conversation Analysis')).toBeInTheDocument();
    expect(screen.getByText('Project Plan Generation')).toBeInTheDocument();
    expect(screen.getByText('Kiro Build Trigger')).toBeInTheDocument();
    expect(screen.getByText('Build in Progress')).toBeInTheDocument();
    expect(screen.getByText('Build Complete')).toBeInTheDocument();
  });

  it('displays connection status', async () => {
    renderWithProviders(<ProjectDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Connected|Connecting|Disconnected/)).toBeInTheDocument();
    });
  });

  it('shows activity feed', async () => {
    renderWithProviders(<ProjectDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Project dashboard initialized')).toBeInTheDocument();
  });

  it('handles fetch error gracefully', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    
    renderWithProviders(<ProjectDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
  });

  it('renders with fallback project name when data is missing', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    
    renderWithProviders(<ProjectDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Project test-conversation-123')).toBeInTheDocument();
    });
  });

  it('displays pipeline stages with correct initial states', async () => {
    renderWithProviders(<ProjectDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });
    
    // Check that stages are rendered with appropriate status indicators
    const stageItems = screen.getAllByText(/PENDING|IN_PROGRESS/);
    expect(stageItems.length).toBeGreaterThan(0);
  });
});
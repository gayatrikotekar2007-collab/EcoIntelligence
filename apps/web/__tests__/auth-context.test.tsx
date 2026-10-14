import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../lib/auth-context';
import * as api from '../lib/api';
import { useRouter } from 'next/navigation';

// Mock API boundaries
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    authApi: {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getMe: vi.fn(),
    },
    getStoredToken: vi.fn(),
    setStoredToken: vi.fn(),
    removeStoredToken: vi.fn(),
    onUnauthorized: vi.fn(),
  };
});

const mockUser: api.User = {
  id: 1,
  email: 'investigator@ecointelligence.org',
  display_name: 'Lead Investigator',
  role: 'admin',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function TestConsumer() {
  const { user, token, isLoading, login, logout, refreshUser } = useAuth();

  if (isLoading) {
    return <div data-testid="auth-loading">Loading session...</div>;
  }

  return (
    <div>
      <div data-testid="user-info">{user ? user.email : 'No user'}</div>
      <div data-testid="token-info">{token ? token : 'No token'}</div>
      <button
        onClick={() =>
          login({
            email: 'investigator@ecointelligence.org',
            password: 'SecurePassword123!',
          })
        }
      >
        Trigger Login
      </button>
      <button onClick={() => logout()}>Trigger Logout</button>
      <button onClick={() => refreshUser()}>Trigger Refresh</button>
    </div>
  );
}

describe('AuthContext and AuthProvider', () => {
  let mockRouterReplace: ReturnType<typeof vi.fn>;
  let unsubscribeMock: ReturnType<typeof vi.fn>;
  let capturedUnauthorizedCb: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterReplace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: mockRouterReplace,
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as any);

    unsubscribeMock = vi.fn();
    capturedUnauthorizedCb = null;
    vi.mocked(api.onUnauthorized).mockImplementation((cb) => {
      capturedUnauthorizedCb = cb;
      return unsubscribeMock;
    });
  });

  it('renders initial unauthenticated state when no token is stored', async () => {
    vi.mocked(api.getStoredToken).mockReturnValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('user-info')).toHaveTextContent('No user');
    expect(screen.getByTestId('token-info')).toHaveTextContent('No token');
    expect(screen.queryByTestId('auth-loading')).not.toBeInTheDocument();
  });

  it('successfully initializes user and token when stored token is valid', async () => {
    vi.mocked(api.getStoredToken).mockReturnValue('valid-stored-token');
    vi.mocked(api.authApi.getMe).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('user-info')).toHaveTextContent('investigator@ecointelligence.org');
    expect(screen.getByTestId('token-info')).toHaveTextContent('valid-stored-token');
    expect(api.authApi.getMe).toHaveBeenCalledTimes(1);
  });

  it('invalidates session, clears token, and redirects to login when getMe fails on protected route', async () => {
    vi.mocked(api.getStoredToken).mockReturnValue('expired-or-revoked-token');
    vi.mocked(api.authApi.getMe).mockRejectedValue(new Error('Session expired'));

    // Set pathname to a protected route
    window.history.pushState({}, 'Dashboard', '/dashboard');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('user-info')).toHaveTextContent('No user');
    expect(screen.getByTestId('token-info')).toHaveTextContent('No token');
    expect(api.removeStoredToken).toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/login');
  });

  it('handles login by storing token and populating user state', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStoredToken).mockReturnValue(null);
    vi.mocked(api.authApi.login).mockResolvedValue({
      access_token: 'new-login-token-123',
      token_type: 'bearer',
      user: mockUser,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('user-info')).toHaveTextContent('No user');

    await user.click(screen.getByRole('button', { name: /trigger login/i }));

    expect(await screen.findByTestId('user-info')).toHaveTextContent('investigator@ecointelligence.org');
    expect(screen.getByTestId('token-info')).toHaveTextContent('new-login-token-123');
    expect(api.setStoredToken).toHaveBeenCalledWith('new-login-token-123');
  });

  it('handles logout by invoking API, removing stored token, and clearing state', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStoredToken).mockReturnValue('active-session-token');
    vi.mocked(api.authApi.getMe).mockResolvedValue(mockUser);
    vi.mocked(api.authApi.logout).mockResolvedValue(undefined as any);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('user-info')).toHaveTextContent('investigator@ecointelligence.org');

    await user.click(screen.getByRole('button', { name: /trigger logout/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('No user');
      expect(screen.getByTestId('token-info')).toHaveTextContent('No token');
    });

    expect(api.authApi.logout).toHaveBeenCalledTimes(1);
    expect(api.removeStoredToken).toHaveBeenCalled();
  });

  it('invalidates session when an unauthorized event is broadcast', async () => {
    vi.mocked(api.getStoredToken).mockReturnValue('active-token');
    vi.mocked(api.authApi.getMe).mockResolvedValue(mockUser);

    window.history.pushState({}, 'Investigations', '/investigations');

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('user-info')).toHaveTextContent('investigator@ecointelligence.org');

    // Trigger unauthorized callback from api listener
    expect(capturedUnauthorizedCb).toBeTruthy();
    act(() => {
      capturedUnauthorizedCb!();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('No user');
      expect(screen.getByTestId('token-info')).toHaveTextContent('No token');
    });

    expect(api.removeStoredToken).toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/login');
  });

  it('unsubscribes from unauthorized events when AuthProvider unmounts', () => {
    vi.mocked(api.getStoredToken).mockReturnValue(null);

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(api.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('throws an error if useAuth is used outside of AuthProvider', () => {
    // Suppress React console error output for this expected error
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    consoleError.mockRestore();
  });
});

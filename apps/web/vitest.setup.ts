import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Automatically clean up React DOM and mocks after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

// Mock URL.createObjectURL and URL.revokeObjectURL
if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(
      () => `blob:http://localhost:3000/${Math.random().toString(36).substring(2, 9)}`
    );
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

// Mock maplibre-gl for GIS components in jsdom
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addControl: vi.fn(),
      getSource: vi.fn(),
      addSource: vi.fn(),
      getLayer: vi.fn(),
      addLayer: vi.fn(),
      setFilter: vi.fn(),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    ScaleControl: vi.fn(),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    Popup: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
    })),
  },
}));

// Default next/navigation mocks
vi.mock('next/navigation', () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  };
  return {
    useRouter: vi.fn(() => router),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams()),
  };
});

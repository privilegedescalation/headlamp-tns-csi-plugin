import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock headlamp plugin APIs before importing the module under test
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: {
    request: vi.fn().mockResolvedValue({ items: [] }),
  },
  K8s: {
    ResourceClasses: {
      StorageClass: {
        useList: vi.fn(() => [[], null]),
      },
      PersistentVolume: {
        useList: vi.fn(() => [[], null]),
      },
      PersistentVolumeClaim: {
        useList: vi.fn(() => [[], null]),
      },
    },
  },
  ConfigStore: class {
    get() { return {}; }
    set() {}
    update() {}
    useConfig() { return () => ({}); }
  },
}));

import { TnsCsiDataProvider, useTnsCsiContext } from './TnsCsiDataContext';

describe('useTnsCsiContext', () => {
  it('throws when used outside TnsCsiDataProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTnsCsiContext());
    }).toThrow('useTnsCsiContext must be used within a TnsCsiDataProvider');

    spy.mockRestore();
  });

  it('returns context value when inside TnsCsiDataProvider', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TnsCsiDataProvider>{children}</TnsCsiDataProvider>
    );

    const { result } = renderHook(() => useTnsCsiContext(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current.storageClasses).toBeInstanceOf(Array);
    expect(result.current.persistentVolumes).toBeInstanceOf(Array);
    expect(result.current.persistentVolumeClaims).toBeInstanceOf(Array);
    expect(typeof result.current.refresh).toBe('function');
  });
});

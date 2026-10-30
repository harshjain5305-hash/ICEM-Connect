import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwa } from './usePwa';

describe('usePwa hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects online/offline status correctly', () => {
    const { result } = renderHook(() => usePwa());
    expect(result.current.isOffline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOffline).toBe(false);
  });

  it('captures beforeinstallprompt event and triggers install', async () => {
    const { result } = renderHook(() => usePwa());
    expect(result.current.isInstallable).toBe(false);

    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockInstallEvent = new Event('beforeinstallprompt') as any;
    mockInstallEvent.prompt = promptMock;
    mockInstallEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockInstallEvent);
    });

    expect(result.current.isInstallable).toBe(true);

    let installed = false;
    await act(async () => {
      installed = await result.current.installApp();
    });

    expect(promptMock).toHaveBeenCalled();
    expect(installed).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('updates isInstalled when appinstalled event fires', () => {
    const { result } = renderHook(() => usePwa());
    expect(result.current.isInstalled).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });
});

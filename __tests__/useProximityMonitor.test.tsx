import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// Controlled fakes for the DB layer the hook reads.
jest.mock('../src/db/quests', () => ({
  getActiveQuests: jest.fn(() => Promise.resolve([])),
  getQuestById: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../src/db/settings', () => ({
  getSetting: jest.fn(() => Promise.resolve(null)),
  setSetting: jest.fn(() => Promise.resolve()),
}));
// The hook only needs refreshProfile from the game context.
jest.mock('../src/state/GameContext', () => ({
  useGame: () => ({ profile: null, loading: false, refreshProfile: jest.fn() }),
}));

import BackgroundGeolocation from 'react-native-background-geolocation';
import { getActiveQuests } from '../src/db/quests';
import { getSetting } from '../src/db/settings';
import { useProximityMonitor, NearbyQuestState } from '../src/hooks/useProximityMonitor';
import { Quest } from '../src/types';
import { SETTING_CHECK_INTERVAL_MINUTES } from '../src/utils/constants';

// Narrow, test-only shape of the jest.fn mocks (avoids jest.Mock generics).
interface MockFn {
  mockReset: () => void;
  mockResolvedValue: (value: unknown) => void;
  mockImplementation: (impl: (...args: unknown[]) => unknown) => void;
}
const asMock = (fn: unknown): MockFn => fn as MockFn;

const questInside: Quest = {
  id: 1,
  title: 'کوئست نزدیک',
  task: 'کاری انجام بده',
  latitude: 35.6892,
  longitude: 51.389,
  radius: 100,
  status: 'active',
  created_at: 0,
};

const questFar: Quest = { ...questInside, id: 2, latitude: 35.8, longitude: 51.6 };

let latest: NearbyQuestState | null = null;
const Harness: React.FC = () => {
  latest = useProximityMonitor();
  return null;
};

const setFakePosition = (latitude: number, longitude: number) => {
  asMock(BackgroundGeolocation.getCurrentPosition).mockResolvedValue({
    coords: { latitude, longitude },
  });
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
    }
  });
};

describe('useProximityMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    latest = null;
    asMock(getActiveQuests).mockReset();
    asMock(BackgroundGeolocation.getCurrentPosition).mockReset();
    // 1-minute check interval so fake-timer advances reach the next check
    // quickly; other settings fall back to defaults (tracking enabled).
    asMock(getSetting).mockImplementation(
      async (key: unknown) => (key === SETTING_CHECK_INTERVAL_MINUTES ? '1' : null),
    );
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('triggers the nearby dialog only when a quest is within radius (AC-02)', async () => {
    asMock(getActiveQuests).mockResolvedValue([questInside, questFar]);
    setFakePosition(35.6892, 51.389); // exactly on questInside

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });
    await flush();

    expect(latest?.nearbyQuest?.id).toBe(1);
    expect(latest?.isDialogVisible).toBe(true);
    expect(latest?.edgeFlash).toBe(true);
    expect(latest?.confirmEnabled).toBe(false); // AC-06

    // 2s delay then confirm becomes available (AC-06)
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await flush();
    expect(latest?.confirmEnabled).toBe(true);

    act(() => tree.unmount());
  });

  it('stays idle when no quest is within radius', async () => {
    asMock(getActiveQuests).mockResolvedValue([questFar]);
    setFakePosition(35.6892, 51.389); // far from questFar

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });
    await flush();

    expect(latest?.nearbyQuest).toBeNull();
    expect(latest?.isDialogVisible).toBe(false);
    expect(latest?.edgeFlash).toBe(false);

    act(() => tree.unmount());
  });

  it('applies the 2-minute cooldown after "Not now" (AC-14)', async () => {
    asMock(getActiveQuests).mockResolvedValue([questInside]);
    setFakePosition(35.6892, 51.389);

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });
    await flush();
    expect(latest?.isDialogVisible).toBe(true);

    act(() => {
      latest?.notNow();
    });
    await flush();
    expect(latest?.isDialogVisible).toBe(false);

    // +1 minute: within cooldown → next periodic check must NOT re-prompt
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await flush();
    expect(latest?.isDialogVisible).toBe(false);

    // +2 more minutes: cooldown elapsed → the following check re-prompts
    await act(async () => {
      jest.advanceTimersByTime(2 * 60_000);
    });
    await flush();
    expect(latest?.isDialogVisible).toBe(true);

    act(() => tree.unmount());
  });
});

import { useSyncExternalStore } from 'react';

import { toDateKey, type DateKey } from './date';

/** Clock resolution. Anything finer just re-renders banners for no reason. */
const BUCKET_MS = 60_000;

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, BUCKET_MS);
  return () => clearInterval(id);
}

// Bucketed so the snapshot is stable between ticks; an unbucketed Date.now()
// would return a new value on every read and loop the store.
function getSnapshot(): number {
  return Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
}

/**
 * The current time, read the way React wants a mutable external source read.
 * Calling `Date.now()` straight in a render body is impure — the value changes
 * between renders that should be identical — and it also means a screen left
 * open never notices that a due date has passed.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Today's date key. Derived from `useNow` so a screen left open overnight rolls
 * over to the new day instead of stranding the user on yesterday's list.
 */
export function useTodayKey(): DateKey {
  return toDateKey(new Date(useNow()));
}

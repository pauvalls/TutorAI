import type { ResumableProgress, TourStorage } from './types';

/** A storage adapter backed by window.localStorage. Safe in SSR and private mode. */
export function createLocalStorage(): TourStorage {
  return {
    getItem(key) {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {
        /* storage is best-effort */
      }
    },
    removeItem(key) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        /* storage is best-effort */
      }
    },
  };
}

/** In-memory / no-persistence adapter. Useful for tests and SSR. */
export const noopStorage: TourStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export interface StoredProgress {
  done?: boolean;
  stepId?: string;
  updatedAt?: string;
}

/** Parses our JSON record and legacy truthy marker values. */
export function parseProgress(raw: string | null | undefined): StoredProgress {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as StoredProgress;
  } catch {
    /* legacy value */
  }
  return { done: true };
}

export function serializeProgress(progress: StoredProgress): string {
  return JSON.stringify({ ...progress, updatedAt: new Date().toISOString() });
}

export function mergeResumable(
  current: ResumableProgress[],
  next: ResumableProgress,
): ResumableProgress[] {
  const rest = current.filter((item) => item.tourId !== next.tourId);
  return [...rest, next];
}

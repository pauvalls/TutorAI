import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { holdTour, isTourHeld, releaseTour, subscribeHold } from './hold';
import {
  createLocalStorage,
  mergeResumable,
  parseProgress,
  serializeProgress,
  type StoredProgress,
} from './storage';
import {
  DEFAULT_LABELS,
  type ContextInput,
  type FlatEntry,
  type GateOption,
  type ResumableProgress,
  type TourConfig,
  type TourContext,
  type TourStep,
  type TourTopic,
  type TutorApi,
  type TutorProviderProps,
  type TourState,
} from './types';
import {
  collectTopics,
  EMPTY_CONTEXT,
  flattenTour,
  isStepDone,
  matchTopics,
  resolveContext,
  storageKeyFor,
  visibleEntries,
} from './utils';

const TutorContext = createContext<TutorApi | null>(null);
const defaultStore = createLocalStorage();

export function useTutor(): TutorApi {
  const api = useContext(TutorContext);
  if (!api) throw new Error('useTutor must be used inside <TutorProvider>');
  return api;
}

export function TutorProvider({
  config,
  children,
  context,
  labels: labelsProp,
}: TutorProviderProps): React.JSX.Element {
  const inputTours = useMemo(
    () => (Array.isArray(config) ? config : [config]),
    [config],
  );
  const toursRef = useRef<TourConfig[]>(inputTours);
  toursRef.current = inputTours;
  const tourKey = inputTours.map((tour) => tour.id).join('\u0000');

  const contextRef = useRef<ContextInput | undefined>(context);
  contextRef.current = context;
  const labelsOverrideRef = useRef(labelsProp);
  labelsOverrideRef.current = labelsProp;

  const [state, setState] = useState<TourState>('idle');
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [entries, setEntries] = useState<FlatEntry[]>([]);
  const [index, setIndex] = useState(-1);
  const [ctx, setCtx] = useState<TourContext>(EMPTY_CONTEXT);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [completedTours, setCompletedTours] = useState<string[]>([]);
  const [resumableTours, setResumableTours] = useState<ResumableProgress[]>([]);
  const [activeTopic, setActiveTopic] = useState<TourTopic | null>(null);

  const activeTourRef = useRef<string | null>(null);
  const entriesRef = useRef<FlatEntry[]>([]);
  const indexRef = useRef(-1);
  const contextValueRef = useRef<TourContext>(EMPTY_CONTEXT);
  const topicRef = useRef<TourTopic | null>(null);
  const resumableRef = useRef<ResumableProgress[]>([]);
  const completedRef = useRef<string[]>([]);
  completedRef.current = completedTours;

  const lockRef = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((fn: () => Promise<void>): Promise<void> => {
    const run = lockRef.current.then(fn, fn);
    lockRef.current = run.catch(() => undefined);
    return run.catch(() => undefined);
  }, []);

  const findTour = useCallback(
    (id?: string | null): TourConfig | null =>
      toursRef.current.find((tour) => tour.id === id) ??
      toursRef.current[0] ??
      null,
    [],
  );

  const getStore = useCallback(
    (tour: TourConfig) => tour.storage ?? defaultStore,
    [],
  );

  const writeProgress = useCallback(
    (tour: TourConfig, progress: StoredProgress) => {
      try {
        void Promise.resolve(
          getStore(tour).setItem(
            storageKeyFor(tour),
            serializeProgress(progress),
          ),
        ).catch(() => undefined);
      } catch {
        /* best effort */
      }
    },
    [getStore],
  );

  const clearProgress = useCallback(
    (tour: TourConfig) => {
      try {
        void Promise.resolve(
          getStore(tour).removeItem(storageKeyFor(tour)),
        ).catch(() => undefined);
      } catch {
        /* best effort */
      }
    },
    [getStore],
  );

  // ---- low-level transitions (never enqueue, so they can compose) ----

  const finishInternal = useCallback(async () => {
    const tour = findTour(activeTourRef.current);
    const old = entriesRef.current[indexRef.current]?.step;
    if (old?.onExit) {
      try {
        await old.onExit(contextValueRef.current);
      } catch {
        /* hook failures must not block navigation */
      }
    }
    if (tour) {
      writeProgress(tour, { done: true });
      setCompletedTours((prev) => Array.from(new Set([...prev, tour.id])));
      setResumableTours((prev) => {
        const next = prev.filter((item) => item.tourId !== tour.id);
        resumableRef.current = next;
        return next;
      });
    }
    activeTourRef.current = null;
    entriesRef.current = [];
    indexRef.current = -1;
    topicRef.current = null;
    setActiveTourId(null);
    setEntries([]);
    setIndex(-1);
    setActiveTopic(null);
    setState('finished');
  }, [findTour, writeProgress]);

  const goToIndexInternal = useCallback(
    async (targetIndex: number, tourIdOverride?: string) => {
      const tour = findTour(tourIdOverride ?? activeTourRef.current);
      if (!tour) return;

      const resolved = await resolveContext(contextRef.current ?? tour.context);
      const nextEntries = visibleEntries(tour, resolved, topicRef.current);
      if (targetIndex < 0 || targetIndex >= nextEntries.length) {
        await finishInternal();
        return;
      }

      const old = entriesRef.current[indexRef.current]?.step;
      const nextEntry = nextEntries[targetIndex];
      if (old && old.id !== nextEntry.step.id && old.onExit) {
        try {
          await old.onExit(resolved);
        } catch {
          /* ignore */
        }
      }

      activeTourRef.current = tour.id;
      entriesRef.current = nextEntries;
      indexRef.current = targetIndex;
      contextValueRef.current = resolved;
      topicRef.current = topicRef.current;

      setActiveTourId(tour.id);
      setEntries(nextEntries);
      setIndex(targetIndex);
      setCtx(resolved);
      setState('running');
      setDoneIds(
        flattenTour(tour)
          .filter((entry) => isStepDone(entry, tour, resolved))
          .map((entry) => entry.step.id),
      );

      writeProgress(tour, { stepId: nextEntry.step.id });
      setResumableTours((prev) => {
        const next = mergeResumable(prev, {
          tourId: tour.id,
          stepId: nextEntry.step.id,
        });
        resumableRef.current = next;
        return next;
      });

      if (nextEntry.step.onEnter) {
        try {
          await nextEntry.step.onEnter(resolved);
        } catch {
          /* ignore */
        }
      }
    },
    [findTour, finishInternal, writeProgress],
  );

  const startInternal = useCallback(
    async (tourId?: string, stepId?: string) => {
      if (isTourHeld()) return;
      const tour = findTour(tourId ?? activeTourRef.current);
      if (!tour) return;
      activeTourRef.current = tour.id;
      let target = 0;
      if (stepId) {
        const resolved = await resolveContext(
          contextRef.current ?? tour.context,
        );
        const found = visibleEntries(tour, resolved, topicRef.current)
          .map((entry) => entry.step.id)
          .indexOf(stepId);
        if (found >= 0) target = found;
      }
      await goToIndexInternal(target, tour.id);
    },
    [findTour, goToIndexInternal],
  );

  const nextInternal = useCallback(async () => {
    if (isTourHeld() || !activeTourRef.current) return;
    await goToIndexInternal(indexRef.current + 1);
  }, [goToIndexInternal]);

  const prevInternal = useCallback(async () => {
    if (isTourHeld() || indexRef.current <= 0) return;
    await goToIndexInternal(indexRef.current - 1);
  }, [goToIndexInternal]);

  const goToInternal = useCallback(
    async (stepId: string) => {
      if (isTourHeld()) return;
      const found = entriesRef.current
        .map((entry) => entry.step.id)
        .indexOf(stepId);
      if (found >= 0) await goToIndexInternal(found);
    },
    [goToIndexInternal],
  );

  const stopInternal = useCallback(async () => {
    const old = entriesRef.current[indexRef.current]?.step;
    if (old?.onExit) {
      try {
        await old.onExit(contextValueRef.current);
      } catch {
        /* ignore */
      }
    }
    activeTourRef.current = null;
    entriesRef.current = [];
    indexRef.current = -1;
    topicRef.current = null;
    setActiveTourId(null);
    setEntries([]);
    setIndex(-1);
    setActiveTopic(null);
    setState('idle');
  }, []);

  const resumeInternal = useCallback(async () => {
    const list = resumableRef.current;
    const progress =
      list.find((item) => item.tourId === activeTourRef.current) ?? list[0];
    if (!progress) return;
    await startInternal(progress.tourId, progress.stepId);
  }, [startInternal]);

  const startTopicInternal = useCallback(
    async (topicId: string) => {
      const topic = collectTopics(toursRef.current).find(
        (item) => item.id === topicId,
      );
      if (!topic) return;
      topicRef.current = topic;
      setActiveTopic(topic);
      await startInternal(topic.tourId, topic.stepIds?.[0]);
    },
    [startInternal],
  );

  const resetProgressInternal = useCallback(
    async (tourId?: string) => {
      const targets = tourId
        ? toursRef.current.filter((tour) => tour.id === tourId)
        : toursRef.current;
      const targetIds = targets.map((tour) => tour.id);
      targets.forEach(clearProgress);
      setCompletedTours((prev) =>
        prev.filter((id) => !targetIds.includes(id)),
      );
      setResumableTours((prev) => {
        const next = prev.filter((item) => !targetIds.includes(item.tourId));
        resumableRef.current = next;
        return next;
      });
      if (activeTourRef.current && targetIds.includes(activeTourRef.current)) {
        activeTourRef.current = null;
        entriesRef.current = [];
        indexRef.current = -1;
        topicRef.current = null;
        setActiveTourId(null);
        setEntries([]);
        setIndex(-1);
        setActiveTopic(null);
      }
      const stillDone = completedRef.current.filter(
        (id) => !targetIds.includes(id),
      );
      const nextTour = toursRef.current.find((tour) => !stillDone.includes(tour.id));
      setState(nextTour ? 'pending' : 'idle');
    },
    [clearProgress],
  );

  // ---- public API (serialized through one lock) ----

  const start = useCallback(
    (tourId?: string, stepId?: string) =>
      enqueue(() => startInternal(tourId, stepId)),
    [enqueue, startInternal],
  );
  const startTour = start;
  const startTopic = useCallback(
    (topicId: string) => enqueue(() => startTopicInternal(topicId)),
    [enqueue, startTopicInternal],
  );
  const next = useCallback(
    () => enqueue(nextInternal),
    [enqueue, nextInternal],
  );
  const prev = useCallback(
    () => enqueue(prevInternal),
    [enqueue, prevInternal],
  );
  const goTo = useCallback(
    (stepId: string) => enqueue(() => goToInternal(stepId)),
    [enqueue, goToInternal],
  );
  const finish = useCallback(
    () => enqueue(finishInternal),
    [enqueue, finishInternal],
  );
  const skip = useCallback(
    () => enqueue(stopInternal),
    [enqueue, stopInternal],
  );
  const stop = skip;
  const resume = useCallback(
    () => enqueue(resumeInternal),
    [enqueue, resumeInternal],
  );
  const resetProgress = useCallback(
    (tourId?: string) => enqueue(() => resetProgressInternal(tourId)),
    [enqueue, resetProgressInternal],
  );

  const openGate = useCallback(() => {
    if (isTourHeld()) return;
    setState((prevState) => (prevState === 'running' ? prevState : 'pending'));
  }, []);

  const hold = useCallback(() => holdTour(), []);
  const release = useCallback(() => releaseTour(), []);
  const held = useSyncExternalStore(subscribeHold, isTourHeld, () => false);

  const filterTopics = useCallback(
    (query?: string) => matchTopics(collectTopics(toursRef.current), query),
    [],
  );
  const resolveTopicSteps = useCallback((topicId: string): TourStep[] => {
    const topic = collectTopics(toursRef.current).find(
      (item) => item.id === topicId,
    );
    if (!topic) return [];
    const tour = toursRef.current.find((item) => item.id === topic.tourId);
    if (!tour) return [];
    const all = flattenTour(tour).map((entry) => entry.step);
    if (!topic.stepIds) return all;
    return topic.stepIds
      .map((id) => all.find((step) => step.id === id))
      .filter((step): step is TourStep => !!step);
  }, []);

  // Load persisted state once per set of tours.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done: string[] = [];
      const resumable: ResumableProgress[] = [];
      for (const tour of toursRef.current) {
        let raw: string | null = null;
        try {
          raw = await getStore(tour).getItem(storageKeyFor(tour));
        } catch {
          raw = null;
        }
        const progress = parseProgress(raw);
        if (progress.done) done.push(tour.id);
        else if (progress.stepId) {
          resumable.push({ tourId: tour.id, stepId: progress.stepId });
        }
      }
      if (cancelled) return;
      setCompletedTours(done);
      resumableRef.current = resumable;
      setResumableTours(resumable);
      const firstIncomplete = toursRef.current.find(
        (tour) => !done.includes(tour.id),
      );
      setState(firstIncomplete ? 'pending' : 'idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [tourKey, getStore]);

  // Keyboard navigation while a tour is running and not held.
  useEffect(() => {
    if (state !== 'running' || held || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        void next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void prev();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        void skip();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state, held, next, prev, skip]);

  const baseTour = findTour(activeTourId) ?? inputTours[0] ?? null;
  const labels = useMemo(
    () => ({
      ...DEFAULT_LABELS,
      ...(baseTour?.labels ?? {}),
      ...(labelsOverrideRef.current ?? {}),
    }),
    [baseTour],
  );
  const topics = useMemo(() => collectTopics(inputTours), [inputTours]);
  const currentIndex = index;
  const total = entries.length;
  const currentStep = entries[index]?.step ?? null;

  const api = useMemo<TutorApi>(
    () => ({
      state,
      tours: inputTours,
      topics,
      config: baseTour,
      activeTourId,
      currentStep,
      currentChapter: entries[index]?.chapter ?? null,
      currentIndex,
      currentStepIndex: currentIndex,
      total,
      totalSteps: total,
      doneStepIds: doneIds,
      completedTours,
      resumableTours,
      isRunning: state === 'running',
      isHeld: held,
      context: ctx,
      labels,
      start,
      startTour,
      startTopic,
      openGate,
      resume,
      next,
      prev,
      goTo,
      finish,
      skip,
      stop,
      hold,
      release,
      resetProgress,
      filterTopics,
      resolveTopicSteps,
    }),
    [
      state,
      inputTours,
      topics,
      baseTour,
      activeTourId,
      currentStep,
      currentIndex,
      total,
      doneIds,
      completedTours,
      resumableTours,
      held,
      ctx,
      labels,
      start,
      startTour,
      startTopic,
      openGate,
      resume,
      next,
      prev,
      goTo,
      finish,
      skip,
      stop,
      hold,
      release,
      resetProgress,
      filterTopics,
      resolveTopicSteps,
      entries,
      index,
    ],
  );

  return <TutorContext.Provider value={api}>{children}</TutorContext.Provider>;
}

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  DEFAULT_LABELS: () => DEFAULT_LABELS,
  TourResumePill: () => TourResumePill,
  TutorProvider: () => TutorProvider,
  TutorialGate: () => TutorialGate,
  TutorialOverlay: () => TutorialOverlay,
  createLocalStorage: () => createLocalStorage,
  holdTour: () => holdTour,
  isTourHeld: () => isTourHeld,
  noopStorage: () => noopStorage,
  releaseTour: () => releaseTour,
  resetHold: () => resetHold,
  useTutor: () => useTutor
});
module.exports = __toCommonJS(index_exports);

// src/TutorProvider.tsx
var import_react = require("react");

// src/hold.ts
var held = false;
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const listener of listeners) listener();
}
function holdTour() {
  if (held) return;
  held = true;
  emit();
}
function releaseTour() {
  if (!held) return;
  held = false;
  emit();
}
function isTourHeld() {
  return held;
}
function subscribeHold(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function resetHold() {
  held = false;
  emit();
}

// src/storage.ts
function createLocalStorage() {
  return {
    getItem(key) {
      try {
        if (typeof window === "undefined" || !window.localStorage) return null;
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch {
      }
    },
    removeItem(key) {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
      }
    }
  };
}
var noopStorage = {
  getItem: () => null,
  setItem: () => void 0,
  removeItem: () => void 0
};
function parseProgress(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return { done: true };
}
function serializeProgress(progress) {
  return JSON.stringify({ ...progress, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
}
function mergeResumable(current, next) {
  const rest = current.filter((item) => item.tourId !== next.tourId);
  return [...rest, next];
}

// src/types.ts
var DEFAULT_LABELS = {
  gateTitle: "Welcome",
  gateSubtitle: "Choose a guided tour to get started.",
  skip: "Skip",
  next: "Next",
  prev: "Back",
  finish: "Finish",
  progress: "Step {current} of {total}",
  missingTarget: "We could not find this step\u2019s element, so it was skipped.",
  topicsTitle: "Explore by topic",
  topicFilterPlaceholder: "Filter topics\u2026",
  resume: "Resume tour",
  resumePillTitle: "You have an unfinished tour"
};

// src/utils.ts
var EMPTY_CONTEXT = {
  capabilities: [],
  roles: [],
  meta: {}
};
async function resolveContext(input) {
  if (!input) return EMPTY_CONTEXT;
  if (typeof input === "function") {
    return { ...EMPTY_CONTEXT, ...await input() };
  }
  return { ...EMPTY_CONTEXT, ...input };
}
function flattenTour(config) {
  return config.chapters.flatMap(
    (chapter) => chapter.steps.map((step) => ({ step, chapter }))
  );
}
function isStepDone(entry, config, ctx) {
  const predicate = entry.step.isStepDone ?? config.isStepDone;
  return predicate ? predicate(entry.step.id, ctx) === true : false;
}
function visibleEntries(config, ctx, topic) {
  return flattenTour(config).filter((entry) => {
    if (entry.chapter.when && !entry.chapter.when(ctx)) return false;
    if (entry.step.when && !entry.step.when(ctx)) return false;
    if (isStepDone(entry, config, ctx)) return false;
    if (topic?.stepIds && !topic.stepIds.includes(entry.step.id)) return false;
    return true;
  });
}
function storageKeyFor(config) {
  if (!config.storageKey) return `tutor-ai:${config.id}`;
  return typeof config.storageKey === "function" ? config.storageKey(config.id) : config.storageKey;
}
function collectTopics(tours) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const tour of tours) {
    for (const topic of tour.topics ?? []) {
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      result.push(topic);
    }
  }
  return result;
}
function matchTopics(topics, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return topics;
  return topics.filter(
    (topic) => [topic.label, topic.description ?? "", ...topic.keywords ?? []].join(" ").toLowerCase().includes(q)
  );
}
function progressText(template, current, total) {
  return template.split("{current}").join(String(current)).split("{total}").join(String(total));
}
function isElementVisible(element) {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return !!(element.getClientRects().length > 0);
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
  if (!style) return true;
  return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
}
function querySelectorSafe(selector) {
  if (typeof document === "undefined" || !selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
function resolveTarget(step, ctx) {
  const fallback = () => {
    if (!step.target) return null;
    if (typeof step.target === "function") {
      try {
        return step.target(ctx) ?? null;
      } catch {
        return null;
      }
    }
    return querySelectorSafe(step.target);
  };
  if (!step.targetWhen) return fallback();
  const conditional = querySelectorSafe(step.targetWhen.selector);
  const conditionalVisible = !!conditional && isElementVisible(conditional);
  if (step.targetWhen.when === "visible") {
    return conditionalVisible ? conditional : fallback();
  }
  return conditionalVisible ? conditional : fallback();
}
function isVisibleElement(element) {
  return !!element && isElementVisible(element);
}

// src/TutorProvider.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var TutorContext = (0, import_react.createContext)(null);
var defaultStore = createLocalStorage();
function useTutor() {
  const api = (0, import_react.useContext)(TutorContext);
  if (!api) throw new Error("useTutor must be used inside <TutorProvider>");
  return api;
}
function TutorProvider({
  config,
  children,
  context,
  labels: labelsProp
}) {
  const inputTours = (0, import_react.useMemo)(
    () => Array.isArray(config) ? config : [config],
    [config]
  );
  const toursRef = (0, import_react.useRef)(inputTours);
  toursRef.current = inputTours;
  const tourKey = inputTours.map((tour) => tour.id).join("\0");
  const contextRef = (0, import_react.useRef)(context);
  contextRef.current = context;
  const labelsOverrideRef = (0, import_react.useRef)(labelsProp);
  labelsOverrideRef.current = labelsProp;
  const [state, setState] = (0, import_react.useState)("idle");
  const [activeTourId, setActiveTourId] = (0, import_react.useState)(null);
  const [entries, setEntries] = (0, import_react.useState)([]);
  const [index, setIndex] = (0, import_react.useState)(-1);
  const [ctx, setCtx] = (0, import_react.useState)(EMPTY_CONTEXT);
  const [doneIds, setDoneIds] = (0, import_react.useState)([]);
  const [completedTours, setCompletedTours] = (0, import_react.useState)([]);
  const [resumableTours, setResumableTours] = (0, import_react.useState)([]);
  const [activeTopic, setActiveTopic] = (0, import_react.useState)(null);
  const activeTourRef = (0, import_react.useRef)(null);
  const entriesRef = (0, import_react.useRef)([]);
  const indexRef = (0, import_react.useRef)(-1);
  const contextValueRef = (0, import_react.useRef)(EMPTY_CONTEXT);
  const topicRef = (0, import_react.useRef)(null);
  const resumableRef = (0, import_react.useRef)([]);
  const completedRef = (0, import_react.useRef)([]);
  completedRef.current = completedTours;
  const lockRef = (0, import_react.useRef)(Promise.resolve());
  const enqueue = (0, import_react.useCallback)((fn) => {
    const run = lockRef.current.then(fn, fn);
    lockRef.current = run.catch(() => void 0);
    return run.catch(() => void 0);
  }, []);
  const findTour = (0, import_react.useCallback)(
    (id) => toursRef.current.find((tour) => tour.id === id) ?? toursRef.current[0] ?? null,
    []
  );
  const getStore = (0, import_react.useCallback)(
    (tour) => tour.storage ?? defaultStore,
    []
  );
  const writeProgress = (0, import_react.useCallback)(
    (tour, progress) => {
      try {
        void Promise.resolve(
          getStore(tour).setItem(
            storageKeyFor(tour),
            serializeProgress(progress)
          )
        ).catch(() => void 0);
      } catch {
      }
    },
    [getStore]
  );
  const clearProgress = (0, import_react.useCallback)(
    (tour) => {
      try {
        void Promise.resolve(
          getStore(tour).removeItem(storageKeyFor(tour))
        ).catch(() => void 0);
      } catch {
      }
    },
    [getStore]
  );
  const finishInternal = (0, import_react.useCallback)(async () => {
    const tour = findTour(activeTourRef.current);
    const old = entriesRef.current[indexRef.current]?.step;
    if (old?.onExit) {
      try {
        await old.onExit(contextValueRef.current);
      } catch {
      }
    }
    if (tour) {
      writeProgress(tour, { done: true });
      setCompletedTours((prev2) => Array.from(/* @__PURE__ */ new Set([...prev2, tour.id])));
      setResumableTours((prev2) => {
        const next2 = prev2.filter((item) => item.tourId !== tour.id);
        resumableRef.current = next2;
        return next2;
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
    setState("finished");
  }, [findTour, writeProgress]);
  const goToIndexInternal = (0, import_react.useCallback)(
    async (targetIndex, tourIdOverride) => {
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
      setState("running");
      setDoneIds(
        flattenTour(tour).filter((entry) => isStepDone(entry, tour, resolved)).map((entry) => entry.step.id)
      );
      writeProgress(tour, { stepId: nextEntry.step.id });
      setResumableTours((prev2) => {
        const next2 = mergeResumable(prev2, {
          tourId: tour.id,
          stepId: nextEntry.step.id
        });
        resumableRef.current = next2;
        return next2;
      });
      if (nextEntry.step.onEnter) {
        try {
          await nextEntry.step.onEnter(resolved);
        } catch {
        }
      }
    },
    [findTour, finishInternal, writeProgress]
  );
  const startInternal = (0, import_react.useCallback)(
    async (tourId, stepId) => {
      if (isTourHeld()) return;
      const tour = findTour(tourId ?? activeTourRef.current);
      if (!tour) return;
      activeTourRef.current = tour.id;
      let target = 0;
      if (stepId) {
        const resolved = await resolveContext(
          contextRef.current ?? tour.context
        );
        const found = visibleEntries(tour, resolved, topicRef.current).map((entry) => entry.step.id).indexOf(stepId);
        if (found >= 0) target = found;
      }
      await goToIndexInternal(target, tour.id);
    },
    [findTour, goToIndexInternal]
  );
  const nextInternal = (0, import_react.useCallback)(async () => {
    if (isTourHeld() || !activeTourRef.current) return;
    await goToIndexInternal(indexRef.current + 1);
  }, [goToIndexInternal]);
  const prevInternal = (0, import_react.useCallback)(async () => {
    if (isTourHeld() || indexRef.current <= 0) return;
    await goToIndexInternal(indexRef.current - 1);
  }, [goToIndexInternal]);
  const goToInternal = (0, import_react.useCallback)(
    async (stepId) => {
      if (isTourHeld()) return;
      const found = entriesRef.current.map((entry) => entry.step.id).indexOf(stepId);
      if (found >= 0) await goToIndexInternal(found);
    },
    [goToIndexInternal]
  );
  const stopInternal = (0, import_react.useCallback)(async () => {
    const old = entriesRef.current[indexRef.current]?.step;
    if (old?.onExit) {
      try {
        await old.onExit(contextValueRef.current);
      } catch {
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
    setState("idle");
  }, []);
  const resumeInternal = (0, import_react.useCallback)(async () => {
    const list = resumableRef.current;
    const progress = list.find((item) => item.tourId === activeTourRef.current) ?? list[0];
    if (!progress) return;
    await startInternal(progress.tourId, progress.stepId);
  }, [startInternal]);
  const startTopicInternal = (0, import_react.useCallback)(
    async (topicId) => {
      const topic = collectTopics(toursRef.current).find(
        (item) => item.id === topicId
      );
      if (!topic) return;
      topicRef.current = topic;
      setActiveTopic(topic);
      await startInternal(topic.tourId, topic.stepIds?.[0]);
    },
    [startInternal]
  );
  const resetProgressInternal = (0, import_react.useCallback)(
    async (tourId) => {
      const targets = tourId ? toursRef.current.filter((tour) => tour.id === tourId) : toursRef.current;
      const targetIds = targets.map((tour) => tour.id);
      targets.forEach(clearProgress);
      setCompletedTours(
        (prev2) => prev2.filter((id) => !targetIds.includes(id))
      );
      setResumableTours((prev2) => {
        const next2 = prev2.filter((item) => !targetIds.includes(item.tourId));
        resumableRef.current = next2;
        return next2;
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
        (id) => !targetIds.includes(id)
      );
      const nextTour = toursRef.current.find((tour) => !stillDone.includes(tour.id));
      setState(nextTour ? "pending" : "idle");
    },
    [clearProgress]
  );
  const start = (0, import_react.useCallback)(
    (tourId, stepId) => enqueue(() => startInternal(tourId, stepId)),
    [enqueue, startInternal]
  );
  const startTour = start;
  const startTopic = (0, import_react.useCallback)(
    (topicId) => enqueue(() => startTopicInternal(topicId)),
    [enqueue, startTopicInternal]
  );
  const next = (0, import_react.useCallback)(
    () => enqueue(nextInternal),
    [enqueue, nextInternal]
  );
  const prev = (0, import_react.useCallback)(
    () => enqueue(prevInternal),
    [enqueue, prevInternal]
  );
  const goTo = (0, import_react.useCallback)(
    (stepId) => enqueue(() => goToInternal(stepId)),
    [enqueue, goToInternal]
  );
  const finish = (0, import_react.useCallback)(
    () => enqueue(finishInternal),
    [enqueue, finishInternal]
  );
  const skip = (0, import_react.useCallback)(
    () => enqueue(stopInternal),
    [enqueue, stopInternal]
  );
  const stop = skip;
  const resume = (0, import_react.useCallback)(
    () => enqueue(resumeInternal),
    [enqueue, resumeInternal]
  );
  const resetProgress = (0, import_react.useCallback)(
    (tourId) => enqueue(() => resetProgressInternal(tourId)),
    [enqueue, resetProgressInternal]
  );
  const openGate = (0, import_react.useCallback)(() => {
    if (isTourHeld()) return;
    setState((prevState) => prevState === "running" ? prevState : "pending");
  }, []);
  const hold = (0, import_react.useCallback)(() => holdTour(), []);
  const release = (0, import_react.useCallback)(() => releaseTour(), []);
  const held2 = (0, import_react.useSyncExternalStore)(subscribeHold, isTourHeld, () => false);
  const filterTopics = (0, import_react.useCallback)(
    (query) => matchTopics(collectTopics(toursRef.current), query),
    []
  );
  const resolveTopicSteps = (0, import_react.useCallback)((topicId) => {
    const topic = collectTopics(toursRef.current).find(
      (item) => item.id === topicId
    );
    if (!topic) return [];
    const tour = toursRef.current.find((item) => item.id === topic.tourId);
    if (!tour) return [];
    const all = flattenTour(tour).map((entry) => entry.step);
    if (!topic.stepIds) return all;
    return topic.stepIds.map((id) => all.find((step) => step.id === id)).filter((step) => !!step);
  }, []);
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    void (async () => {
      const done = [];
      const resumable = [];
      for (const tour of toursRef.current) {
        let raw = null;
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
        (tour) => !done.includes(tour.id)
      );
      setState(firstIncomplete ? "pending" : "idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [tourKey, getStore]);
  (0, import_react.useEffect)(() => {
    if (state !== "running" || held2 || typeof document === "undefined") return;
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        void next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        void prev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        void skip();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [state, held2, next, prev, skip]);
  const baseTour = findTour(activeTourId) ?? inputTours[0] ?? null;
  const labels = (0, import_react.useMemo)(
    () => ({
      ...DEFAULT_LABELS,
      ...baseTour?.labels ?? {},
      ...labelsOverrideRef.current ?? {}
    }),
    [baseTour]
  );
  const topics = (0, import_react.useMemo)(() => collectTopics(inputTours), [inputTours]);
  const currentIndex = index;
  const total = entries.length;
  const currentStep = entries[index]?.step ?? null;
  const api = (0, import_react.useMemo)(
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
      isRunning: state === "running",
      isHeld: held2,
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
      resolveTopicSteps
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
      held2,
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
      index
    ]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TutorContext.Provider, { value: api, children });
}

// src/TutorialGate.tsx
var import_react2 = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime2 = require("react/jsx-runtime");
function TutorialGate({ className }) {
  const tutor = useTutor();
  const [query, setQuery] = (0, import_react2.useState)("");
  if (typeof document === "undefined") return null;
  if (tutor.state !== "pending") return null;
  const tour = tutor.config;
  const options = tour?.gate ?? tutor.tours.map((item) => ({
    id: item.id,
    label: item.title ?? item.id,
    description: item.description,
    tourId: item.id
  }));
  const topics = tutor.filterTopics(query);
  if (tour?.renderGate) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: tour.renderGate({
      options,
      topics,
      labels: tutor.labels,
      tour,
      start: tutor.startTour,
      startTopic: tutor.startTopic,
      skip: tutor.skip,
      filterTopics: tutor.filterTopics
    }) });
  }
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: `tutorai-gate${className ? ` ${className}` : ""}`,
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "tutorai-gate-title",
        "data-test": "tutor-gate",
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tutorai-gate-panel", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { className: "tutorai-gate-title", id: "tutorai-gate-title", children: tutor.labels.gateTitle }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "tutorai-gate-subtitle", children: tutor.labels.gateSubtitle }),
          options.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "tutorai-gate-options", "data-test": "tutor-gate-options", children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
            "button",
            {
              type: "button",
              className: "tutorai-button tutorai-primary tutorai-gate-option",
              "data-test": `tutor-gate-option-${option.id}`,
              onClick: () => void tutor.startTour(option.tourId ?? option.id),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: option.label }),
                option.description && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { className: "tutorai-gate-option-description", children: option.description })
              ]
            },
            option.id
          )) }),
          topics.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "tutorai-topics", "data-test": "tutor-topics", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "tutorai-topics-title", children: tutor.labels.topicsTitle }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                className: "tutorai-topic-filter",
                type: "search",
                value: query,
                placeholder: tutor.labels.topicFilterPlaceholder,
                "aria-label": tutor.labels.topicFilterPlaceholder,
                "data-test": "tutor-topic-filter",
                onChange: (event) => setQuery(event.target.value)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "tutorai-topic-list", children: topics.map((topic) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                className: "tutorai-topic-button",
                "data-test": `tutor-topic-${topic.id}`,
                onClick: () => void tutor.startTopic(topic.id),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: topic.label }),
                  topic.description && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { children: topic.description })
                ]
              },
              topic.id
            )) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "tutorai-button tutorai-gate-skip",
              "data-test": "tutor-gate-skip",
              onClick: () => void tutor.skip(),
              children: tutor.labels.skip
            }
          )
        ] })
      }
    ),
    document.body
  );
}

// src/TutorialOverlay.tsx
var import_react3 = require("react");
var import_react_dom2 = require("react-dom");
var import_jsx_runtime3 = require("react/jsx-runtime");
function sameRect(a, b) {
  if (!a || !b) return a === b;
  return Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}
function TutorialOverlay({
  labels: labelsProp,
  className,
  zIndex = 1e4,
  showProgress
}) {
  const tutor = useTutor();
  const {
    currentStep,
    currentChapter,
    currentIndex,
    total,
    isHeld,
    state,
    labels: contextLabels,
    config,
    context
  } = tutor;
  const labels = (0, import_react3.useMemo)(
    () => ({ ...contextLabels, ...labelsProp }),
    [contextLabels, labelsProp]
  );
  const [target, setTarget] = (0, import_react3.useState)(null);
  const [hole, setHole] = (0, import_react3.useState)(null);
  const [cardSize, setCardSize] = (0, import_react3.useState)({ width: 340, height: 190 });
  const [missing, setMissing] = (0, import_react3.useState)(false);
  const cardRef = (0, import_react3.useRef)(null);
  const updateRef = (0, import_react3.useRef)(() => void 0);
  const lastTargetRef = (0, import_react3.useRef)(null);
  const scrolledRef = (0, import_react3.useRef)(null);
  const advancedRef = (0, import_react3.useRef)(false);
  const lastHoleRef = (0, import_react3.useRef)(null);
  const stepId = currentStep?.id;
  const placement = currentStep?.placement ?? "bottom";
  (0, import_react3.useEffect)(() => {
    advancedRef.current = false;
    lastTargetRef.current = null;
    scrolledRef.current = null;
    lastHoleRef.current = null;
    setTarget(null);
    setHole(null);
    setMissing(false);
    if (!currentStep || state !== "running" || isHeld || typeof document === "undefined") {
      return;
    }
    const waitMs = currentStep.waitForTarget ?? config?.defaultWaitForTarget ?? 1500;
    const startedAt = Date.now();
    let raf = 0;
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const chosen = resolveTarget(currentStep, context);
      const usable = chosen && isVisibleElement(chosen) ? chosen : null;
      if (!usable) {
        if (currentStep.advanceWhenHidden && lastTargetRef.current && !advancedRef.current) {
          advancedRef.current = true;
          lastTargetRef.current = null;
          void tutor.next();
          return;
        }
        if (Date.now() - startedAt >= waitMs) setMissing(true);
        return;
      }
      setMissing(false);
      setTarget((previous) => previous === usable ? previous : usable);
      lastTargetRef.current = usable;
      const rect = usable.getBoundingClientRect();
      const padding = currentStep.padding ?? 8;
      const nextHole = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      };
      if (!sameRect(lastHoleRef.current, nextHole)) {
        lastHoleRef.current = nextHole;
        setHole(nextHole);
      }
      const shouldScroll = currentStep.scrollIntoView ?? config?.scrollIntoView ?? true;
      if (shouldScroll && scrolledRef.current !== usable) {
        scrolledRef.current = usable;
        usable.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    updateRef.current = update;
    update();
    const interval = window.setInterval(update, 100);
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        updateRef.current();
      });
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [stepId, state, isHeld, context, config?.defaultWaitForTarget, config?.scrollIntoView]);
  (0, import_react3.useEffect)(() => {
    if (!missing) return;
    const timer = window.setTimeout(() => {
      void tutor.next();
    }, 1e3);
    return () => window.clearTimeout(timer);
  }, [missing, tutor.next]);
  (0, import_react3.useEffect)(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setCardSize({ width: rect.width, height: rect.height });
    }
  }, [stepId, hole, missing]);
  const cardPosition = (0, import_react3.useMemo)(() => {
    const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
    const gap = 12;
    const margin = 12;
    const width = cardSize.width;
    const height = cardSize.height;
    if (!hole) {
      return {
        left: Math.max(margin, (viewportWidth - width) / 2),
        top: Math.max(margin, (viewportHeight - height) / 2)
      };
    }
    const centerX = hole.left + hole.width / 2;
    const centerY = hole.top + hole.height / 2;
    let left = 0;
    let top = 0;
    if (placement === "top") {
      left = centerX - width / 2;
      top = hole.top - height - gap;
      if (top < margin) top = hole.top + hole.height + gap;
    } else if (placement === "left") {
      left = hole.left - width - gap;
      top = centerY - height / 2;
      if (left < margin) left = hole.left + hole.width + gap;
    } else if (placement === "right") {
      left = hole.left + hole.width + gap;
      top = centerY - height / 2;
      if (left + width > viewportWidth - margin) left = hole.left - width - gap;
    } else {
      left = centerX - width / 2;
      top = hole.top + hole.height + gap;
      if (top + height > viewportHeight - margin) top = hole.top - height - gap;
    }
    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, viewportWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin))
    };
  }, [hole, cardSize, placement]);
  if (typeof document === "undefined") return null;
  if (state !== "running" || !currentStep || isHeld) return null;
  const progressVisible = showProgress ?? config?.showProgress ?? true;
  const isLast = currentIndex === total - 1;
  if (config?.renderCoachmark) {
    return (0, import_react_dom2.createPortal)(
      config.renderCoachmark({
        step: currentStep,
        chapter: currentChapter,
        index: currentIndex,
        total,
        context,
        labels,
        isHeld,
        target,
        hole,
        placement,
        cardSize,
        missing,
        next: tutor.next,
        prev: tutor.prev,
        skip: tutor.skip,
        finish: tutor.finish
      }),
      document.body
    );
  }
  return (0, import_react_dom2.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        className: `tutorai-overlay${className ? ` ${className}` : ""}`,
        style: { zIndex },
        "data-test": "tutor-overlay",
        children: [
          hole && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              className: "tutorai-spotlight",
              "data-test": "tutor-spotlight",
              "aria-hidden": "true",
              style: {
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height
              }
            }
          ),
          progressVisible && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "tutorai-progress", "data-test": "tutor-progress", role: "status", children: progressText(labels.progress, currentIndex + 1, total) }),
          missing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              className: "tutorai-notice",
              role: "status",
              "data-test": "tutor-missing-target",
              style: { left: cardPosition.left, top: cardPosition.top },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: labels.missingTarget }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "tutorai-button tutorai-primary",
                    onClick: () => void tutor.next(),
                    children: labels.next
                  }
                )
              ]
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              className: "tutorai-card",
              ref: cardRef,
              role: "dialog",
              "aria-label": currentStep.title,
              "data-test": "tutor-card",
              style: { left: cardPosition.left, top: cardPosition.top },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tutorai-card-header", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { className: "tutorai-card-title", children: currentStep.title }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "tutorai-icon-button",
                      "aria-label": labels.skip,
                      "data-test": "tutor-close",
                      onClick: () => void tutor.skip(),
                      children: "\xD7"
                    }
                  )
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "tutorai-card-content", children: currentStep.content }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "tutorai-card-actions", children: [
                  currentIndex > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "tutorai-button",
                      "data-test": "tutor-prev",
                      onClick: () => void tutor.prev(),
                      children: labels.prev
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "button",
                    {
                      type: "button",
                      className: "tutorai-button tutorai-primary",
                      "data-test": "tutor-next",
                      onClick: () => void (isLast ? tutor.finish() : tutor.next()),
                      children: isLast ? labels.finish : labels.next
                    }
                  )
                ] })
              ]
            }
          )
        ]
      }
    ),
    document.body
  );
}

// src/TourResumePill.tsx
var import_react4 = require("react");
var import_react_dom3 = require("react-dom");
var import_jsx_runtime4 = require("react/jsx-runtime");
function TourResumePill({
  labels: labelsProp,
  className
}) {
  const tutor = useTutor();
  const labels = (0, import_react4.useMemo)(
    () => ({ ...tutor.labels, ...labelsProp }),
    [tutor.labels, labelsProp]
  );
  const progress = tutor.resumableTours[0];
  const enabled = tutor.config?.showResumePill ?? true;
  if (typeof document === "undefined") return null;
  if (!enabled || !progress) return null;
  if (tutor.state === "running" || tutor.state === "pending") return null;
  if (tutor.config?.renderResumePill) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: tutor.config.renderResumePill({
      labels,
      progress,
      resume: tutor.resume,
      className
    }) });
  }
  return (0, import_react_dom3.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: `tutorai-resume-pill${className ? ` ${className}` : ""}`,
        title: labels.resumePillTitle,
        "aria-label": labels.resumePillTitle,
        "data-test": "tutor-resume-pill",
        onClick: () => void tutor.resume(),
        children: labels.resume
      }
    ),
    document.body
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_LABELS,
  TourResumePill,
  TutorProvider,
  TutorialGate,
  TutorialOverlay,
  createLocalStorage,
  holdTour,
  isTourHeld,
  noopStorage,
  releaseTour,
  resetHold,
  useTutor
});
//# sourceMappingURL=index.cjs.map
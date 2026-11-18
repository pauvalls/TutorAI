import type { ReactNode } from 'react';

/** Where the coachmark card is placed relative to the spotlighted element. */
export type Placement = 'top' | 'bottom' | 'left' | 'right';

/** Generic app context passed to every predicate and hook. No app-specific fields. */
export interface TourContext {
  capabilities: string[];
  roles: string[];
  meta: Record<string, unknown>;
}

export type ContextInput =
  | Partial<TourContext>
  | (() => TourContext | Promise<TourContext>);

/** All user-visible strings. Ship with English defaults; consumers may pass any language. */
export interface TourLabels {
  gateTitle: string;
  gateSubtitle: string;
  skip: string;
  next: string;
  prev: string;
  finish: string;
  /** Template: `{current}` and `{total}` are replaced at render time. */
  progress: string;
  missingTarget: string;
  topicsTitle: string;
  topicFilterPlaceholder: string;
  resume: string;
  resumePillTitle: string;
}

export const DEFAULT_LABELS: TourLabels = {
  gateTitle: 'Welcome',
  gateSubtitle: 'Choose a guided tour to get started.',
  skip: 'Skip',
  next: 'Next',
  prev: 'Back',
  finish: 'Finish',
  progress: 'Step {current} of {total}',
  missingTarget: 'We could not find this step’s element, so it was skipped.',
  topicsTitle: 'Explore by topic',
  topicFilterPlaceholder: 'Filter topics…',
  resume: 'Resume tour',
  resumePillTitle: 'You have an unfinished tour',
};

/** Resolves the element to spotlight from the current generic context. */
export type TargetResolver = (ctx: TourContext) => Element | null | undefined;

/**
 * Picks between `targetWhen.selector` and the step's fallback `target` at render time.
 * - `visible`: spotlight `selector` while it is visible, otherwise the fallback target.
 * - `hidden`: spotlight the fallback target while `selector` is hidden, otherwise `selector`.
 */
export interface TargetWhen {
  selector: string;
  when: 'visible' | 'hidden';
}

export interface TourStep {
  id: string;
  title: string;
  content: string;
  /** CSS selector or resolver. Omit for a centered, target-less step. */
  target?: string | TargetResolver;
  targetWhen?: TargetWhen;
  placement?: Placement;
  padding?: number;
  when?: (ctx: TourContext) => boolean;
  /** Generic "already done" predicate; true means the step is skipped. */
  isStepDone?: (stepId: string, ctx: TourContext) => boolean;
  onEnter?: (ctx: TourContext) => void | Promise<void>;
  onExit?: (ctx: TourContext) => void | Promise<void>;
  waitForTarget?: number;
  /** Auto-advance when the currently spotlighted element disappears. */
  advanceWhenHidden?: boolean;
  scrollIntoView?: boolean;
}

export interface TourChapter {
  id: string;
  title?: string;
  when?: (ctx: TourContext) => boolean;
  steps: TourStep[];
}

/** A step paired with its chapter after flattening. */
export interface FlatEntry {
  step: TourStep;
  chapter: TourChapter;
}

/** Generic category that selects steps across a tour. */
export interface TourTopic {
  id: string;
  label: string;
  description?: string;
  tourId: string;
  /** When omitted, all steps of the tour belong to the topic. */
  stepIds?: string[];
  keywords?: string[];
}

export interface GateOption {
  id: string;
  label: string;
  description?: string;
  tourId?: string;
}

/** Async-capable storage adapter. Defaults to localStorage. */
export interface TourStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface GateRenderProps {
  options: GateOption[];
  topics: TourTopic[];
  labels: TourLabels;
  tour: TourConfig | null;
  start: (tourId?: string) => Promise<void>;
  startTopic: (topicId: string) => Promise<void>;
  skip: () => Promise<void>;
  filterTopics: (query?: string) => TourTopic[];
}

export interface ResumePillRenderProps {
  labels: TourLabels;
  progress: ResumableProgress;
  resume: () => Promise<void>;
  className?: string;
}

/** Values handed to a custom coachmark renderer by `TutorialOverlay`. */
export interface CoachmarkRenderProps {
  step: TourStep;
  chapter: TourChapter | null;
  index: number;
  total: number;
  context: TourContext;
  labels: TourLabels;
  isHeld: boolean;
  target: Element | null;
  hole: { top: number; left: number; width: number; height: number } | null;
  placement: Placement;
  cardSize: { width: number; height: number };
  missing: boolean;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  skip: () => Promise<void>;
  finish: () => Promise<void>;
}

export interface TourConfig {
  id: string;
  title?: string;
  description?: string;
  chapters: TourChapter[];
  gate?: GateOption[];
  renderGate?: (props: GateRenderProps) => ReactNode;
  renderResumePill?: (props: ResumePillRenderProps) => ReactNode;
  renderCoachmark?: (props: CoachmarkRenderProps) => ReactNode;
  topics?: TourTopic[];
  labels?: Partial<TourLabels>;
  context?: ContextInput;
  storage?: TourStorage;
  /** Storage key, or a function of the tour id. Default: `tutor-ai:<tourId>`. */
  storageKey?: string | ((tourId: string) => string);
  defaultWaitForTarget?: number;
  showProgress?: boolean;
  showResumePill?: boolean;
  scrollIntoView?: boolean;
  isStepDone?: (stepId: string, ctx: TourContext) => boolean;
}

export type TourState = 'idle' | 'pending' | 'running' | 'finished';

export interface ResumableProgress {
  tourId: string;
  stepId: string;
}

/** Public API returned by `useTutor()`. */
export interface TutorApi {
  state: TourState;
  tours: TourConfig[];
  topics: TourTopic[];
  config: TourConfig | null;
  activeTourId: string | null;
  currentStep: TourStep | null;
  currentChapter: TourChapter | null;
  currentIndex: number;
  currentStepIndex: number;
  total: number;
  totalSteps: number;
  doneStepIds: string[];
  completedTours: string[];
  resumableTours: ResumableProgress[];
  isRunning: boolean;
  isHeld: boolean;
  context: TourContext;
  labels: TourLabels;
  start: (tourId?: string, stepId?: string) => Promise<void>;
  startTour: (tourId?: string, stepId?: string) => Promise<void>;
  startTopic: (topicId: string) => Promise<void>;
  openGate: () => void;
  resume: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  goTo: (stepId: string) => Promise<void>;
  finish: () => Promise<void>;
  skip: () => Promise<void>;
  stop: () => Promise<void>;
  hold: () => void;
  release: () => void;
  resetProgress: (tourId?: string) => Promise<void>;
  filterTopics: (query?: string) => TourTopic[];
  resolveTopicSteps: (topicId: string) => TourStep[];
}

export interface TutorProviderProps {
  config: TourConfig | TourConfig[];
  children?: ReactNode;
  /** Provider-level context; overrides config-level context. */
  context?: ContextInput;
  labels?: Partial<TourLabels>;
}

export interface TutorialOverlayProps {
  labels?: Partial<TourLabels>;
  className?: string;
  zIndex?: number;
  showProgress?: boolean;
}

export interface TourResumePillProps {
  labels?: Partial<TourLabels>;
  className?: string;
}

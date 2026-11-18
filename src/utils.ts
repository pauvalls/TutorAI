import type {
  ContextInput,
  FlatEntry,
  TargetWhen,
  TourConfig,
  TourContext,
  TourStep,
  TourTopic,
} from './types';

export const EMPTY_CONTEXT: TourContext = {
  capabilities: [],
  roles: [],
  meta: {},
};

export async function resolveContext(input?: ContextInput): Promise<TourContext> {
  if (!input) return EMPTY_CONTEXT;
  if (typeof input === 'function') {
    return { ...EMPTY_CONTEXT, ...(await input()) };
  }
  return { ...EMPTY_CONTEXT, ...input };
}

export function flattenTour(config: TourConfig): FlatEntry[] {
  return config.chapters.flatMap((chapter) =>
    chapter.steps.map((step) => ({ step, chapter })),
  );
}

export function isStepDone(
  entry: FlatEntry,
  config: TourConfig,
  ctx: TourContext,
): boolean {
  const predicate = entry.step.isStepDone ?? config.isStepDone;
  return predicate ? predicate(entry.step.id, ctx) === true : false;
}

/** Flatten -> filter by chapter/step `when`, generic done predicate and topic. */
export function visibleEntries(
  config: TourConfig,
  ctx: TourContext,
  topic?: TourTopic | null,
): FlatEntry[] {
  return flattenTour(config).filter((entry) => {
    if (entry.chapter.when && !entry.chapter.when(ctx)) return false;
    if (entry.step.when && !entry.step.when(ctx)) return false;
    if (isStepDone(entry, config, ctx)) return false;
    if (topic?.stepIds && !topic.stepIds.includes(entry.step.id)) return false;
    return true;
  });
}

export function storageKeyFor(config: TourConfig): string {
  if (!config.storageKey) return `tutor-ai:${config.id}`;
  return typeof config.storageKey === 'function'
    ? config.storageKey(config.id)
    : config.storageKey;
}

export function collectTopics(tours: TourConfig[]): TourTopic[] {
  const seen = new Set<string>();
  const result: TourTopic[] = [];
  for (const tour of tours) {
    for (const topic of tour.topics ?? []) {
      if (seen.has(topic.id)) continue;
      seen.add(topic.id);
      result.push(topic);
    }
  }
  return result;
}

export function matchTopics(topics: TourTopic[], query?: string): TourTopic[] {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return topics;
  return topics.filter((topic) =>
    [topic.label, topic.description ?? '', ...(topic.keywords ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

export function progressText(
  template: string,
  current: number,
  total: number,
): string {
  return template
    .split('{current}')
    .join(String(current))
    .split('{total}')
    .join(String(total));
}

function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return !!(element.getClientRects().length > 0);
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
  if (!style) return true;
  return (
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    Number(style.opacity) > 0
  );
}

function querySelectorSafe(selector: string): Element | null {
  if (typeof document === 'undefined' || !selector) return null;
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Chooses the element to spotlight. Returns `null` when the step has no target
 * (a centered card is valid) and `undefined` when a configured target is not
 * currently resolvable (the overlay waits, then skips).
 */
export function resolveTarget(
  step: TourStep,
  ctx: TourContext,
): Element | null | undefined {
  const fallback = (): Element | null => {
    if (!step.target) return null;
    if (typeof step.target === 'function') {
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

  if (step.targetWhen.when === 'visible') {
    return conditionalVisible ? conditional : fallback();
  }
  // when === 'hidden': prefer the fallback while the selector is absent/hidden.
  return conditionalVisible ? conditional : fallback();
}

export function isVisibleElement(element: Element | null | undefined): boolean {
  return !!element && isElementVisible(element);
}

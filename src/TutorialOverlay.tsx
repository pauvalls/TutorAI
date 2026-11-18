import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTutor } from './TutorProvider';
import type { TutorialOverlayProps } from './types';
import { isVisibleElement, progressText, resolveTarget } from './utils';

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

function sameRect(a: Hole | null, b: Hole | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

/** Optional manual mount. When omitted, apps can rely on the gate + auto overlay. */
export function TutorialOverlay({
  labels: labelsProp,
  className,
  zIndex = 10000,
  showProgress,
}: TutorialOverlayProps): React.JSX.Element | null {
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
    context,
  } = tutor;
  const labels = useMemo(
    () => ({ ...contextLabels, ...labelsProp }),
    [contextLabels, labelsProp],
  );

  const [target, setTarget] = useState<Element | null>(null);
  const [hole, setHole] = useState<Hole | null>(null);
  const [cardSize, setCardSize] = useState({ width: 340, height: 190 });
  const [missing, setMissing] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const updateRef = useRef<() => void>(() => undefined);
  const lastTargetRef = useRef<Element | null>(null);
  const scrolledRef = useRef<Element | null>(null);
  const advancedRef = useRef(false);
  const lastHoleRef = useRef<Hole | null>(null);
  const stepId = currentStep?.id;
  const placement = currentStep?.placement ?? 'bottom';

  useEffect(() => {
    advancedRef.current = false;
    lastTargetRef.current = null;
    scrolledRef.current = null;
    lastHoleRef.current = null;
    setTarget(null);
    setHole(null);
    setMissing(false);

    if (!currentStep || state !== 'running' || isHeld || typeof document === 'undefined') {
      return;
    }

    const waitMs =
      currentStep.waitForTarget ?? config?.defaultWaitForTarget ?? 1500;
    const startedAt = Date.now();
    let raf = 0;
    let cancelled = false;

    const update = () => {
      if (cancelled) return;
      const chosen = resolveTarget(currentStep, context);
      const usable = chosen && isVisibleElement(chosen) ? chosen : null;

      if (!usable) {
        if (
          currentStep.advanceWhenHidden &&
          lastTargetRef.current &&
          !advancedRef.current
        ) {
          advancedRef.current = true;
          lastTargetRef.current = null;
          void tutor.next();
          return;
        }
        if (Date.now() - startedAt >= waitMs) setMissing(true);
        return;
      }

      setMissing(false);
      setTarget((previous) => (previous === usable ? previous : usable));
      lastTargetRef.current = usable;

      const rect = usable.getBoundingClientRect();
      const padding = currentStep.padding ?? 8;
      const nextHole: Hole = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      };
      if (!sameRect(lastHoleRef.current, nextHole)) {
        lastHoleRef.current = nextHole;
        setHole(nextHole);
      }

      const shouldScroll =
        currentStep.scrollIntoView ?? config?.scrollIntoView ?? true;
      if (shouldScroll && scrolledRef.current !== usable) {
        scrolledRef.current = usable;
        usable.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [stepId, state, isHeld, context, config?.defaultWaitForTarget, config?.scrollIntoView]);

  useEffect(() => {
    if (!missing) return;
    const timer = window.setTimeout(() => {
      void tutor.next();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [missing, tutor.next]);

  useEffect(() => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setCardSize({ width: rect.width, height: rect.height });
    }
  }, [stepId, hole, missing]);

  const cardPosition = useMemo<{ left: number; top: number }>(() => {
    const viewportWidth =
      typeof window === 'undefined' ? 1024 : window.innerWidth;
    const viewportHeight =
      typeof window === 'undefined' ? 768 : window.innerHeight;
    const gap = 12;
    const margin = 12;
    const width = cardSize.width;
    const height = cardSize.height;

    if (!hole) {
      return {
        left: Math.max(margin, (viewportWidth - width) / 2),
        top: Math.max(margin, (viewportHeight - height) / 2),
      };
    }

    const centerX = hole.left + hole.width / 2;
    const centerY = hole.top + hole.height / 2;
    let left = 0;
    let top = 0;

    if (placement === 'top') {
      left = centerX - width / 2;
      top = hole.top - height - gap;
      if (top < margin) top = hole.top + hole.height + gap;
    } else if (placement === 'left') {
      left = hole.left - width - gap;
      top = centerY - height / 2;
      if (left < margin) left = hole.left + hole.width + gap;
    } else if (placement === 'right') {
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
      top: Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin)),
    };
  }, [hole, cardSize, placement]);

  if (typeof document === 'undefined') return null;
  if (state !== 'running' || !currentStep || isHeld) return null;

  const progressVisible = showProgress ?? config?.showProgress ?? true;
  const isLast = currentIndex === total - 1;

  if (config?.renderCoachmark) {
    return createPortal(
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
        finish: tutor.finish,
      }),
      document.body,
    );
  }

  return createPortal(
    <div
      className={`tutorai-overlay${className ? ` ${className}` : ''}`}
      style={{ zIndex }}
      data-test="tutor-overlay"
    >
      {hole && (
        <div
          className="tutorai-spotlight"
          data-test="tutor-spotlight"
          aria-hidden="true"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      )}
      {progressVisible && (
        <div className="tutorai-progress" data-test="tutor-progress" role="status">
          {progressText(labels.progress, currentIndex + 1, total)}
        </div>
      )}
      {missing ? (
        <div
          className="tutorai-notice"
          role="status"
          data-test="tutor-missing-target"
          style={{ left: cardPosition.left, top: cardPosition.top }}
        >
          <span>{labels.missingTarget}</span>
          <button
            type="button"
            className="tutorai-button tutorai-primary"
            onClick={() => void tutor.next()}
          >
            {labels.next}
          </button>
        </div>
      ) : (
        <div
          className="tutorai-card"
          ref={cardRef}
          role="dialog"
          aria-label={currentStep.title}
          data-test="tutor-card"
          style={{ left: cardPosition.left, top: cardPosition.top }}
        >
          <div className="tutorai-card-header">
            <h3 className="tutorai-card-title">{currentStep.title}</h3>
            <button
              type="button"
              className="tutorai-icon-button"
              aria-label={labels.skip}
              data-test="tutor-close"
              onClick={() => void tutor.skip()}
            >
              ×
            </button>
          </div>
          <p className="tutorai-card-content">{currentStep.content}</p>
          <div className="tutorai-card-actions">
            {currentIndex > 0 && (
              <button
                type="button"
                className="tutorai-button"
                data-test="tutor-prev"
                onClick={() => void tutor.prev()}
              >
                {labels.prev}
              </button>
            )}
            <button
              type="button"
              className="tutorai-button tutorai-primary"
              data-test="tutor-next"
              onClick={() => void (isLast ? tutor.finish() : tutor.next())}
            >
              {isLast ? labels.finish : labels.next}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTutor } from './TutorProvider';
import type { TourResumePillProps } from './types';

/** Floating "resume" control; renders only when stored progress exists. */
export function TourResumePill({
  labels: labelsProp,
  className,
}: TourResumePillProps): React.JSX.Element | null {
  const tutor = useTutor();
  const labels = useMemo(
    () => ({ ...tutor.labels, ...labelsProp }),
    [tutor.labels, labelsProp],
  );
  const progress = tutor.resumableTours[0];
  const enabled = tutor.config?.showResumePill ?? true;

  if (typeof document === 'undefined') return null;
  if (!enabled || !progress) return null;
  if (tutor.state === 'running' || tutor.state === 'pending') return null;

  if (tutor.config?.renderResumePill) {
    return (
      <>
        {tutor.config.renderResumePill({
          labels,
          progress,
          resume: tutor.resume,
          className,
        })}
      </>
    );
  }

  return createPortal(
    <button
      type="button"
      className={`tutorai-resume-pill${className ? ` ${className}` : ''}`}
      title={labels.resumePillTitle}
      aria-label={labels.resumePillTitle}
      data-test="tutor-resume-pill"
      onClick={() => void tutor.resume()}
    >
      {labels.resume}
    </button>,
    document.body,
  );
}

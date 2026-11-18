import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTutor } from './TutorProvider';
import type { GateOption } from './types';

/** Shown while state === 'pending'. Override with `config.renderGate`. */
export function TutorialGate({ className }: { className?: string }): React.JSX.Element | null {
  const tutor = useTutor();
  const [query, setQuery] = useState('');

  if (typeof document === 'undefined') return null;
  if (tutor.state !== 'pending') return null;

  const tour = tutor.config;
  const options: GateOption[] =
    tour?.gate ??
    tutor.tours.map((item) => ({
      id: item.id,
      label: item.title ?? item.id,
      description: item.description,
      tourId: item.id,
    }));
  const topics = tutor.filterTopics(query);

  if (tour?.renderGate) {
    return (
      <>
        {tour.renderGate({
          options,
          topics,
          labels: tutor.labels,
          tour,
          start: tutor.startTour,
          startTopic: tutor.startTopic,
          skip: tutor.skip,
          filterTopics: tutor.filterTopics,
        })}
      </>
    );
  }

  return createPortal(
    <div
      className={`tutorai-gate${className ? ` ${className}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorai-gate-title"
      data-test="tutor-gate"
    >
      <div className="tutorai-gate-panel">
        <h2 className="tutorai-gate-title" id="tutorai-gate-title">
          {tutor.labels.gateTitle}
        </h2>
        <p className="tutorai-gate-subtitle">{tutor.labels.gateSubtitle}</p>

        {options.length > 0 && (
          <div className="tutorai-gate-options" data-test="tutor-gate-options">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="tutorai-button tutorai-primary tutorai-gate-option"
                data-test={`tutor-gate-option-${option.id}`}
                onClick={() => void tutor.startTour(option.tourId ?? option.id)}
              >
                <span>{option.label}</span>
                {option.description && (
                  <small className="tutorai-gate-option-description">
                    {option.description}
                  </small>
                )}
              </button>
            ))}
          </div>
        )}

        {topics.length > 0 && (
          <div className="tutorai-topics" data-test="tutor-topics">
            <h3 className="tutorai-topics-title">{tutor.labels.topicsTitle}</h3>
            <input
              className="tutorai-topic-filter"
              type="search"
              value={query}
              placeholder={tutor.labels.topicFilterPlaceholder}
              aria-label={tutor.labels.topicFilterPlaceholder}
              data-test="tutor-topic-filter"
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="tutorai-topic-list">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className="tutorai-topic-button"
                  data-test={`tutor-topic-${topic.id}`}
                  onClick={() => void tutor.startTopic(topic.id)}
                >
                  <span>{topic.label}</span>
                  {topic.description && <small>{topic.description}</small>}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="tutorai-button tutorai-gate-skip"
          data-test="tutor-gate-skip"
          onClick={() => void tutor.skip()}
        >
          {tutor.labels.skip}
        </button>
      </div>
    </div>,
    document.body,
  );
}

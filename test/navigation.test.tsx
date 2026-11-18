import React from 'react';
import { configure } from '@testing-library/dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TutorialGate,
  TutorialOverlay,
  TutorProvider,
  holdTour,
  releaseTour,
  resetHold,
  useTutor,
  type CoachmarkRenderProps,
  type TutorApi,
  type TourConfig,
  type TourStorage,
} from '../src';

configure({ testIdAttribute: 'data-test' });

let api: TutorApi;

function Probe() {
  api = useTutor();
  return <div data-test="probe">{api.state}</div>;
}

function Harness({
  config,
  children,
}: {
  config: TourConfig | TourConfig[];
  children?: React.ReactNode;
}) {
  return (
    <TutorProvider config={config}>
      <Probe />
      {children}
    </TutorProvider>
  );
}

function mockStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const storage: TourStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return { storage, data };
}

function baseConfig(overrides: Partial<TourConfig> = {}): TourConfig {
  return {
    id: 'tour',
    chapters: [
      {
        id: 'chapter',
        steps: [
          { id: 'a', title: 'A', content: 'First', target: '[data-test="a"]' },
          { id: 'b', title: 'B', content: 'Second', target: '[data-test="b"]' },
          { id: 'c', title: 'C', content: 'Third', target: '[data-test="c"]' },
        ],
      },
    ],
    storage: mockStorage().storage,
    ...overrides,
  };
}

beforeEach(() => {
  resetHold();
});

afterEach(() => {
  cleanup();
  resetHold();
});

describe('navigation', () => {
  it('filters steps by context predicates at start', async () => {
    const config = baseConfig({
      context: { roles: ['viewer'], capabilities: [], meta: {} },
      chapters: [
        {
          id: 'chapter',
          steps: [
            { id: 'a', title: 'A', content: 'A', when: (ctx) => ctx.roles.includes('admin') },
            { id: 'b', title: 'B', content: 'B' },
            { id: 'c', title: 'C', content: 'C', when: (ctx) => ctx.roles.includes('admin') },
          ],
        },
      ],
    });
    render(<Harness config={config} />);
    await waitFor(() => expect(api.state).toBe('pending'));

    await act(async () => {
      await api.start();
    });
    expect(api.state).toBe('running');
    expect(api.currentStep?.id).toBe('b');
    expect(api.totalSteps).toBe(1);
    expect(api.isRunning).toBe(true);
  });

  it('skips hidden steps and awaits onExit/onEnter in order', async () => {
    const order: string[] = [];
    const config = baseConfig({
      context: { roles: ['admin'], capabilities: [], meta: {} },
      chapters: [
        {
          id: 'chapter',
          when: (ctx) => ctx.roles.includes('admin'),
          steps: [
            { id: 'a', title: 'A', content: 'A', when: (ctx) => ctx.roles.includes('nope') },
            {
              id: 'b',
              title: 'B',
              content: 'B',
              onEnter: async () => {
                order.push('enter:b');
              },
              onExit: async () => {
                order.push('exit:b');
              },
            },
            {
              id: 'c',
              title: 'C',
              content: 'C',
              onEnter: async () => {
                order.push('enter:c');
              },
              onExit: async () => {
                order.push('exit:c');
              },
            },
          ],
        },
      ],
    });
    render(<Harness config={config} />);
    await waitFor(() => expect(api.state).toBe('pending'));
    await act(async () => {
      await api.start();
    });
    expect(api.currentStep?.id).toBe('b');

    await act(async () => {
      await api.next();
    });
    expect(api.currentStep?.id).toBe('c');
    expect(api.currentStepIndex).toBe(1);
    expect(order).toEqual(['enter:b', 'exit:b', 'enter:c']);

    await act(async () => {
      await api.prev();
    });
    expect(api.currentStep?.id).toBe('b');
    expect(order).toEqual([
      'enter:b', 'exit:b', 'enter:c', 'exit:c', 'enter:b',
    ]);
  });

  it('skips steps already marked done by a generic predicate', async () => {
    const config = baseConfig({
      context: { roles: [], capabilities: [], meta: { doneA: true } },
      isStepDone: (stepId, ctx) => stepId === 'a' && Boolean(ctx.meta.doneA),
    });
    render(<Harness config={config} />);
    await waitFor(() => expect(api.state).toBe('pending'));
    await act(async () => {
      await api.start();
    });
    expect(api.currentStep?.id).toBe('b');
    expect(api.doneStepIds).toEqual(['a']);
    expect(api.totalSteps).toBe(2);
  });

  it('persists completion and hides the gate on the next mount', async () => {
    const { storage, data } = mockStorage();
    const config = baseConfig({
      storage,
      chapters: [{ id: 'chapter', steps: [{ id: 'a', title: 'A', content: 'A' }] }],
    });
    const first = render(<Harness config={config}><TutorialGate /></Harness>);
    await waitFor(() => expect(api.state).toBe('pending'));
    expect(screen.getByTestId('tutor-gate')).toBeTruthy();

    await act(async () => {
      await api.start();
    });
    await act(async () => {
      await api.finish();
    });
    expect(api.state).toBe('finished');
    expect(JSON.parse(String(data.get('tutor-ai:tour'))).done).toBe(true);
    first.unmount();

    render(<Harness config={config}><TutorialGate /></Harness>);
    await waitFor(() => expect(api.state).toBe('idle'));
    expect(screen.queryByTestId('tutor-gate')).toBeNull();
  });

  it('resumes unfinished progress and exposes aliases', async () => {
    const config = baseConfig();
    render(<Harness config={config} />);
    await waitFor(() => expect(api.state).toBe('pending'));
    await act(async () => {
      await api.startTour();
    });
    await act(async () => {
      await api.next();
    });
    expect(api.currentStep?.id).toBe('b');
    await act(async () => {
      await api.stop();
    });
    expect(api.state).toBe('idle');
    expect(api.resumableTours).toEqual([{ tourId: 'tour', stepId: 'b' }]);

    await act(async () => {
      await api.resume();
    });
    expect(api.state).toBe('running');
    expect(api.currentStep?.id).toBe('b');
  });

  it('holds and releases the engine without losing the step', async () => {
    const config = baseConfig();
    render(<Harness config={config} />);
    await waitFor(() => expect(api.state).toBe('pending'));
    await act(async () => {
      await api.start();
    });
    expect(api.currentStep?.id).toBe('a');

    act(() => {
      holdTour();
    });
    expect(api.isHeld).toBe(true);
    await act(async () => {
      await api.next();
    });
    expect(api.currentStep?.id).toBe('a');

    act(() => {
      releaseTour();
    });
    expect(api.isHeld).toBe(false);
    await act(async () => {
      await api.next();
    });
    expect(api.currentStep?.id).toBe('b');
  });

  it('invokes a custom coachmark renderer with the current step', async () => {
    function CustomCoachmark(props: CoachmarkRenderProps) {
      return <div data-testid="custom-coachmark-step">{props.step.id}</div>;
    }
    const config = baseConfig({
      renderCoachmark: (props) => <CustomCoachmark {...props} />,
    });
    render(
      <Harness config={config}>
        <TutorialOverlay />
      </Harness>,
    );
    await waitFor(() => expect(api.state).toBe('pending'));
    await act(async () => {
      await api.start();
    });
    expect(api.currentStep?.id).toBe('a');
    await waitFor(() => {
      const el = document.body.querySelector('[data-testid="custom-coachmark-step"]');
      expect(el?.textContent).toBe('a');
    });
    expect(screen.queryByTestId('tutor-card')).toBeNull();
  });
});

describe('topics', () => {
  it('filters, resolves and starts topic-scoped steps', async () => {
    const config = baseConfig({
      topics: [
        {
          id: 'alpha',
          label: 'Alpha topic',
          tourId: 'tour',
          stepIds: ['b'],
          keywords: ['second'],
        },
      ],
    });
    render(<Harness config={config}><TutorialGate /></Harness>);
    await waitFor(() => expect(api.state).toBe('pending'));
    expect(api.filterTopics('second').map((topic) => topic.id)).toEqual(['alpha']);
    expect(api.filterTopics('nope')).toEqual([]);
    expect(api.resolveTopicSteps('alpha').map((step) => step.id)).toEqual(['b']);

    fireEvent.change(screen.getByTestId('tutor-topic-filter'), {
      target: { value: 'second' },
    });
    expect(screen.getByTestId('tutor-topic-alpha')).toBeTruthy();

    await act(async () => {
      await api.startTopic('alpha');
    });
    expect(api.currentStep?.id).toBe('b');
    expect(api.totalSteps).toBe(1);
  });
});

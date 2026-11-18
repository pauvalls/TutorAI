---
name: tutor-ai
description: Use when adding a tutorial, guided tour, coachmark, spotlight or onboarding flow to a React app with tutor-ai. Triggers in English and Spanish: tutorial, guided tour, coachmark, onboarding, tutor-ai, tutoriales, tutorial interactivo, recorrido guiado.
license: MIT
---

# tutor-ai

Generic, AI-First guided tours for React 18+. The library ships no app data: every
string comes from `labels`, every target is a CSS selector or resolver, and every
condition is a predicate over a generic `TourContext`. Installing the package also
generates Agent Skills in the consumer project.

## When to use

- First-run onboarding, feature reveals, or multi-step walkthroughs.
- You need to spotlight a DOM element and follow it into a modal.
- You want the tour definition to live in data that agents can author and edit.
- You need progress persistence, resume, topics, and a hold/pause switch for sensitive flows.

## Install

```bash
npm install tutor-ai
```

Import the stylesheet once at the app root:

```tsx
import 'tutor-ai/styles.css';
```

Agent Skills are copied to `.claude/skills` and `.agents/skills` on install.
Set `TUTOR_AI_SKIP_SKILLS=1` to disable, `TUTOR_AI_SKILLS_FORCE=1` to overwrite.

## Quickstart

```tsx
import {
  TutorProvider, TutorialGate, TutorialOverlay, TourResumePill,
  createLocalStorage,
  type TourConfig,
} from 'tutor-ai';

const tour: TourConfig = {
  id: 'basics',
  title: 'Basics',
  chapters: [{
    id: 'start',
    steps: [
      { id: 'welcome', title: 'Start here', content: 'Click New to begin.', target: '[data-test="new"]' },
      { id: 'dialog', title: 'The dialog', content: 'This follows you into the modal.',
        target: '[data-test="new"]',
        targetWhen: { selector: '[role="dialog"]', when: 'visible' },
        placement: 'bottom' },
    ],
  }],
  gate: [{ id: 'basics', label: 'Take the basics tour', tourId: 'basics' }],
  topics: [{ id: 'create', label: 'Creating items', tourId: 'basics', keywords: ['new', 'start'] }],
  storage: createLocalStorage(),
};

export function App() {
  return (
    <TutorProvider config={tour} context={{ roles: ['editor'], capabilities: [], meta: {} }}>
      <TutorialGate />
      <TutorialOverlay />
      <TourResumePill />
      {/* your app */}
    </TutorProvider>
  );
}
```

Use stable `data-test` attributes as targets. Set labels once for i18n:

```tsx
<TutorProvider
  config={tour}
  labels={{ gateTitle: 'Bienvenido', next: 'Siguiente', skip: 'Omitir' }}
>
```

## API reference

| Export | Purpose |
| --- | --- |
| `TutorProvider` | Holds tour state and exposes context. Props: `config`, optional `context`, `labels`. |
| `useTutor()` | Engine API: `state`, `start`, `startTour`, `startTopic`, `openGate`, `resume`, `next`, `prev`, `goTo`, `finish`, `skip`, `stop`, `hold`, `release`, `resetProgress`, and derived fields. |
| `TutorialGate` | Renders while state is `pending`; consumes `gate` options and topic shortcuts. |
| `TutorialOverlay` | Portal spotlight + card. Mount it once anywhere under the provider. |
| `TourResumePill` | Floating resume button for unfinished tours. |
| `holdTour()` / `releaseTour()` / `isTourHeld()` | Module-level pause switch, useful around a payment flow. |
| `createLocalStorage()` / `noopStorage` | Storage adapters. |
| `TourConfig`, `TourChapter`, `TourStep`, `TourTopic`, `TourContext`, `TourLabels`, `GateOption`, `TourState`, `TourStorage`, `Placement` | TypeScript types. |

Key `TourConfig` options: `id`, `title`, `description`, `chapters`, `gate`, `topics`,
`labels`, `context`, `storage`, `storageKey`, `defaultWaitForTarget`, `showProgress`,
`showResumePill`, `scrollIntoView`, `isStepDone`, `renderGate`, `renderResumePill`.

Key step options: `id`, `title`, `content`, `target`, `targetWhen`, `placement`,
`padding`, `when`, `isStepDone`, `onEnter`, `onExit`, `waitForTarget`,
`advanceWhenHidden`, `scrollIntoView`.

See `references/api.md` for all defaults and types.

## Theming

Override CSS custom properties:

```css
:root {
  --tutorai-primary: #6d5efc;
  --tutorai-surface: #ffffff;
  --tutorai-text: #1f2430;
  --tutorai-overlay: rgba(15, 18, 30, 0.55);
  --tutorai-radius: 12px;
  --tutorai-shadow: 0 18px 50px rgba(15, 18, 30, 0.24);
}
```

## Troubleshooting

- **No gate appears** — storage already marks the tour done. Call `resetProgress()`.
- **Card points at nothing** — the selector is wrong or appears late; raise `waitForTarget`.
- **Modal step does not follow** — add `targetWhen: { selector: '[role="dialog"]', when: 'visible' }`.
- **Steps are skipped** — `when` or `isStepDone` is false for the current context.
- **Engine frozen** — something called `holdTour()`; call `releaseTour()`.
- **SSR error** — all DOM access is guarded; make sure the stylesheet is imported, not fetched at request time.

## References

- `references/api.md` — complete API, defaults, and storage format.
- Skill `tutor-ai-authoring` — how to design and test tours.

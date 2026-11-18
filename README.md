# TutorAI

Generic, AI-First guided tours (coachmarks / spotlights) for React 18+ — data-driven, zero app copy, and Agent Skills generated in your project on install.

## AI First

Installing `tutor-ai` automatically writes two Agent Skills into the consumer project:

- `.claude/skills/tutor-ai` — how to install, configure and troubleshoot the library.
- `.claude/skills/tutor-ai-authoring` — how to design and author tours.

The same skills are copied to `.agents/skills`. An AI assistant in your repo can read them and author tours using your real selectors, context and labels — without you pasting documentation into every prompt. Install is idempotent; existing `SKILL.md` files are never overwritten.

```bash
TUTOR_AI_SKIP_SKILLS=1 npm install tutor-ai   # disable
TUTOR_AI_SKILLS_FORCE=1 npm install tutor-ai  # overwrite
TUTOR_AI_SKILLS_DIR=docs/skills npm install tutor-ai  # extra destination
node node_modules/tutor-ai/scripts/uninstall-skills.mjs  # remove generated skills
```

## Install

```bash
npm install tutor-ai
```

React 18+ and react-dom 18+ are peer dependencies. There are no other runtime dependencies.

## Quickstart

```tsx
import 'tutor-ai/styles.css';
import {
  TutorProvider, TutorialGate, TutorialOverlay, TourResumePill,
  type TourConfig,
} from 'tutor-ai';

const tour: TourConfig = {
  id: 'basics',
  title: 'Basics tour',
  chapters: [{
    id: 'getting-started',
    steps: [
      {
        id: 'new',
        title: 'Create a new item',
        content: 'Click here to create your first item.',
        target: '[data-test="new-item"]',
        placement: 'bottom',
      },
      {
        id: 'dialog',
        title: 'The dialog',
        content: 'This step follows the user into the modal.',
        target: '[data-test="new-item"]',
        targetWhen: { selector: '[role="dialog"]', when: 'visible' },
      },
    ],
  }],
  gate: [{ id: 'basics', label: 'Take the basics tour', tourId: 'basics' }],
  topics: [{ id: 'create', label: 'Creating', tourId: 'basics', keywords: ['new'] }],
};

export function App() {
  return (
    <TutorProvider
      config={tour}
      context={{ roles: ['editor'], capabilities: [], meta: {} }}
      labels={{ gateTitle: 'Welcome!', next: 'Continue' }}
    >
      <TutorialGate />
      <TutorialOverlay />
      <TourResumePill />
      {/* your application */}
    </TutorProvider>
  );
}
```

Keyboard shortcuts while a tour is running: `ArrowRight`/`Enter` = next, `ArrowLeft` = previous, `Escape` = skip. Inputs and textareas are ignored.

## API

| Export | Purpose |
| --- | --- |
| `TutorProvider` | Holds state; props: `config` (one or many `TourConfig`), `context?`, `labels?`. |
| `useTutor()` | Returns `state`, `currentStep`, `currentChapter`, `currentIndex`/`currentStepIndex`, `total`/`totalSteps`, `doneStepIds`, `completedTours`, `resumableTours`, `isRunning`, `isHeld`, `context`, `labels`, `tours`, `topics`, `config`, and commands below. |
| Commands | `start(tourId?, stepId?)`, `startTour` (alias), `startTopic(id)`, `openGate()`, `resume()`, `next()`, `prev()`, `goTo(stepId)`, `finish()`, `skip()`, `stop()`, `hold()`, `release()`, `resetProgress(tourId?)`, `filterTopics(query?)`, `resolveTopicSteps(id)`. |
| `TutorialGate` | Renders on `pending`; shows `gate` options, topic shortcuts and a topic filter. |
| `TutorialOverlay` | Optional manual mount: portal spotlight, card, progress, target waiting. |
| `TourResumePill` | Floating resume button for unfinished tours; opt out with `showResumePill: false`. |
| `holdTour()`, `releaseTour()`, `isTourHeld()` | Module-level pause switch (use `hold`/`release` from context inside components). |
| `createLocalStorage()`, `noopStorage` | Storage adapters. |
| `DEFAULT_LABELS` | English default strings. |
| Types | `TourConfig`, `TourChapter`, `TourStep`, `TourTopic`, `TourContext`, `TourLabels`, `GateOption`, `TourState`, `TourStorage`, `Placement`, `TargetResolver`, `TargetWhen`, `CoachmarkRenderProps`, plus other render-props and provider props. |

Key `TourConfig` options: `id`, `title`, `description`, `chapters`, `gate`, `topics`, `labels`, `context`, `storage`, `storageKey`, `defaultWaitForTarget` (1500 ms), `showProgress` (true), `showResumePill` (true), `scrollIntoView` (true), `isStepDone`, `renderGate`, `renderResumePill`, `renderCoachmark`.

Key `TourStep` options: `id`, `title`, `content`, `target` (selector or resolver), `targetWhen`, `placement`, `padding` (8), `when`, `isStepDone`, `onEnter`, `onExit`, `waitForTarget`, `advanceWhenHidden`, `scrollIntoView`.

All conditions are predicates over a generic context: `{ capabilities: string[], roles: string[], meta: Record<string, unknown> }`. No routes, roles or copy are baked into the library.

### Persistence and resume

Each tour stores JSON under `tutor-ai:<tourId>`: `{ done, stepId, updatedAt }`. Completed tours never show the gate again. Unfinished tours expose `resumableTours`, power `TourResumePill`, and can be restarted with `resume()`. Override with `storageKey` or a `storage` adapter; clear everything with `resetProgress()`.

### Hold / release

For a sensitive flow (e.g. a payment), freeze the engine without unmounting:

```ts
import { holdTour, releaseTour } from 'tutor-ai';

holdTour();
try {
  await openPayment();
} finally {
  releaseTour();
}
```

While held, commands are ignored, keyboard shortcuts are disabled, and the overlay is hidden. The current step is preserved.

### Topics

`TourTopic` groups steps: `{ id, label, description?, tourId, stepIds?, keywords? }`. `startTopic(id)` launches the tour at the first listed step and limits visible steps to that list; `filterTopics(query)` matches label, description and keywords. Omitting `stepIds` includes all steps.

## Theming

All classes are prefixed `tutorai-`. Override these custom properties:

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

No fonts are loaded; typography inherits from your app.

## Gate customization

`gate` supplies generic options `{ id, label, description?, tourId? }`. For full control provide `renderGate`:

```tsx
renderGate: ({ options, topics, labels, start, startTopic, skip, filterTopics }) => (
  <MyGate options={options} topics={topics} labels={labels}
    onStart={start} onTopic={startTopic} onSkip={skip} filterTopics={filterTopics} />
)
```

The same pattern applies to `renderResumePill`.

## Coachmark customization

`renderCoachmark` is a custom coachmark renderer for apps with their own design system or analytics/test hooks. `TutorialOverlay` keeps measuring the target, waiting for late selectors and driving navigation; your renderer only supplies the card UI. It receives `step`, `chapter`, `index` (0-based), `total`, `context`, `labels`, `isHeld`, `target`, `hole`, `placement`, `cardSize`, `missing`, and the `next`/`prev`/`skip`/`finish` commands.

```tsx
renderCoachmark: ({ step, index, total, hole, next, skip }) => (
  <MyCoachmark
    title={step.title}
    body={step.content}
    progress={`${index + 1}/${total}`}
    rect={hole}
    data-testid={`coachmark-${step.id}`}
    onNext={() => void next()}
    onSkip={() => void skip()}
  />
)
```

## i18n

Every visible string comes from `labels` (English defaults). Pass a translated partial object at provider or tour level. Step `title` and `content` are data — translate them in your app before building the config.

## Migrating from hardcoded tours

1. Move titles/content out of components into `TourStep.title` and `.content`.
2. Replace hardcoded `if (role === ...)` checks with `when: (ctx) => ...` over `TourContext`.
3. Replace manual "already seen" flags with `isStepDone` or default storage persistence.
4. Replace `document.querySelector` calls with `target` selectors or resolvers.
5. Wrap steps that depend on a modal with `targetWhen`.
6. Delete app-specific wrappers and mount `TutorialGate` + `TutorialOverlay` once.

## Development

```bash
npm install
npm run dev          # tsup watch
npm run typecheck    # tsc --noEmit
npm test             # vitest + installer tests
npm run build        # tsup + CSS copy
npm run skills:install
npm run skills:uninstall
```

## License

MIT © 2026 pauvalls

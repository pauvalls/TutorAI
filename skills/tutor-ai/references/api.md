# tutor-ai API reference (v0.1.0)

## Exports

`TutorProvider`, `useTutor`, `TutorialGate`, `TutorialOverlay`, `TourResumePill`,
`holdTour`, `releaseTour`, `isTourHeld`, `resetHold`, `createLocalStorage`,
`noopStorage`, `DEFAULT_LABELS`, plus all types listed below.

Stylesheet: `import 'tutor-ai/styles.css'`.

## `TourConfig`

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | required | Unique tour id; storage key is `tutor-ai:<id>`. |
| `title` | `string` | — | Used as gate label when `gate` is omitted. |
| `description` | `string` | — | Gate option description. |
| `chapters` | `TourChapter[]` | required | Flattened in order. |
| `gate` | `GateOption[]` | derived | `{ id, label, description?, tourId? }`. |
| `topics` | `TourTopic[]` | `[]` | Generic categories that select steps. |
| `labels` | `Partial<TourLabels>` | English defaults | Merged over defaults, then provider labels. |
| `context` | `ContextInput` | empty | `Partial<TourContext>` or sync/async function. Provider `context` wins. |
| `storage` | `TourStorage` | `createLocalStorage()` | `getItem`/`setItem`/`removeItem`, all may be async. |
| `storageKey` | `string \| (tourId) => string` | `tutor-ai:<tourId>` | Override key. |
| `defaultWaitForTarget` | `number` | `1500` | ms to wait for a target before skipping the step. |
| `showProgress` | `boolean` | `true` | Show `Step {current} of {total}`. |
| `showResumePill` | `boolean` | `true` | Allow `TourResumePill` to render. |
| `scrollIntoView` | `boolean` | `true` | Scroll target into view when a step becomes active. |
| `isStepDone` | `(stepId, ctx) => boolean` | — | Config-level done predicate; skipped steps are filtered out. |
| `renderGate` | `(props: GateRenderProps) => ReactNode` | — | Full custom gate UI. |
| `renderResumePill` | `(props: ResumePillRenderProps) => ReactNode` | — | Custom resume pill. |

`GateRenderProps`: `options`, `topics`, `labels`, `tour`, `start`, `startTopic`,
`skip`, `filterTopics`.

## `TourChapter` / `TourStep`

`TourChapter`: `id`, `title?`, `when?(ctx)`, `steps: TourStep[]`.

`TourStep`:

| Field | Type | Default |
| --- | --- | --- |
| `id` | `string` | required |
| `title` | `string` | required |
| `content` | `string` | required |
| `target` | `string \| (ctx) => Element \| null` | — (centered card) |
| `targetWhen` | `{ selector: string; when: 'visible' \| 'hidden' }` | — |
| `placement` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` (flips/clamps at viewport edge) |
| `padding` | `number` | `8` |
| `when` | `(ctx) => boolean` | — |
| `isStepDone` | `(stepId, ctx) => boolean` | config-level predicate |
| `onEnter` / `onExit` | `(ctx) => void \| Promise<void>` | — (awaited) |
| `waitForTarget` | `number` | config `defaultWaitForTarget` |
| `advanceWhenHidden` | `boolean` | `false` |
| `scrollIntoView` | `boolean` | config `scrollIntoView` |

`targetWhen` resolves at render time. `visible` spotlights the selector while it is
visible, otherwise the step's fallback `target`; `hidden` spotlights the fallback
while the selector is hidden, otherwise the selector. If nothing resolves within
`waitForTarget`, the step is skipped with the `missingTarget` notice.

## `TourTopic`

`{ id, label, description?, tourId, stepIds?, keywords? }`. With no `stepIds`, all
steps of the tour are included. `filterTopics(query)` matches label, description and
keywords case-insensitively.

## `TourContext`

`{ capabilities: string[]; roles: string[]; meta: Record<string, unknown> }`.
Pass it via provider or config. Predicates and hooks receive the resolved value.

## `TourLabels` (English defaults)

| Key | Default |
| --- | --- |
| `gateTitle` | `Welcome` |
| `gateSubtitle` | `Choose a guided tour to get started.` |
| `skip` | `Skip` |
| `next` | `Next` |
| `prev` | `Back` |
| `finish` | `Finish` |
| `progress` | `Step {current} of {total}` |
| `missingTarget` | `We could not find this step's element, so it was skipped.` |
| `topicsTitle` | `Explore by topic` |
| `topicFilterPlaceholder` | `Filter topics…` |
| `resume` | `Resume tour` |
| `resumePillTitle` | `You have an unfinished tour` |

## `useTutor()` API

State/derived: `state` (`idle|pending|running|finished`), `tours`, `topics`, `config`,
`activeTourId`, `currentStep`, `currentChapter`, `currentIndex` / `currentStepIndex`,
`total` / `totalSteps`, `doneStepIds`, `completedTours`, `resumableTours`,
`isRunning`, `isHeld`, `context`, `labels`.

Commands: `start(tourId?, stepId?)`, `startTour` (alias), `startTopic(topicId)`,
`openGate()`, `resume()`, `next()`, `prev()`, `goTo(stepId)`, `finish()`, `skip()`,
`stop()`, `hold()`, `release()`, `resetProgress(tourId?)`, `filterTopics(query?)`,
`resolveTopicSteps(topicId)`.

`skip()`/`stop()` leave stored progress so the resume pill can reappear; `finish()`
marks the tour done. Keyboard: `ArrowRight`/`Enter` next, `ArrowLeft` prev,
`Escape` skip — ignored in text inputs and while held.

## Hold / release

Module-level: `holdTour()`, `releaseTour()`, `isTourHeld()`, `resetHold()`.
Context-level: `hold()`, `release()`, `isHeld`. While held, commands are ignored,
the overlay is hidden, and keyboard shortcuts are disabled. Release resumes at
the same step.

## Persistence format

Storage value is JSON: `{ "done": boolean, "stepId": string, "updatedAt": ISO }`.
Legacy truthy strings are treated as `done: true`. Done tours never show the gate;
unfinished tours with a `stepId` enable `TourResumePill` and `resume()`.

## Theming variables

`--tutorai-primary`, `--tutorai-surface`, `--tutorai-text`, `--tutorai-overlay`,
`--tutorai-radius`, `--tutorai-shadow`. All CSS classes start with `tutorai-`.

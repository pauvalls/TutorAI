---
name: tutor-ai-authoring
description: Use when designing, authoring, or reviewing guided tours and coachmarks with tutor-ai. Covers step anatomy, stable selectors, modal steps, when predicates, async hooks, i18n, accessibility, testing and anti-patterns. Triggers: author tutorial, design onboarding, write coachmark, tour steps, tutoriales, guía interactiva.
license: MIT
---

# Authoring tutor-ai tours

Use this skill when you need to *write* tour data, not just install the library.
Tours are data: arrays of chapters, steps, topics and predicates. Keep app-specific
copy out of components and inside `labels`.

## 1. Plan before writing

1. List the user goal and the 3–7 actions that achieve it.
2. For each action, pick ONE stable DOM hook (`data-test="..."` preferred).
3. Decide what the user must *see* (title/content) and what they must *do* (no automatic
   clicking — the tour only points).
4. Mark steps that depend on roles, capabilities or prior completion.

## 2. Step anatomy

```ts
{
  id: 'create-invoice',             // stable, unique across the tour
  title: 'Create an invoice',       // short imperative
  content: 'Open the New menu.',    // one action per step
  target: '[data-test="new-invoice"]',
  placement: 'bottom',              // top | bottom | left | right
  padding: 8,
  when: (ctx) => ctx.roles.includes('admin'),
  isStepDone: (id, ctx) => Boolean(ctx.meta.invoiceCount),
  onEnter: async (ctx) => { /* optional setup */ },
  onExit: async (ctx) => { /* optional cleanup */ },
  waitForTarget: 2000,
  advanceWhenHidden: false,
  scrollIntoView: true,
}
```

`when` and `isStepDone` are evaluated at start and on every navigation. Both can
live on the chapter (applies to all its steps) or on the step.

## 3. Selector strategy

- Prefer `data-test` / `data-testid` attributes owned by the app.
- Avoid text selectors, nth-child chains, CSS classes used for styling, and generated ids.
- If a target is rendered late, raise `waitForTarget`; after the timeout the step is
  skipped (with the `missingTarget` label) rather than showing a broken card.
- Use a resolver when the target depends on context:
  `target: (ctx) => document.querySelector(\`[data-role="${ctx.meta.roleId}"]\`)`.
- Omit `target` entirely for a centered, target-less step.

## 4. Modal steps

A step that follows the user into a dialog uses `targetWhen`:

```ts
{
  id: 'upload',
  title: 'Upload a file',
  content: 'The dialog opens here.',
  target: '[data-test="upload-button"]',           // fallback
  targetWhen: { selector: '[role="dialog"]', when: 'visible' },
}
```

When the dialog is visible it is spotlighted; when it closes the fallback button is
spotlighted again. Use `when: 'hidden'` when the important state is the selector being
absent. Set `advanceWhenHidden: true` only if the step must auto-advance when its own
spotlighted element disappears.

## 5. Async hooks

`onEnter` and `onExit` may return promises; the engine awaits them before advancing.
Use them for analytics, opening a panel, or waiting for data. Never block on user
input — keep hooks bounded and catch your own errors.

## 6. Topics

Group steps across a tour with `TourTopic`:

```ts
topics: [
  { id: 'billing', label: 'Billing', tourId: 'settings',
    stepIds: ['plan', 'card'], keywords: ['payment', 'invoice'] },
]
```

`startTopic(id)` launches that tour at the topic's first step and restricts the
visible steps to `stepIds`. `filterTopics(query)` powers the gate's search box.

## 7. i18n

All visible strings come from `labels` (English defaults in the library). Pass your
own `labels` at provider or tour level. Never hardcode copy in tour components —
step `title`/`content` are data and should be translated by whatever i18n layer the
consumer uses before they reach `TourConfig`.

## 8. Accessibility

- One action per step; content must make sense without the spotlight.
- Keyboard: `ArrowRight`/`Enter` next, `ArrowLeft` prev, `Escape` skip.
- The card is a `role="dialog"` with an accessible name; the gate is modal.
- The overlay is pointer-transparent: the highlighted element stays clickable.
- Respect focus: avoid steps that require keyboard focus inside an input while a
  keyboard shortcut is needed.

## 9. Testing

- Give every step a unique id; assert `currentStep?.id` after `next()`.
- Provide `storage: noopStorage` (or a mock) so tests are deterministic.
- Test `when` with different `context` values and assert hidden steps are skipped.
- Test modal steps by mounting/unmounting the selector and waiting for the target.
- Assert `onEnter`/`onExit` call order with async spies.

## 10. Custom coachmark renderer

`renderCoachmark` is a custom coachmark renderer for apps with their own design system
or analytics/test hooks. Use it when the default card markup cannot carry your own
components, copy or `data-testid` hooks. The library still measures the target and drives
navigation; you supply only the UI. Props include `step`, `chapter`, `index`, `total`,
`context`, `labels`, `isHeld`, `target`, `hole`, `placement`, `cardSize`, `missing`, and
the `next`/`prev`/`skip`/`finish` commands.

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

Keep the renderer focused on layout: leave target resolution, `waitForTarget` and
step advancement to the engine, and call the supplied commands for navigation.

## 11. Anti-patterns

- Copying app routes, roles, or Spanish/English literals into the library — use `labels`.
- Targeting transient animation wrappers or elements without stable attributes.
- Long paragraphs, multiple actions, or steps that depend on exact pixel positions.
- Mutating tour data after mount without changing `config.id`.
- Leaving `holdTour()` active after a payment/cancel path — always release in `finally`.

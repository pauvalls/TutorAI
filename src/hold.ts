/**
 * Module-level "hold" switch. An app can freeze all tutor engines around a
 * sensitive flow (for example a payment) without threading props through trees.
 */
let held = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function holdTour(): void {
  if (held) return;
  held = true;
  emit();
}

export function releaseTour(): void {
  if (!held) return;
  held = false;
  emit();
}

export function isTourHeld(): boolean {
  return held;
}

export function subscribeHold(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test/diagnostic helper: force the switch back to released. */
export function resetHold(): void {
  held = false;
  emit();
}

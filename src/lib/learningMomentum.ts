export type Momentum = { day: string; explored: boolean; practised: boolean; reflected: boolean };
export type LearningMode = 'teach' | 'solve' | 'revise';
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function freshMomentum(day = localDay()): Momentum {
  return { day, explored: false, practised: false, reflected: false };
}
export function restoreMomentum(value: unknown, day = localDay()): Momentum {
  if (!value || typeof value !== 'object') return freshMomentum(day);
  const saved = value as Partial<Momentum>;
  if (saved.day !== day) return freshMomentum(day);
  const explored = saved.explored === true;
  const practised = explored && saved.practised === true;
  return { day, explored, practised, reflected: practised && saved.reflected === true };
}
export function recordLearning(state: Momentum, mode: LearningMode, response: string, attemptedPractice = false, day = localDay()): Momentum {
  const current = restoreMomentum(state, day);
  if (!response.trim()) return current;
  if (mode === 'teach') return { ...current, explored: true };
  if (mode === 'revise' && current.explored && attemptedPractice) return { ...current, practised: true };
  return current;
}
export function reflectOnLearning(state: Momentum, reflection: string, day = localDay()): Momentum {
  const current = restoreMomentum(state, day);
  return current.practised && reflection.trim().length >= 20 ? { ...current, reflected: true } : current;
}
export function completedSteps(state: Momentum): number {
  return Number(state.explored) + Number(state.practised) + Number(state.reflected);
}

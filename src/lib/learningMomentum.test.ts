import test from 'node:test';
import assert from 'node:assert/strict';
import { completedSteps, freshMomentum, recordLearning, reflectOnLearning, restoreMomentum, localDay } from './learningMomentum';
const day = '2026-10-19';
test('daily goals require a successful explanation, own practice attempt, and a reflection', () => {
  const start = freshMomentum(day);
  assert.equal(completedSteps(recordLearning(start, 'teach', '  ', false, day)), 0);
  assert.equal(completedSteps(recordLearning(start, 'solve', 'An answer', true, day)), 0);
  assert.equal(completedSteps(recordLearning(start, 'revise', 'A question', true, day)), 0);
  const explored = recordLearning(start, 'teach', 'An explanation', false, day);
  assert.equal(completedSteps(explored), 1);
  assert.equal(recordLearning(explored, 'revise', 'A practice question', false, day).practised, false);
  const practised = recordLearning(explored, 'revise', 'Feedback on your attempt', true, day);
  assert.equal(completedSteps(practised), 2);
  assert.equal(reflectOnLearning(practised, 'Short', day).reflected, false);
  assert.equal(completedSteps(reflectOnLearning(practised, 'I learned how to add fractions with matching denominators.', day)), 3);
  assert.equal(reflectOnLearning(explored, 'A long reflection without practice must not complete the goal.', day).reflected, false);
});
test('repeat answers cannot inflate progress or create an endless goal', () => {
  const done = { day, explored: true, practised: true, reflected: true };
  assert.deepEqual(recordLearning(done, 'teach', 'More answers', false, day), done);
  assert.equal(completedSteps(done), 3);
});
test('day rollover starts a fresh goal and malformed storage is normalised', () => {
  const done = { day, explored: true, practised: true, reflected: true };
  assert.deepEqual(restoreMomentum(done, '2026-10-20'), freshMomentum('2026-10-20'));
  assert.deepEqual(restoreMomentum(null, day), freshMomentum(day));
  assert.deepEqual(restoreMomentum({ day, explored: 'true', practised: true, reflected: true }, day), freshMomentum(day));
  assert.deepEqual(restoreMomentum({ day, explored: true, practised: false, reflected: true }, day), { day, explored: true, practised: false, reflected: false });
});
test('calendar day follows the browser local calendar', () => {
  assert.equal(localDay(new Date(2026, 0, 2, 0, 5)), '2026-01-02');
});

/**
 * Protocol Assertion Helpers
 *
 * These functions verify that A2A protocol invariants are maintained.
 * Based on analysis of the Gemini A2A reference implementation.
 */

import { expect } from 'vitest';
import type { StreamEvent, StatusUpdateEvent, TaskState } from '@a2a-webcap/shared';

/**
 * Invariant 1 & 2: Task creation starts with 'submitted', immediately transitions to 'working'
 */
export function assertTaskCreationAndWorkingStatus(events: StreamEvent[]): void {
  expect(events.length).toBeGreaterThanOrEqual(2);

  const firstEvent = events[0];
  expect(firstEvent.type).toBe('status');
  if (firstEvent.type === 'status') {
    expect(firstEvent.status.state).toBe('submitted');
  }

  const secondEvent = events[1];
  expect(secondEvent.type).toBe('status');
  if (secondEvent.type === 'status') {
    expect(secondEvent.status.state).toBe('working');
  }
}

/**
 * Invariant 3 & 4: Exactly one final event, and it's always last
 */
export function assertUniqueFinalEventIsLast(events: StreamEvent[]): void {
  const finalEvents = events.filter(e => 'final' in e && e.final === true);

  expect(finalEvents.length).toBe(1);
  expect(events[events.length - 1]).toBe(finalEvents[0]);
}

/**
 * Invariant 5: Consistent ID propagation throughout all events
 */
export function assertConsistentIdPropagation(
  events: StreamEvent[],
  expectedTaskId: string,
  expectedContextId: string
): void {
  for (const event of events) {
    expect(event.taskId).toBe(expectedTaskId);
    expect(event.contextId).toBe(expectedContextId);
  }
}

/**
 * Assert all 5 core protocol invariants
 */
export function assertAllProtocolInvariants(
  events: StreamEvent[],
  taskId: string,
  contextId: string
): void {
  assertTaskCreationAndWorkingStatus(events);
  assertUniqueFinalEventIsLast(events);
  assertConsistentIdPropagation(events, taskId, contextId);
}

/**
 * Assert tool lifecycle progression
 * Verifies that tool execution follows the expected state transitions
 */
export function assertToolLifecycle(
  events: StreamEvent[],
  toolId: string,
  expectedStates: string[]
): void {
  const toolEvents = events.filter(e =>
    e.type === 'status' &&
    e.status.metadata?.toolId === toolId
  );

  expect(toolEvents.length).toBeGreaterThanOrEqual(expectedStates.length);

  for (let i = 0; i < expectedStates.length; i++) {
    const event = toolEvents[i];
    if (event.type === 'status') {
      expect(event.status.metadata?.toolState).toBe(expectedStates[i]);
    }
  }
}

/**
 * Assert task reaches a specific final state
 */
export function assertTaskFinalState(
  events: StreamEvent[],
  expectedState: TaskState
): void {
  const finalEvent = events.find(e => 'final' in e && e.final === true);

  expect(finalEvent).toBeDefined();
  expect(finalEvent!.type).toBe('status');

  if (finalEvent && finalEvent.type === 'status') {
    expect(finalEvent.status.state).toBe(expectedState);
  }
}

/**
 * Assert event ordering is chronological
 */
export function assertChronologicalOrdering(events: StreamEvent[]): void {
  for (let i = 1; i < events.length; i++) {
    const prevTimestamp = events[i - 1].type === 'status' ? events[i - 1].status.timestamp : undefined;
    const currTimestamp = events[i].type === 'status' ? events[i].status.timestamp : undefined;

    if (prevTimestamp && currTimestamp) {
      const prevTime = new Date(prevTimestamp).getTime();
      const currTime = new Date(currTimestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }
  }
}

/**
 * Assert artifact updates are valid
 */
export function assertValidArtifactUpdates(events: StreamEvent[]): void {
  const artifactEvents = events.filter(e => e.type === 'artifact');

  for (const event of artifactEvents) {
    if (event.type === 'artifact') {
      expect(event.artifact).toBeDefined();
      expect(event.artifact.artifactId).toBeDefined();
      expect(event.artifact.parts).toBeDefined();
      expect(Array.isArray(event.artifact.parts)).toBe(true);
    }
  }
}

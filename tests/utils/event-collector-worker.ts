/**
 * EventCollector - Test utility for collecting streaming events
 *
 * This utility collects events from streaming tasks for testing and assertions.
 * Workers-compatible version without capnweb dependencies.
 */

import type { StatusUpdateEvent, ArtifactUpdateEvent, StreamEvent } from '../../../shared/src/index';

export class EventCollector {
  public events: StreamEvent[] = [];
  private finalReceived = false;
  private resolveWaitForFinal?: () => void;
  private rejectWaitForFinal?: (error: Error) => void;

  constructor() {
    // No capnweb dependency needed for Workers
  }

  /**
   * Collect a streaming event
   */
  collect(event: StreamEvent): void {
    this.events.push(event);
    
    if (event.type === 'status' && event.final) {
      this.finalReceived = true;
      this.resolveWaitForFinal?.();
    }
  }

  /**
   * Get all collected events
   */
  getEvents(): StreamEvent[] {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType<T extends StreamEvent['type']>(type: T): Extract<StreamEvent, { type: T }>[] {
    return this.events.filter(event => event.type === type) as Extract<StreamEvent, { type: T }>[];
  }

  /**
   * Get status update events
   */
  getStatusEvents(): StatusUpdateEvent[] {
    return this.getEventsByType('status');
  }

  /**
   * Get artifact update events
   */
  getArtifactEvents(): ArtifactUpdateEvent[] {
    return this.getEventsByType('artifact');
  }

  /**
   * Check if a final event has been received
   */
  hasFinalEvent(): boolean {
    return this.finalReceived;
  }

  /**
   * Wait for a final event to be received
   */
  async waitForFinal(timeout = 5000): Promise<void> {
    if (this.finalReceived) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.resolveWaitForFinal = resolve;
      this.rejectWaitForFinal = reject;

      setTimeout(() => {
        this.rejectWaitForFinal?.(new Error(`Timeout waiting for final event after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Clear all collected events
   */
  clear(): void {
    this.events = [];
    this.finalReceived = false;
    this.resolveWaitForFinal = undefined;
    this.rejectWaitForFinal = undefined;
  }

  /**
   * Get the number of collected events
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Check if any events have been collected
   */
  hasEvents(): boolean {
    return this.events.length > 0;
  }

  /**
   * Get the last event
   */
  getLastEvent(): StreamEvent | undefined {
    return this.events[this.events.length - 1];
  }

  /**
   * Get the first event
   */
  getFirstEvent(): StreamEvent | undefined {
    return this.events[0];
  }
}
/**
 * EventCollector - Test utility for collecting streaming events
 *
 * This utility implements the TaskUpdateCallback interface to collect
 * events from streaming tasks for testing and assertions.
 */

import { RpcTarget } from 'capnweb';
import type { StatusUpdateEvent, ArtifactUpdateEvent, StreamEvent } from '@a2a-webcap/shared';

export class EventCollector extends RpcTarget {
  public events: StreamEvent[] = [];
  private finalReceived = false;
  private resolveWaitForFinal?: () => void;
  private rejectWaitForFinal?: (error: Error) => void;

  constructor() {
    super();
  }

  /**
   * Called when a status update event is received
   */
  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    this.events.push(event);
    if (event.final) {
      this.finalReceived = true;
      this.resolveWaitForFinal?.();
    }
  }

  /**
   * Called when an artifact update event is received
   */
  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    this.events.push(event);
  }

  /**
   * Wait for the final event to be received
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns Promise that resolves when final event is received
   * @throws Error if timeout is reached before final event
   */
  async waitForFinal(timeoutMs: number = 5000): Promise<void> {
    if (this.finalReceived) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.resolveWaitForFinal = resolve;
      this.rejectWaitForFinal = reject;

      const timeout = setTimeout(() => {
        this.rejectWaitForFinal?.(
          new Error(`Timeout: Final event not received within ${timeoutMs}ms`)
        );
      }, timeoutMs);

      // Clear timeout if resolved
      const originalResolve = this.resolveWaitForFinal;
      this.resolveWaitForFinal = () => {
        clearTimeout(timeout);
        originalResolve();
      };
    });
  }

  /**
   * Get all status update events
   */
  getStatusUpdates(): StatusUpdateEvent[] {
    return this.events.filter((e): e is StatusUpdateEvent => e.type === 'status');
  }

  /**
   * Get all artifact update events
   */
  getArtifactUpdates(): ArtifactUpdateEvent[] {
    return this.events.filter((e): e is ArtifactUpdateEvent => e.type === 'artifact');
  }

  /**
   * Get the final event (if received)
   */
  getFinalEvent(): StreamEvent | undefined {
    return this.events.find(e => 'final' in e && e.final);
  }

  /**
   * Reset the collector for reuse
   */
  reset(): void {
    this.events = [];
    this.finalReceived = false;
    this.resolveWaitForFinal = undefined;
    this.rejectWaitForFinal = undefined;
  }

  /**
   * Get event count
   */
  get eventCount(): number {
    return this.events.length;
  }

  /**
   * Check if final event has been received
   */
  get hasFinalEvent(): boolean {
    return this.finalReceived;
  }
}

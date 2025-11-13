/**
 * TaskUpdateCallback - RpcTarget for streaming task updates
 *
 * This interface defines the callback methods that clients can implement
 * to receive real-time updates about task progress. It's the core of
 * bidirectional communication in capnweb-based A2A.
 */

import { RpcTarget } from 'capnweb';
import type { StatusUpdateEvent, ArtifactUpdateEvent } from '@a2a-webcap/shared';

/**
 * TaskUpdateCallback interface for receiving task updates
 *
 * Clients implement this interface to receive push notifications
 * from the server about task state changes and artifact updates.
 *
 * In capnweb, this is passed as a capability reference, enabling
 * the server to call back to the client without webhooks.
 */
export abstract class TaskUpdateCallback extends RpcTarget {
  /**
   * Called when task status changes
   *
   * @param event - Status update event with task state, timestamp, etc.
   */
  abstract onStatusUpdate(event: StatusUpdateEvent): Promise<void>;

  /**
   * Called when an artifact is created or updated
   *
   * @param event - Artifact update event with artifact data
   */
  abstract onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
}

/**
 * Simple implementation for testing/examples
 */
export class LoggingCallback extends TaskUpdateCallback {
  constructor(private prefix: string = '[Callback]') {
    super();
  }

  async onStatusUpdate(event: StatusUpdateEvent): Promise<void> {
    console.log(`${this.prefix} Status Update:`, {
      taskId: event.taskId,
      state: event.status.state,
      final: event.final
    });
  }

  async onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void> {
    console.log(`${this.prefix} Artifact Update:`, {
      taskId: event.taskId,
      artifactId: event.artifact.artifactId,
      name: event.artifact.name
    });
  }
}

/**
 * TaskUpdateCallback - Interface for streaming task updates
 *
 * Clients implement this interface to receive push notifications
 * from the server about task state changes and artifact updates.
 */
import type { StatusUpdateEvent, ArtifactUpdateEvent } from '@a2a-webcap/shared';

export interface TaskUpdateCallback {
  onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
  onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
}

/**
 * Simple implementation for testing/examples
 */
export class LoggingCallback implements TaskUpdateCallback {
  constructor(private prefix: string = '[Callback]') {}

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

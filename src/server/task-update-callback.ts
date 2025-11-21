/**
 * TaskUpdateCallback - Interface for streaming task updates
 *
 * Clients implement this interface to receive push notifications
 * from the server about task state changes and artifact updates.
 */
import type { TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '../shared/a2a.types.ts';

export interface TaskUpdateCallback {
  onStatusUpdate(event: TaskStatusUpdateEvent): Promise<void>;
  onArtifactUpdate(event: TaskArtifactUpdateEvent): Promise<void>;
}

/**
 * Simple implementation for testing/examples
 */
export class LoggingCallback implements TaskUpdateCallback {
  constructor(private prefix: string = '[Callback]') {}

  async onStatusUpdate(event: TaskStatusUpdateEvent): Promise<void> {
    console.log(`${this.prefix} Status Update:`, {
      taskId: event.taskId,
      state: event.status.state,
      final: event.final
    });
  }

  async onArtifactUpdate(event: TaskArtifactUpdateEvent): Promise<void> {
    console.log(`${this.prefix} Artifact Update:`, {
      taskId: event.taskId,
      artifactId: event.artifact.artifactId,
      name: event.artifact.name
    });
  }
}

import { RpcTarget } from 'capnweb';

type StatusUpdateEvent = any;
type ArtifactUpdateEvent = any;

abstract class TaskUpdateCallback extends RpcTarget {
  abstract onStatusUpdate(event: StatusUpdateEvent): Promise<void>;
  abstract onArtifactUpdate(event: ArtifactUpdateEvent): Promise<void>;
}
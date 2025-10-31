import { RpcTarget } from 'capnweb';

type TaskManager = any;
type Message = any;
type MessageSendConfig = any;
type Task = any;

class AuthenticatedA2AService extends RpcTarget {
  constructor(
    private taskManager: TaskManager,
    private userId: string,
    private permissions: string[]
  ) {
    super();
  }

  async sendMessage(message: Message, config?: MessageSendConfig): Promise<Task | Message> {
    // All operations automatically have user context
    return await this.taskManager.createTask(message, config, this.userId);
  }

  async getTask(taskId: string): Promise<Task> {
    // Automatically filtered to user's tasks
    return await this.taskManager.getTask(taskId, undefined, this.userId);
  }
}
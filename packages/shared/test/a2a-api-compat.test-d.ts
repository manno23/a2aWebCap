import type {
  MessageSendParams,
  TaskQueryParams,
  // ...other official types
} from '@a2aproject/a2a-types';
import type { A2AService } from '../src/a2a-service';

// Example: ensure sendMessage uses official MessageSendParams
type _CheckSendMessageParams = Parameters<A2AService['sendMessage']>[0] extends MessageSendParams
  ? true
  : never;

// If this ever becomes `never`, typechecking will fail, revealing drift.
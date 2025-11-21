const crypto = globalThis.crypto;

export async function createMockWorkerEnv() {
  // Mock crypto
export async function createMockWorkerEnv() {
  // Mock durable objects and KV (basic implementations)
  const TASK_MANAGER_DO = {
    id: crypto.randomUUID(),
    fetch: async () => new Response('OK')
  } as any;
  
  const SESSION_MANAGER_DO = {
    id: crypto.randomUUID(),
    fetch: async () => new Response('OK')
  } as any;

  return {
    globalScope: globalThis as any,
    TASK_MANAGER: TASK_MANAGER_DO,
    SESSION_MANAGER: SESSION_MANAGER_DO,
  };
}
  
  // Mock durable objects and KV (basic implementations)
  const TASK_MANAGER_DO = {
    id: crypto.randomUUID(),
    fetch: async () => new Response('OK')
  } as any;
  
  const SESSION_MANAGER_DO = {
    id: crypto.randomUUID(),
    fetch: async () => new Response('OK')
  } as any;

  return {
    globalScope: globalThis as any,
    TASK_MANAGER: TASK_MANAGER_DO,
    SESSION_MANAGER: SESSION_MANAGER_DO,
    // Add other bindings as needed
  };
}

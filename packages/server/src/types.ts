
import { AgentCapabilities, McpServer } from "@a2a-webcap/shared"


// Mock interfaces for non-existent dependencies
export interface MockSessionManager {
  get(sessionId: string): any
  create(cwd: string, mcpServers: any[], model?: any): Promise<any>
  setModel(sessionId: string, model: any): void
  setMode(sessionId: string, modeId: string): void
}

export interface MockProvider {
  list(): Promise<any>
  parseModel(modelId: string): any
  getModel(providerId: string, modelId: string): Promise<any>
  defaultModel(): Promise<any>
  sort(models: any[]): any[]
}

export interface MockCommand {
  list(): Promise<any[]>
  get(name: string): Promise<any>
}

export interface MockAgents {
  list(): Promise<any[]>
  get(name: string): Promise<any>
}

export interface MockSession {
  initialize(args: any): Promise<void>
  remove(sessionId: string): Promise<void>
}

export interface MockSessionPrompt {
  prompt(args: any): Promise<void>
  command(args: any): Promise<void>
}

export interface MockSessionLock {
  abort(sessionId: string): void
}

export interface MockSessionCompaction {
  run(args: any): Promise<void>
}

export interface MockIdentifier {
  ascending(type: string): string
}

export interface MockMCP {
  add(key: string, mcp: any): Promise<void>
}

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model: {
    providerID: string
    modelID: string
  }
  modeId?: string
}

export interface ACPConfig {
  defaultModel?: {
    providerID: string
    modelID: string
  }
}

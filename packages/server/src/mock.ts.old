// Minimal runtime mocks for server implementation

export const MockProvider = {
  list: async () => {
    return {
      local: {
        info: {
          name: "Local",
          models: {
            small: { id: "small", name: "small" },
            large: { id: "large", name: "large" },
          },
        },
      },
      remote: {
        info: {
          name: "Remote",
          models: {
            r1: { id: "r1", name: "r1" },
          },
        },
      },
    }
  },

  parseModel: (modelId: any) => {
    if (!modelId || typeof modelId !== "string") return { providerID: "local", modelID: "small" }
    const parts = modelId.split("/")
    if (parts.length === 1) return { providerID: "local", modelID: parts[0] }
    return { providerID: parts[0], modelID: parts.slice(1).join("/") }
  },

  getModel: async (providerId: string, modelId: string) => {
    const providers = await MockProvider.list()
    const provider = (providers as any)[providerId]
    if (!provider) return { providerID: providerId, modelID: modelId }
    const model = provider.info.models[modelId]
    if (!model) return { providerID: providerId, modelID: modelId }
    return { providerID: providerId, modelID: model.id, name: model.name }
  },

  defaultModel: async () => {
    return { providerID: "local", modelID: "small" }
  },

  sort: (models: any[]) => {
    if (!Array.isArray(models)) return models
    return models.slice().sort((a, b) => {
      const na = ((a && (a.name || a.id)) || "").toLowerCase()
      const nb = ((b && (b.name || b.id)) || "").toLowerCase()
      if (na < nb) return -1
      if (na > nb) return 1
      return 0
    })
  },
}

export const MockCommand = {
  list: async () => [
    { name: "init", description: "create/update a AGENTS.md" },
    { name: "compact", description: "compact the session" },
  ],
  get: async (name: string) => {
    const all = await MockCommand.list()
    return all.find((c) => c.name === name) || null
  },
}

export const MockAgents = {
  list: async () => [
    { name: "build", description: "Build agent", mode: "primary" },
    { name: "chat", description: "Chat agent", mode: "primary" },
  ],
  get: async (name: string) => {
    const all = await MockAgents.list()
    return all.find((a) => a.name === name) || null
  },
}

export const MockSession = {
  initialize: async (_args: any) => {},
  remove: async (_sessionId: string) => {},
}

export const MockSessionPrompt = {
  prompt: async (_args: any) => {},
  command: async (_args: any) => {},
}

export const MockSessionLock = {
  abort: (_sessionId: string) => {},
}

export const MockSessionCompaction = {
  run: async (_args: any) => {},
}

export const MockIdentifier = {
  ascending: (_type: string) => `id-${Math.floor(Math.random() * 1000000)}`,
}

export const MockMCP = {
  add: async (_key: string, _mcp: any) => {},
}

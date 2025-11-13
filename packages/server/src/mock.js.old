// Minimal runtime mock implementation for providers used by src/index.ts
export const MockProvider = {
  // Return a mapping of providerID -> provider data
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

  // Parse a model identifier like "provider/model" or just "model"
  parseModel: (modelId) => {
    if (!modelId || typeof modelId !== "string") return { providerID: "local", modelID: "small" }
    const parts = modelId.split("/")
    if (parts.length === 1) return { providerID: "local", modelID: parts[0] }
    return { providerID: parts[0], modelID: parts.slice(1).join("/") }
  },

  // Get a model object given provider and model ids
  getModel: async (providerId, modelId) => {
    const providers = await MockProvider.list()
    const provider = providers[providerId]
    if (!provider) return { providerID: providerId, modelID: modelId }
    const model = provider.info.models[modelId]
    if (!model) return { providerID: providerId, modelID: modelId }
    return { providerID: providerId, modelID: model.id, name: model.name }
  },

  // Return a default model (provider + model)
  defaultModel: async () => {
    // Return the 'local/small' default
    return { providerID: "local", modelID: "small" }
  },

  // Sort an array of model objects by name
  sort: (models) => {
    if (!Array.isArray(models)) return models
    return models.slice().sort((a, b) => {
      const na = (a && (a.name || a.id) || "").toLowerCase()
      const nb = (b && (b.name || b.id) || "").toLowerCase()
      if (na < nb) return -1
      if (na > nb) return 1
      return 0
    })
  },
}

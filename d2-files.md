You’re poking exactly where it hurts: “I want diagrams, not vibes.” Love it.

Short caveat before we dive in: GitHub’s HTML view for `adk-js` is annoyingly opaque to me right now, so I can’t see the raw TypeScript directly. I *can* see the docs and the Python/Java APIs, and the JS Readme explicitly says it has “Same Features & Familiar Interface As Other ADKs”([GitHub][1]), so the primitives and relationships I’ll diagram are based on those. Think of these as 95% accurate structurally, with field names you can easily align to the actual TS types.

I’ll give you:

* A **C4-ish architecture view** (Structurizr DSL).
* A **module/component view** (Graphviz).
* A **core type/class model** (PlantUML).
* A **runtime sequence** (PlantUML).
* A **type-composition view** for the key generics/configs (D2).

All of these are pure text; all renderable with free/open tools; none of them use Mermaid.

---

## 1. High-level architecture (C4/Structurizr DSL)

This gives you a system view: where `adk-js` sits between your app, the LLM, and tools.

You can render this using the free Structurizr DSL editor or CLI.

```dsl
workspace "ADK-JS Overview" "High-level architecture of the TypeScript Agent Development Kit" {

  model {
    user = person "End User" "Interacts with the application UI"

    dev  = person "Developer" "Builds agents using ADK-JS"

    system app "Your App" "Node/TS or browser app that embeds @google/adk" {
      container ui "Frontend UI" "React/Vue/etc" "Collects user input, displays responses"
      container backend "Backend Service" "Node.js + @google/adk" "Hosts agents & orchestrates workflows"
      container devui "ADK Web Dev UI" "ADK Web" "Interactive dev/debug UI for agents"
    }

    container adk "ADK-JS Core" "npm: @google/adk" "Agent Development Kit for TypeScript" {
      component agents "Agents" "LlmAgent, BaseAgent, Sequential/Parallel/Loop, custom agents"
      component tools "Tools" "FunctionTool, AgentTool, built-ins (e.g. GOOGLE_SEARCH)"
      component runners "Runners & Sessions" "Runner, Session/SessionService, State"
      component events "Events" "Event, EventActions, history"
      component context "Context" "InvocationContext, ToolContext"
      component models "Model Abstractions" "Wrappers for Gemini & other LLMs"
    }

    system_ext gemini "Gemini / Other LLM" "Vertex AI / external LLMs"
    system_ext apis "External Services / APIs" "REST/OpenAPI, DBs, etc."

    ' Relationships
    user -> ui "Sends messages"
    ui -> backend "HTTP/WebSocket RPC"
    backend -> adk "Uses @google/adk to run agents"

    dev -> adk "Defines agents, tools, runners in TypeScript"
    dev -> devui "Uses for debugging & evaluation"

    agents -> models "Specify model or model name"
    agents -> tools "Invoke tools"
    agents -> events "Emit events"
    agents -> context "Use contextual info (state, artifacts, etc.)"
    tools -> apis "Call external services"
    models -> gemini "Call LLM APIs"

    runners -> agents "Run agents for each turn"
    runners -> events "Persist & stream events"
    runners -> context "Constructs InvocationContext"
  }

  views {
    systemLandscape "landscape" {
      include *
      autoLayout
    }
  }
}
```

That’s the “where does this thing live in the universe” view.

---

## 2. Module/component structure (Graphviz / DOT)

Now a module-level view: how the main subsystems depend on each other. Render with `dot -Tpng` or any of the many online Graphviz renderers.

```dot
digraph ADK_JS_Modules {
  rankdir=LR;
  node [shape=rectangle];

  subgraph cluster_core {
    label = "adk-js core";
    style = rounded;

    agents      [label="agents\n(LlmAgent, BaseAgent,\nSequential, Parallel, Loop, Custom)"];
    tools       [label="tools\n(FunctionTool, AgentTool,\nBuilt-in tools)"];
    runners     [label="runners & sessions\n(Runner, SessionService,\nSession, State)"];
    events      [label="events\n(Event, EventActions)"];
    context     [label="context\n(InvocationContext,\nToolContext)"];
    models      [label="models\n(Gemini, LiteLLM, etc.)"];
  }

  app      [label="Your App\n(backend/frontend)", shape=component];
  dev_ui   [label="ADK Web Dev UI", shape=component];
  llm      [label="LLM Backends\n(Gemini, others)", shape=component];
  ext_apis [label="External APIs / Services", shape=component];

  app -> agents [label="imports @google/adk\nand defines agents"];
  app -> runners [label="creates Runner\nand SessionService"];

  runners -> agents   [label="run(agent, input)"];
  runners -> events   [label="append/read events"];
  runners -> context  [label="build InvocationContext"];

  agents -> models    [label="call LLM"];
  agents -> tools     [label="invoke tools"];
  agents -> events    [label="emit events"];
  agents -> context   [label="read state, artifacts"];

  tools  -> ext_apis  [label="HTTP, DB, etc."];
  models -> llm       [label="LLM API calls"];

  dev_ui -> runners   [label="inspect & replay runs"];
  dev_ui -> events    [label="visualize trace"];
}
```

This matches the docs: ADK provides agents, tools, events, runners, sessions, context and integrates with models & tools for multi-agent systems.([Google GitHub][2])

---

## 3. Core types / classes (PlantUML class diagram)

Now the meat: approximate TS/OO model of the “important types that compose everything together”.

Render via PlantUML (CLI, VS Code plugin, IntelliJ plugin, or plantuml.com).

```plantuml
@startuml
title ADK-JS Core Types (approximate)

skinparam classAttributeIconSize 0

package "agents" {
  abstract class BaseAgent {
    - name: string
    - description?: string
    - instruction?: string
    - model: string | Model
    - tools: Tool[]
    - subAgents: BaseAgent[]
    + run(input: AgentInput, ctx: InvocationContext): Promise<AgentOutput>
  }

  class LlmAgent extends BaseAgent {
    - globalInstruction?: string
    - inputSchema?: Schema
    - outputSchema?: Schema
    + run(...): Promise<AgentOutput>
  }

  abstract class WorkflowAgent extends BaseAgent {
    - children: BaseAgent[]
  }

  class SequentialAgent extends WorkflowAgent
  class ParallelAgent   extends WorkflowAgent
  class LoopAgent       extends WorkflowAgent {
    - maxIterations?: number
    - stopCondition?: LoopCondition
  }

  class CustomAgent extends BaseAgent {
    + _runImpl(ctx: InvocationContext): AsyncIterable<Event>
  }
}

package "tools" {
  interface Tool {
    + name: string
    + description?: string
    + schema?: Schema
    + invoke(input: unknown, ctx: ToolContext): Promise<unknown>
  }

  class FunctionTool implements Tool {
    - fn: (input: any, ctx: ToolContext) => Promise<any> | any
  }

  class AgentTool implements Tool {
    - agent: BaseAgent
  }

  class GoogleSearchTool implements Tool
}

package "models" {
  interface Model {
    + name: string
    + call(prompt: Content, options: ModelOptions): Promise<ModelResponse>
  }
}

package "runners & sessions" {
  class Runner {
    - sessionService: SessionService
    + runTurn(agent: BaseAgent, userId: string, content: Content): AsyncIterable<Event>
  }

  interface SessionService {
    + load(sessionId: string): Promise<Session>
    + appendEvent(session: Session, event: Event): Promise<void>
  }

  class InMemorySessionService implements SessionService {
    - sessions: Map<string, Session>
  }

  class Session {
    + id: string
    + state: Record<string, any>
    + events: Event[]
  }
}

package "events & context" {
  class Event {
    + id: string
    + invocationId: string
    + author: "user" | "agent" | "tool" | "system"
    + message?: Content
    + actions?: EventActions
    + timestamp: number
  }

  class EventActions {
    + stateDelta?: Record<string, any>
    + control?: ControlSignal
    + toolCall?: ToolCall
    + toolResult?: ToolResult
  }

  class InvocationContext {
    + session: Session
    + events: Event[]
    + userId?: string
  }

  class ToolContext {
    + invocation: InvocationContext
    + toolName: string
  }
}

' Relationships
BaseAgent "0..*" o-- Tool : uses
BaseAgent "0..*" o-- BaseAgent : subAgents

Runner "1" o-- SessionService
SessionService "1" o-- Session
Session "1..*" o-- Event
Event "1" o-- EventActions

LlmAgent ..> Model
FunctionTool ..> ToolContext
AgentTool ..> BaseAgent
InvocationContext ..> Session
ToolContext ..> InvocationContext

@enduml
```

This is a direct mapping of the documented primitives:

* `LlmAgent`, workflow agents, and custom agents inherit from `BaseAgent`.([Google GitHub][3])
* Tools include built-in tools and `AgentTool` to wrap an agent as a tool.([Google GitHub][4])
* Execution is driven by a `Runner` plus a `SessionService`, with `Event`/`EventActions` carrying state deltas and control signals.([Google GitHub][5])

Adjust method names and fields to match the actual TypeScript definitions once you’re in the codebase, but this diagram is aligned with the conceptual model.

---

## 4. One-turn execution flow (PlantUML sequence)

This diagram shows the “life of a user message” through ADK-JS: Runner → Agent → LLM & tools → Events.

```plantuml
@startuml
title ADK-JS: Single Turn Execution Flow

actor User
participant "Your App" as App
participant "Runner" as Runner
participant "SessionService" as Sess
participant "LlmAgent" as Agent
participant "Model" as Model
participant "Tool (e.g. FunctionTool)" as Tool
participant "EventStore\n(within Session)" as Events

User -> App: Send message
App -> Runner: runTurn(agent, userId, content)

activate Runner
Runner -> Sess: load(sessionId)
Sess --> Runner: Session

Runner -> Runner: build InvocationContext\n(events, state, userId)
Runner -> Agent: run(input, ctx)
activate Agent

Agent -> Model: call(prompt, options)
activate Model
Model --> Agent: model response (tool calls, text)
deactivate Model

Agent -> Tool: invoke(toolInput, toolCtx)
activate Tool
Tool -> Tool: call external API/DB/etc.
Tool --> Agent: toolResult
deactivate Tool

Agent -> Agent: decide next step\n(maybe more tools or finalize)
Agent --> Runner: stream Events\n(user, tool_call, tool_result, agent_reply)
deactivate Agent

loop for each Event
  Runner -> Sess: appendEvent(session, event)
  Sess --> Runner: ack
  Runner -> Events: store in session history
end

Runner --> App: stream agent events / final reply
deactivate Runner

App -> User: render final reply\n(and optional trace)
@enduml
```

Conceptually this matches ADK’s description of agents producing `Event` streams with `EventActions` that update session state and drive the workflow.([Google GitHub][5])

---

## 5. Module/type graph in D2 (good for config & types)

D2 is a modern text-to-diagram language with a nice CLI and a free online playground. Here’s a focused type-composition view around configs and schemas (the “formal types” angle):

```d2
direction: right

AgentConfig: {
  shape: class
  label: |md
    **AgentConfig<I, O>**
    - name: string
    - description?: string
    - model: string | Model
    - instruction?: string
    - tools?: Tool[]
    - subAgents?: BaseAgent[]
    - inputSchema?: Schema<I>
    - outputSchema?: Schema<O>
  md|
}

RunConfig: {
  shape: class
  label: |md
    **RunConfig**
    - userId: string
    - sessionId?: string
    - metadata?: Record<string, any>
  md|
}

BaseAgent: {
  shape: class
  label: |md
    **BaseAgent<I, O>**
    - config: AgentConfig<I, O>
    + run(input: I, ctx: InvocationContext): Promise<O>
  md|
}

LlmAgent: {
  shape: class
  label: |md
    **LlmAgent<I, O>**
    extends BaseAgent<I, O>
    - globalInstruction?: string
  md|
}

Tool: {
  shape: interface
  label: |md
    **Tool<I, O>**
    - name: string
    - description?: string
    - schema?: Schema<I>
    + invoke(input: I, ctx: ToolContext): Promise<O>
  md|
}

FunctionTool: {
  shape: class
  label: |md
    **FunctionTool<I, O>**
    implements Tool<I, O>
    - fn: (input: I, ctx: ToolContext) => Promise<O> | O
  md|
}

AgentTool: {
  shape: class
  label: |md
    **AgentTool<I, O>**
    implements Tool<I, O>
    - agent: BaseAgent<I, O>
  md|
}

Session: {
  shape: class
  label: |md
    **Session**
    - id: string
    - state: Record<string, any>
    - events: Event[]
  md|
}

Event: {
  shape: class
  label: |md
    **Event**
    - id: string
    - invocationId: string
    - author: Author
    - message?: Content
    - actions?: EventActions
  md|
}

InvocationContext: {
  shape: class
  label: |md
    **InvocationContext**
    - session: Session
    - events: Event[]
    - runConfig: RunConfig
  md|
}

ToolContext: {
  shape: class
  label: |md
    **ToolContext**
    - invocation: InvocationContext
    - toolName: string
  md|
}

Model: {
  shape: interface
  label: |md
    **Model**
    - name: string
    + call(input: Content, options: ModelOptions): Promise<ModelResponse>
  md|
}

AgentConfig -> BaseAgent: "config used to construct"
BaseAgent -> LlmAgent: "extends" direction: right
BaseAgent -> Tool: "uses *"
LlmAgent -> Model: "calls"
AgentTool -> BaseAgent: "wraps"
FunctionTool -> Tool: "implements" direction: right
AgentTool -> Tool: "implements" direction: right

InvocationContext -> Session: "includes"
InvocationContext -> Event: "references history"
ToolContext -> InvocationContext: "wraps"
Session -> Event: "0..* events"
```

You can tweak generics and exact field names after you inspect the actual TS library, but this is a “formal type graph” that matches the ADK’s conceptual API.

---

## 6. Package dependency graph (Graphviz) – if you want more literal mapping

If you end up with these approximate directories in `core/` (likely, given the Python structure), here’s a DOT graph you can adapt to the real paths:

```dot
digraph ADK_JS_Packages {
  rankdir=TB;
  node [shape=box];

  "core/agents"          [label="core/agents"];
  "core/tools"           [label="core/tools"];
  "core/models"          [label="core/models"];
  "core/events"          [label="core/events"];
  "core/sessions"        [label="core/sessions"];
  "core/runners"         [label="core/runners"];
  "core/context"         [label="core/context"];
  "core/artifacts"       [label="core/artifacts (optional)"];
  "core/utils"           [label="core/utils"];

  "core/agents"   -> "core/tools";
  "core/agents"   -> "core/models";
  "core/agents"   -> "core/context";
  "core/agents"   -> "core/events";

  "core/runners"  -> "core/agents";
  "core/runners"  -> "core/sessions";
  "core/runners"  -> "core/events";
  "core/runners"  -> "core/context";

  "core/sessions" -> "core/events";
  "core/sessions" -> "core/artifacts";

  "core/tools"    -> "core/context";
  "core/tools"    -> "core/artifacts";

  "core/models"   -> "core/utils";

  "core/events"   -> "core/utils";
  "core/context"  -> "core/sessions";
}
```

You can auto-generate something similar later by scanning imports and feeding them into Graphviz, but this gives you the intended directionality: agents depend on tools/models/events/context, runners depend on everything orchestration-related, sessions tie to events/artifacts.

---

## How to actually use this

If you want to turn this into a proper “living architecture”:

* Keep the **PlantUML class & sequence diagrams** in `docs/architecture/` and regenerate PNG/SVGs via CI.
* Use the **D2 type map** as your source-of-truth for public config types; keep it synced with the TS `*.d.ts` using a small script later.
* Use the **Structurizr DSL** as your C4 model and share it with teammates as the onboarding map.

The next nice step is to wire a tiny script that introspects the actual TS types (or `.d.ts`) and auto-generates pieces of these diagrams so they never rot. That’s where your future-self thanks your present-self.

[1]: https://github.com/google/adk-js "GitHub - google/adk-js"
[2]: https://google.github.io/adk-docs/?utm_source=chatgpt.com "Agent Development Kit - Google"
[3]: https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/?utm_source=chatgpt.com "Loop agents - Agent Development Kit - Google"
[4]: https://google.github.io/adk-docs/tools/built-in-tools/?utm_source=chatgpt.com "Built-in tools - Agent Development Kit - Google"
[5]: https://google.github.io/adk-docs/events/?utm_source=chatgpt.com "Events - Agent Development Kit - Google"


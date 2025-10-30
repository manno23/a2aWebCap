Create an AGENTS.md and README.md, based on the information in @docs/DESIGN-PROMPT.md  , opencode best practices, and the following included information:

Can you build out the project basis,
- using bun as the build and runtime of server application,
(either in an isolated env or global however is best for bun)
- and uv pip for the python stuff (also in a venv if that makes
- the prject should have configuration for linters, binary build and run scripts, cleanup scripts , gitignore,
- and a minimal viable project that builds, extending the sdk libraries described below.

Server implementation we will extend: typescript acp sdk  
  (I know the typescript sdk doesnt have, but sst/opencode github uses that for their server implementation)
  I want to extend the acp implementation done in the opencode cli management

Client side, will use the python sdk as it maybe easier to instrument for testing and experiment
  I want to use this client library for a neovim plugin to communicate with acp wrapped agents

# Project instructions

Global rules live in `~/.agents/AGENTS.md`; read them before work and external actions.

- Connector code belongs in `connectors/<service>/`; shared execution policy belongs in `packages/core/`.
- Keep connection settings, account identifiers, credentials and provider responses out of the repository.
- Run `npm test` before committing behavior changes. Use isolated HTTP/MCP fixtures for integration tests.
- Add write or send tools only with distinct runtime permissions and explicit product authorization.
- Documentation is written in English. Do not copy private service configuration into examples.

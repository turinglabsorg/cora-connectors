# Architecture

A connector is reusable service code. A connection is a private host-owned configuration binding that code to an account, authentication context and permission set. The public repository includes no user connections.

`connectors/` contains Milo's HTTP integration and an Airtable MCP client. `packages/core/` contains connection validation, read authorization, a bounded JSON reader and an untrusted-data envelope. `packages/mcp/` exposes the same capabilities through the official SDK's stdio transport. Provider functions can also be imported directly by Cora; no model SDK is required.

The first release intentionally has no database, secret vault, OAuth broker, scheduling or agent identity service. The host supplies those. Public OAuth onboarding can be added once the Cora host contract is known. Airtable accepts host-supplied bearer credentials; the CLI prototype supports PATs and does not perform refresh or registration.

Milo uses `account=ID` on `/api/messages`; `account_id` is not a valid search filter. Unknown configured accounts are rejected before search. Every result is checked against the configured account, including single-message reads. Account validation uses `/api/state` without exposing its contents to agents. Attachments are metadata only.

Tools are isolated by connection-prefixed names. A process can expose multiple connections intentionally, so process configuration must itself be restricted per owner or agent. This repository is not yet wired into Cora's runtime or user interface.

## Sources

- [Cursor MCP](https://cursor.com/docs/mcp)
- [xAI remote MCP](https://docs.x.ai/developers/tools/remote-mcp)
- [Airtable MCP overview and authentication](https://airtable.com/developers/agents/mcp/getting-started)
- [Airtable tool catalog](https://airtable.com/developers/agents/mcp/tools)
- [MCP server SDK guide](https://modelcontextprotocol.io/docs/develop/build-server)
- [Milo source](https://github.com/turinglabsorg/milo)

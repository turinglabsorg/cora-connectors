# Verification

Initial prototype verified on 2026-10-26.

- 18 integration tests passed with Node.js 22: Milo over HTTP, Airtable-compatible MCP over HTTP, MCP tool discovery/calls and a real stdio subprocess.
- Two nonempty accounts on an existing private Milo deployment passed live isolation checks from another tailnet machine. Search and individual reads stayed within their configured account.
- Cross-account message reading was rejected by the connector.
- A randomly generated nonexistent account was rejected before connector search; a direct upstream search with `account=ID` returned an empty message list.
- Dependency audit reported no known vulnerabilities at verification time.

Airtable's production endpoint has not been tested with a dedicated Cora credential. The HTTP MCP fixture verifies protocol behavior, read-tool filtering and mutation denial; it does not prove the provider accepts a specific user's token or scopes.

The repository is a runnable prototype. Cora runtime installation, end-user OAuth onboarding, write/send tools and attachment content extraction are not implemented. Milo search returns the service's bounded conversation list, with no additional pagination implementation.

Repeat `npm test` and the opt-in live script documented in the README when changing connector behavior. Never store live account identifiers or service responses in test artifacts.

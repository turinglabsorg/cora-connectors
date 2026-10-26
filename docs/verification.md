# Verification

Initial prototype verified on 2026-10-26.

- 21 integration tests passed with Node.js 22: Milo over HTTP, Airtable-compatible MCP over HTTP, MCP tool discovery/calls and a real stdio subprocess.
- Two nonempty accounts on an existing private Milo deployment passed live isolation checks from another tailnet machine. Search and individual reads stayed within their configured account.
- Cross-account message reading was rejected by the connector.
- A randomly generated nonexistent account was rejected before connector search; a direct upstream search with `account=ID` returned an empty message list.
- Dependency audit reported no known vulnerabilities at verification time.

Airtable's production MCP endpoint passed live validation on 2026-10-26 with a dedicated Cora PAT scoped to one disposable test base. Record creation, targeted read, update, read-back and deletion succeeded. The deleted test record's absence was verified. A read-only connection hid mutation tools and rejected an update; a subsequent read verified the record was unchanged. No customer records were modified.

HTTP MCP fixtures verify separate read-only, write-only and combined permissions through the exposed MCP server, matching tool annotations, record state changes, rejected unauthorized calls and unknown-tool denial.

The repository is a runnable prototype. Cora runtime installation, end-user OAuth onboarding, email send tools, schema mutation tools and attachment content extraction are not implemented. Milo search returns the service's bounded conversation list, with no additional pagination implementation.

Repeat `npm test` and the opt-in live script documented in the README when changing connector behavior. Never store live account identifiers or service responses in test artifacts.

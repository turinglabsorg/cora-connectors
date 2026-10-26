# Milo

Provides email metadata search and message reading, using Milo's existing authenticated private HTTP API. One connection is bound to one account. Search passes `account=ID` and checks every result; unknown accounts and cross-account messages are rejected. No sending, mailbox changes, sync triggers or attachment downloads are exposed.

Configure `url`, `accountId` and `permissions: ["read"]`. The service URL must be an HTTPS origin, or HTTP loopback for a local service/test. If Milo authorizes your Tailscale identity, no separate credential is needed. Otherwise set `secretEnv` to the name of an environment variable containing a valid Milo session cookie. Password login and session acquisition are host responsibilities. Do not forge trusted proxy identity headers.

Call `createMilo(connection)` from `index.js`, then `search({ search, view })` or `read({ messageId })`. Reads return an untrusted envelope. HTML remains a string. Source endpoint behavior may cache parsed content internally; this connector does not change mailbox state.

# Patch notes — privacy and save reliability

This patch closes gaps in the previous draft and must be deployed together with the API and D1 migration.

- Added an explicit `SAEE_AUTH_HEADERS_TRUSTED=true` deployment gate. Leave it unset unless the hosting platform replaces/strips user-supplied `oai-authenticated-*` headers and derives them from its verified sign-in. A generic public Worker must not set this flag based on headers alone.
- API validates the server-derived identity and never accepts owner IDs from request bodies/query strings. Every SQL read/write/delete is scoped to that identity.
- Client never persists passport data in localStorage/sessionStorage. Legacy local data is cleared only after a real 401 or a valid authenticated API response, not on 404/503.
- Save operations are serialized/coalesced; the page warns before leaving with unconfirmed edits. A failed save freezes editing and offers a JSON recovery download. Transient failures can be retried; 409 conflicts require export/reload rather than blind overwrite.
- Auth expiry clears the visible state to prevent exposing a previous user's information on a shared browser. This intentionally prioritizes privacy over retaining an unsaved draft when the server explicitly rejects the session.
- Account-based storage and saving will not work until the API route is deployed in the trusted hosted runtime and the D1 migration is applied.

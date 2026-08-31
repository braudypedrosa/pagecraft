# Pagecraft integrations

Pagecraft Cloud exposes one read-only integration contract for WordPress and MCP clients.

## Access tokens

Signed-in customers can create and revoke personal access tokens from Account settings →
Integrations. A token is shown once and can be used with the catalog, package, connection, and
MCP endpoints. Tokens are stored only as SHA-256 digests and are limited to read-only scopes.

`GET /v1/integrations/connection` checks a bearer token without changing any project data.

## Discovery

`GET /.well-known/pagecraft-integrations` returns the current authorization, token,
revocation, catalog, package, and MCP endpoints. Clients should use these endpoints rather
than constructing URLs from the legacy `/v1/wordpress-import` namespace.

## WordPress

WordPress connects through the authorization-code flow with PKCE. The issued credential can
read projects and download project or page packages owned by the signed-in account. Imports
remain manual and create independent WordPress copies; Pagecraft Cloud does not update them in
the background.

The canonical routes live under `/v1/integrations/wordpress`. The previous
`/v1/wordpress-import` routes remain compatibility aliases for older plugin versions.

## MCP

`POST /mcp` serves Streamable HTTP and accepts the same Pagecraft integration bearer token.
It exposes three read-only tools:

- `pagecraft_list_projects`
- `pagecraft_list_pages`
- `pagecraft_get_page`

All reads are scoped to the account that approved the credential. MCP clients do not receive
package-write, publish, synchronization, or deletion access.

MCP accepts either a personal access token or the short-lived access token issued to WordPress.
Interactive OAuth and dynamic client registration for third-party MCP hosts remain separate
future work.

# VibeGhost Lite

A standalone browser client for a VibeGhost on another machine. Copied from Oathkeeper's VibeGhost v2 mini-app: workspace sidebar/tree, session management, terminal, agent conversation, inspector, tabs and timeline. No server-side proxy. REST calls go straight from your browser to the VibeGhost you select.

## Run

Node 22.22+:

```sh
npm install
npm run dev
```

`npm run build` produces a static export in `out/`. Serve that directory on HTTPS. Client navigation uses hash paths, so deep links need no server rewrite. On this development machine dependencies are symlinked to Oathkeeper to avoid another install; that symlink is not committed. Normal installations install their own dependencies.

## Configure VibeGhost

Requires the `feat/vibeghost-lite` VibeGhost branch (API commit `44ea848`, or later). An unmodified VibeGhost does not have the required endpoints.

1. Set a dashboard password in VibeGhost.
2. In VibeGhost Settings → Protection, verify your existing password. Under **VibeGhost Lite**, add the exact origins you will use, one per line (scheme, hostname and optional port; no slash/path). Save Lite origins. Never add an origin you do not trust with terminal credentials.
3. Open Lite, enter that VibeGhost's HTTPS origin, and sign in with its existing dashboard password and optional username.
4. Your browser must reach the host itself. For a private Tailscale host, join the same tailnet. Hosting Lite on Railway does not make Railway a proxy into the tailnet.

Only HTTPS hosts are accepted, except literal Tailscale IPv4 addresses in `100.64.0.0/10`, which may use HTTP. An HTTPS page's browser may still block HTTP mixed content. Prefer Tailscale Serve HTTPS. Unprotected hosts are refused.

## Credentials and transport

- Password is transient and is never persisted by Lite.
- Saved host names/URLs are stored in localStorage; forget them from the connect screen.
- Access/refresh tokens are stored in sessionStorage for this browser tab, not localStorage. Close the tab or switch/sign out to discard them. Treat Lite's origin as trusted code: an XSS there could access these tokens.
- Access lasts ten minutes; refresh rotates, lasts thirty days and detects replay. Password changes, dashboard lock, logout and refresh replay revoke authorization. Only token digests are stored on VibeGhost.
- Allowed cross-origin requests require bearer auth, even when the host is reached through loopback. Cookies are not sent. CORS uses exact origins, never `*`.
- The copied terminal uses the existing authenticated bootstrap/output-poll/input/resize REST API. VibeGhost additionally supports token-authenticated WebSockets through a fifteen-second single-use ticket (`POST /api/lite/ws-ticket` then `/ws?liteTicket=...`); access/refresh tokens never appear in WebSocket URLs.

## Development verification

`npm run typecheck` and `npm run build` pass. Browser proof on both local and Tailscale Lite origins connected to a separate protected VibeGhost, signed in, created session `b117769a-5f3d-490b-accb-0b0542e0964d`, sent a command through the UI and verified `VGLITE_PHONE_URL_PROOF` in the real terminal screen. Screens were captured at 1440 and 402 pixels in both themes. Agent conversation UI is copied and uses VibeGhost agent APIs; the scratch session is a plain shell, not an agent, so no LLM response is claimed.

Optional Oathkeeper-specific services (its AI/MCP configuration, canvas embeds, saved iroh invites and AI commit-message generation) are not provided by this standalone client. The ordinary VibeGhost workspace/session/terminal/agent/files/git API is direct. No Oathkeeper account or shared credentials are bundled.

## License

MIT. Retains Oathkeeper and third-party license notices. `features/oathkeeper` paths intentionally retain provenance rather than renaming the copied UI.

# A small Worldstream server

Run one shared Genesis room with authenticated players, saved state, timers, provider jobs and the browser player. Requires Node 20 or later.

```sh
npm ci
npm run serve:world
```

Open the printed URL and enter one of the printed player tokens. Open a second browser window with another token to test multiplayer. Each token identifies one player; it grants no access to other players' private commands or server state. Tokens stay in the page's memory and requests use the Authorization header.

The default project is Pokémon Wildclash. To serve another project:

```sh
npm run build
node examples/server/server.mjs ./my-world
```

## What runs on the server

`server.mjs` loads the three project files and creates one `GenesisHost`. File storage saves the room under the project's `.genesis/server` directory. Restarting with the same project and credentials restores its state. A changed project requires a new session ID or storage directory; preserve old saves when starting a new version.

The worker advances timers and provider jobs every 250 ms independently of browser reads. Only actual player requests renew seat leases. Player IDs and verified identity keys come from the server's credential list. Claiming another owned trainer seat switches only that credential's controlled actor. Participant routes expose filtered views and never expose diagnostics, the controller source, other credentials or host events.

`client.js` connects `mountGenesisPlayer` to the authenticated routes. `index.html` supplies the room login and stage. Use this code as a starting point for your own app and account authentication.

| Route | Purpose |
| --- | --- |
| `POST /api/join` | Join as the server-verified credential owner. |
| `POST /api/leave` | Release that identity's seats and leave the room. |
| `GET /project` | Get the public definition and interface. |
| `GET /api/queue` | Read the standard action queue, public prompts, nicknames and estimated timing. |
| `GET /api/view` | Read the actor's permitted state and renew its lease. |
| `POST /api/action` | Submit `eventId`, `actionId`, typed `data` and `revision`. |
| `POST /api/players` | Claim or release a seat, or join or leave the queue. |
| `POST /api/playback` | Acknowledge an observed `playbackId`. |
| `POST /api/run`, `/api/retry`, `/api/skip` | Request an allowed job transition using `jobId`. |

All these routes require a bearer token. POST requests also require the configured Origin. Actor IDs, roles and identity keys in browser payloads confer no authority. Duplicate action event IDs are idempotent.

## Persistent player credentials

By default each start creates three random tokens for local testing. For stable credentials, keep a JSON file outside the project and version control:

```json
[
  {"id":"red","name":"Red","token":"REPLACE_WITH_A_RANDOM_TOKEN_AT_LEAST_24_CHARACTERS"},
  {"id":"blue","name":"Blue","token":"REPLACE_WITH_ANOTHER_RANDOM_TOKEN_AT_LEAST_24_CHARACTERS"}
]
```

Create random tokens with `node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"`. Restrict access to the credential file, then start:

```sh
GENESIS_PLAYERS_FILE=/private/path/players.json node examples/server/server.mjs ./my-world
```

The server keeps token hashes in memory and does not print configured credentials. An optional `identityKey` associates several trusted connections with one account. Never accept that field from a browser.

For a deployment behind an HTTPS reverse proxy, set `HOST=0.0.0.0`, `PORT`, `GENESIS_ORIGIN=https://your-host.example`, and `GENESIS_PLAYERS_FILE`. Preserve the public Host header. Writes must originate from that exact origin; tokens belong in headers. Replace the file credential list with your app's authentication as the app grows.

## Connect providers

Default providers use prepared media and structured move fixtures. Continuous directions are simulated and labeled in the page. They make no external requests and incur no generation charges.

Export `providers` from your own server-side module, then configure its path:

```sh
GENESIS_PROVIDER_MODULE=/private/path/providers.mjs node examples/server/server.mjs ./my-world
```

The module can also export `services` and `policy`. Each provider implements the [provider contract](../../docs/providers.md). Paid providers require `services.authorizeTool`; the host enforces project and host spending limits. Keep API keys in the server environment and enforce your budget inside that authorization service. Use durable result storage and stable provider idempotency keys.

Bounded video providers return saved video and its actual final frame. The player acknowledges completed playback before the next visual turn. Continuous providers additionally need stream admission, video delivery, idle animation, direction updates, observed playback events, reconnection and teardown. Connect that presentation adapter in your frontend. The basic server provides the game loop and integration points; a World Model still supplies the video.

For embedding, `startWorldServer(options)` accepts `directory`, `players`, `providers`, `services`, `policy`, `storage`, `sessionId`, `hostname`, `port`, `origin` and `onError`. It returns `url`, an operator-only `host`, and `close()`. Project code cannot invoke operator methods. Your deployment owns provider cleanup when closing a continuous stream.

## Deployment scope

This example runs one room in one process. File storage is atomic within that process. Multiple workers need transactional storage, leases and durable scheduling. Add your app's admission limits, rate limits and provider lifecycle management before opening large public rooms. The health route is `/health`.

## Agent connection

Use the [MCP server entry](../../docs/mcp.md) to give an agent typed access to the same room as the browser. It exposes declared game actions automatically, with optional operator tools for image caching, frame preparation and live start-frame changes. Run the MCP entry in place of the ordinary server entry so both connections share one host and storage writer.

# Connect an agent through MCP

Genesis keeps the world's state, resolves its rules and coordinates providers. The Model Context Protocol (MCP) exposes those capabilities as discoverable tools with typed inputs. The included adapter connects an agent and browser to the same `GenesisHost`, persistent room and background worker.

Build once, then use the MCP entry instead of the ordinary server entry:

```sh
npm ci
npm run build
GENESIS_MCP_OPERATOR=1 node examples/server/mcp.mjs ./examples/pokemon-wildclash
```

This starts a loopback browser server and an MCP stdio connection. Protocol messages use stdout; startup messages use stderr. An MCP client launches this process and communicates through its standard input and output. Default providers use prepared fixtures without model calls or charges. Use `GENESIS_PROVIDER_MODULE` to load your server-side providers, services and policy.

A client configuration looks like this (replace the absolute paths):

```json
{
  "mcpServers": {
    "genesis": {
      "command": "node",
      "args": [
        "/absolute/path/to/genesis/examples/server/mcp.mjs",
        "/absolute/path/to/genesis/examples/pokemon-wildclash"
      ],
      "env": { "GENESIS_MCP_OPERATOR": "1" }
    }
  }
}
```

`GENESIS_MCP_OPERATOR=1` explicitly grants author controls to this local MCP connection. With the setting omitted, the connection receives player tools and the current actor's filtered view. Browser tokens always remain participant credentials. Operator controls are available through stdio and the trusted Node host API.

Use the same `GENESIS_PLAYERS_FILE` format as the [server guide](hosting.md) for browser players. Set `GENESIS_MCP_ACTOR_ID` to the configured player controlled by the agent (default `agent`). A claim on another seat owned by that identity switches this connection to the corresponding actor. Start one server entry per room storage directory. The MCP entry already includes the browser server.

## Discover available operations

Start with `genesis_catalog` and MCP `tools/list`. The catalog reports declared action fields, eligibility, host grants, configured providers, frame readiness, current revision and spending limits according to the connection's scope. `tools/list` supplies the complete input schemas.

| Tool | Purpose |
| --- | --- |
| `genesis_read_queue` | Read ordered actions, public prompts, display nicknames, status and estimated clocks. |
| `genesis_read_world` | Read the current actor's permitted world state and revision. |
| `genesis_action_<actionId>` | Submit a typed action declared by this project, such as `genesis_action_battle_move`. |
| `genesis_players` | Claim, leave or switch an owned seat, or enter or leave the queue. |
| `genesis_run_job`, `genesis_retry_job`, `genesis_skip_job` | Request an allowed job transition. |
| `genesis_observe_playback` | Report video playback that actually completed. |
| `genesis_cache_image` | Operator: register an existing saved image as a ready frame reference. |
| `genesis_prepare_frame` | Operator: generate and cache a future scene-only frame asynchronously. |
| `genesis_use_frame` | Operator: install an exact ready frame at the next live generation boundary. |
| `genesis_invalidate_frame` | Operator: retire an obsolete cached frame. |
| `genesis_direct_scene` | Operator: submit a new visual direction to the running stream. |
| `genesis_apply_effect` | Operator: use the complete typed effect interface for image, scene, direction, registered tool, frame, stage or timer operations. |

Long or unusual action IDs receive stable shortened tool names; the catalog returns the exact mapping. `players.release` stays in the controller, where defeat and queue rules determine who leaves. Custom provider capabilities appear in the catalog; registered `tool.*` calls use `tool.request` through `genesis_apply_effect`.

## Cache an image and change the start frame

Read the current revision, then call `genesis_cache_image` with a unique request ID, exact scene fingerprint and saved image URL:

```json
{
  "requestId": "cache-clearing-v1",
  "expectedRevision": 12,
  "frame": {
    "key": "clearing-ready",
    "fingerprint": "charizard-blastoise:overhead65:ready:v1",
    "ttlMs": 600000
  },
  "imageUrl": "https://example.com/saved-clearing.png"
}
```

Caching records a saved image reference and leaves the displayed scene unchanged. It downloads no media and requests no generation. Imported images expire without automatic regeneration. Replace or cache them again explicitly when needed.

After the current accepted action and its observed playback finish, read the latest revision and call `genesis_use_frame`:

```json
{
  "requestId": "use-clearing-v1",
  "expectedRevision": 13,
  "frame": {
    "key": "clearing-ready",
    "fingerprint": "charizard-blastoise:overhead65:ready:v1"
  },
  "intent": "Hold the accepted two-fighter lineup. Preserve the overhead angle and near-left/far-right depth. Subtle breathing and wind only."
}
```

The exact frame must be ready and unexpired. Its accepted anchor becomes a reanchor direction. Provider and playback adapters carry that command into the stream; the fixture provider simulates delivery.

For a new generated frame, use `genesis_prepare_frame` with `requestId`, `expectedRevision`, `frame`, scene-only `intent`, accepted references and `maxCostUsd`. Preparation is asynchronous and governed by both project limits and host grants. Read readiness before using the image.

## Add a game action

Declare the action ID, label and typed fields in `genesis.json`, and implement its `onEvent` handler in `controller.js`. Load that project version into the host. The MCP adapter creates its action tool automatically from the declaration. Canonical health, winners, inventory and turn order continue to come from the controller.

A running room pins its project version. Use a new `GENESIS_SESSION_ID` or storage directory when loading an edited project, preserving the old saved room. Live presentation controls change the current scene through the existing runtime.

## Embed the adapter

```ts
import {createGenesisMcpServer} from '@genesis-worlds/runtime/mcp';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';

const server = createGenesisMcpServer(host, {
  actorId: authenticatedActorId,
  operator: true,
});
await server.connect(new StdioServerTransport());
```

Supply a joined, server-verified actor. Keep `operator` as a trusted host setting. Trusted operator calls use `host.operatorView()`, `host.cacheOperatorImage(...)` and `host.applyOperatorEffect(...)`. These methods serialize and persist commands, require the current revision and preserve the existing grants, budgets, job validation and playback boundaries. Player routes expose filtered state and typed actions.

The reference adapter uses the [official MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server). Applications can use the same adapter with another SDK transport and their own authentication.

Scene effects accept `label` and `displayPrompt` for the standard public queue. Opt into a bounded FIFO direction queue with `queue:true`. The server delivers one direction at a time. Read [the standard action queue](api.md#standard-action-queue) for the shared browser, API and MCP data format.

# Run a Worldstream server

Shared rules, private choices, persistent world state, timers and model credentials belong on a server. Genesis includes a runnable single-room Node server with the browser player, player authentication, file persistence and a background worker.

```sh
npm ci
npm run serve:world
```

Open the printed URL and enter a printed player token. Use another window and token for a second player. The default world is the current Pokémon Wildclash project, including its real battle controller and interface. Prepared fixtures exercise the shared game without model requests. Continuous video directions are simulated in this mode.

To serve your own project:

```sh
npm run build
node examples/server/server.mjs ./my-world
```

The [server example](https://github.com/sequencer-media/genesis/tree/main/examples/server) documents stable player credentials, server-side providers, spending authorization, HTTPS deployment and the route contract. The [Pokémon project](https://github.com/sequencer-media/genesis/tree/main/examples/pokemon-wildclash) includes the complete source and bundled start artwork.

## Server responsibilities

| Feature | Server responsibility |
| --- | --- |
| Shared rules and private choices | Run the controller and send each actor a filtered view. |
| World memory and progress | Persist the room state and durable provider handles. |
| Timers and generation jobs | Advance the worker independently of browser reads. |
| Player seats and queues | Authenticate players, enforce ownership and renew active leases. |
| Model access and budgets | Register permitted providers and authorize paid requests. |
| Video presentation | Deliver saved clips or connect a continuous stream adapter with observed playback. |

The example supports one process and one room. Distributed hosting needs transactional storage, worker leases and durable scheduling. Continuous streaming also needs model admission, video delivery, idle animation, prompt updates, reconnection and teardown. Those operations belong to your provider and presentation adapters. See the [API](api.md), [providers](providers.md) and [host authority](host-authority.md).

## Export or use managed hosting

Validate the project and export its complete bundle:

```sh
node dist/cli.js validate ./my-world
node dist/cli.js export ./my-world --out ./my-world.zip
```

Upload the ZIP in the [Sequencer Worldstream editor](https://sequencer.media/worldstreams#my-worlds), or serve it in your own app. The [Worldstreams API](integration.md) provides managed model services for your backend.

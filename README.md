# GENESIS · Open Source World Model Game Engine

**Create infinite worlds, in minutes.**

![Three connected pixel worlds, a floating forest, a castle arena and a lunar outpost](docs/assets/genesis-worlds.svg)

Turn an idea into a playable AI world. Genesis connects generated video, LLM decisions and player actions into a game with persistent state, shared rules and a custom interface.

Describe your world to a coding agent. The bundled authoring skill builds the project, runs a local preview and prepares a portable bundle. Connect Sequencer to generate live media, or bring your own providers.

[Start building](#play-your-first-world) · [Create from a prompt](#one-prompt-a-playable-world) · [Connect Sequencer](#one-key-to-sequencer) · [Read the API](docs/api.md)

## The model makes the scene. Genesis makes it playable.

A video model can show a dragon. A playable world also needs to know whose turn it is, which spell was chosen, how much health remains and when players can act again. Genesis gives those pieces one shared lifecycle.

| The engine handles | What you can build |
| --- | --- |
| **State management** | Persistent inventory, health, progress and separate public, private and server state. |
| **Game rules and multiplayer** | Authoritative turns, player seats, crowd votes and validated actions. |
| **LLM context and prompt workflows** | Send committed outcomes and scene context to backend tools. Validate structured replies for generated moves, characters and choices. |
| **Generation jobs** | Track asynchronous requests, handle failures and reject results from an old encounter. |
| **Scene continuity and playback** | Carry the actual end frame into the next scene and reopen actions when playback finishes. |
| **Custom game interfaces** | Build controls, overlays and animations with HTML, CSS and JavaScript. |
| **Portable assets and projects** | Package declared images, audio and video with the world, then attach them through the host. |
| **Provider connections** | Use Sequencer's managed APIs or connect your own LLM and media providers. |

Genesis is the SDK and runtime. Connected models generate the media; your controller defines what happens in the world.

## One prompt. A playable world.

The repository includes a [create-world-stream agent skill](skills/create-world-stream/SKILL.md). Give a coding agent this checkout and an idea:

```text
Use the create-world-stream skill to build Mosslight, a forest battle
game with a cream pixel interface. Let two players take turns and have
the backend LLM create four moves for each encounter. Track shared health
and inventory. Give me a working local preview and an exportable world.
```

The skill turns the idea into world settings, a custom interface and controller rules. It wires LLM requests, declares assets, validates the bundle and exercises the player flow. [AGENTS.md](AGENTS.md) points repo-aware agents to the skill; other skill-capable agents can load its SKILL.md directly.

Start with the included local fixtures. With a configured provider and budget, the agent can create and attach images, audio and video. The local preview clearly labels prepared media and LLM data so you can try the game loop before paying for generation.

## Play your first world

Requires Node 20 or later. From this source checkout:

```sh
npm ci
npm run build
node dist/cli.js init ./my-world --template arena-llm
node dist/cli.js dev ./my-world
```

Open the printed local URL. Try the vintage pixel battle, switch preview players and play a turn. This starter uses four structured move definitions, shared health and authoritative turns. Local moves and video use prepared fixtures; a connected Sequencer host requests real backend LLM results.

| Starter | Make it yours |
| --- | --- |
| `arena-llm` | A vintage battle with LLM-created moves and shared player seats. |
| `exploration` | An evolving world where each completed scene becomes the next starting point. |
| `decisions` | Branching choices and collective decisions. |
| `timing` | A challenge with a defined input window and repeatable starting scene. |
| `arena` | A battle with fixed server-resolved moves, inventory and spectator queues. |

Choose another starter with `--template`. Edit the project files, then restart the runner. Sessions pin their project version; remove the generated `.genesis/` directory inside your world to start a fresh development session after code changes.

<details>
<summary>See the vintage arena on mobile</summary>

![Vintage arena mobile author preview using prepared move data](docs/assets/arena-mobile.jpg)

</details>

## Three files. Your whole world.

```text
my-world/
├── genesis.json      World settings, actions, tools and asset registry
├── interface.html    Your game's interface and browser behavior
├── controller.js     Shared rules, state transitions and backend requests
└── assets/           Images, audio and video that travel with the project
```

The interface sends actions and renders accepted state. The controller resolves the outcome and requests generation. The host supplies identity, credentials, storage and spending policy.

```sh
node dist/cli.js validate ./my-world
node dist/cli.js export ./my-world --out ./my-world.zip
```

The ZIP includes the three entry files, the JSON Schema and complete declared assets. Safe relative paths make media portable; hosting adapters copy assets and provide runtime URLs. Keep provider keys, wallets and commercial settings in the host. See [the project boundary](docs/project-boundary.md).

## One key to Sequencer

Connect one server-side `SEQUENCER_API_KEY` for structured LLM calls, image/audio/video generation, asset uploads, versioned world drafts and private Worldstreams.

Set the key in your server environment, then save your world:

```sh
node dist/cli.js save ./my-world --workspace YOUR_WORKSPACE_ID
```

The command uploads the declared assets and returns a saved draft. Use [SequencerClient](docs/integration.md) to discover models, quote generation, read completed media and control a private stream. `createSequencerLlmProvider` connects structured LLM tools to the same account.

| Capability | Genesis + Sequencer | Genesis + your own providers |
| --- | --- | --- |
| World rules, custom UI and portable bundles | Included | Included |
| LLM, images, audio, video and private stream APIs | One Sequencer server key | Connect adapters and credentials |
| Assets and versioned world drafts | Managed integration | Choose storage and publishing |
| Shared backend job polling | Managed by Sequencer hosting | Run your worker |
| Hosted viewer identity and billing | Worldstreams accounts, gems and viewer leases | Implement your policies |
| Audience and monetization in your own app | Yours to manage | Yours to manage |

Genesis is Apache 2.0 licensed and works without a Sequencer account. Choose your own LLM with `createLlmProvider`, and connect media through the [provider contract](docs/providers.md). The SDK includes prepared-media and Replicate adapters. Live providers also need readiness, prompt control, playback, cancellation and reconnect support.

Private Sequencer API streams currently cost $40/hour of active streaming and support 30–600 seconds per session. The API quotes and reserves the maximum cost, then refunds unused credit on teardown. Startup is excluded; generation and LLM requests are priced separately. Always use the returned quote. See [integration](docs/integration.md) for spending limits, stream leases and hosting responsibilities.

## Build your own host

Use `GenesisHost` on a Node server and `mountGenesisPlayer` in the browser. Connect them through authenticated server routes. The framework-independent player fits your app; host adapters provide authorization, moderation, metering and verified commerce.

Controllers run in a bounded QuickJS sandbox. The host validates actions, filters private state and grants tool access. Generation results return as events to the controller, which updates accepted state and the interface. Game outcomes are committed before a scene request; playback completion advances visual turns. [See the architecture](docs/architecture.md).

Memory and atomic file storage support a single host process. Distributed deployments need transactional storage, job admission and durable scheduling. The local runner is for authoring; production uses an authenticated host. Live paid access also requires viewer revocation in the chosen transport. [Read host authority](docs/host-authority.md).

## Preview status and development

Version 0.1 is an unpublished development preview. This local repository is being polished for launch. The source is Apache 2.0 licensed; npm publication and a public GitHub release are pending.

The standalone preview verifies bounded clips, prepared media and structured tool data. Continuous streams and avatar/audio sessions require a deployment-specific presentation adapter. The Replicate adapter has protocol-fixture coverage; live paid predictions still need validation. Current reference limits include 100 participants, 32 actions, 200 KB session state and 2–10 second clips.

Portable continuous-stream settings accept 2–30 second chunk intervals. Sequencer's current deployment accepts 14 seconds, with approximately 14.375 seconds of provider output. Hosts validate supported intervals. See [compatibility](docs/compatibility.md) and [private launch preparation](docs/launch.md) for versioning and release checks.

```sh
npm test
npm pack --dry-run
```

[API reference](docs/api.md) · [Provider adapters](docs/providers.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Apache 2.0 license](LICENSE)

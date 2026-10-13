# Genesis

A portable JavaScript runtime for interactive AI worlds. It coordinates participant actions, shared game rules, asynchronous media jobs, scene checkpoints and browser playback.

This is version 0.1, a development preview. The package is prepared locally for extraction into its own repository. It has not been published to npm or GitHub.

## Start locally

Requires Node 20 or later. From this directory:

```sh
npm ci
npm run build
node dist/cli.js init ./my-world --template exploration
node dist/cli.js dev ./my-world
```

Open the printed loopback URL. Click Move forward, then Run scene. A prepared clip plays, its end frame becomes the next anchor, and exploration reopens. No account, API key or model request is required for this local path.

Other templates: `timing`, `decisions`, `arena` and `arena-llm`. The last uses structured LLM moves and a vintage off-white pixel interface. Local previews use a clearly labeled prepared JSON fixture. Preview player selection lets you test two actors. For group voting, set participation.mode to group, minPlayers to 1 and maxPlayers to 10 in genesis.json. Configure voteSeconds in definition.genesis.config.

Edit interface.html, controller.js and the settings in genesis.json, then restart the local runner to load the changed project. Sessions pin project contents. Delete the local .genesis folder to reset a development session after changing code. Asset fixtures are prepared media that demonstrate the lifecycle; they do not simulate a world model's visual fidelity.

## One project

Genesis is a project format and runtime. The editor presents three file tabs, with product controls in a separate Worldstream settings drawer.

A project folder contains:

- `genesis.json`: world metadata, separate cover and starting images, stream defaults, participants, input/action contracts, content preferences, custom settings, requested tools and source-file references.
- `interface.html`: HTML, CSS and browser JavaScript for custom controls, overlays, animations and game presentation.
- `controller.js`: authoritative shared rules, turns, votes, state transitions and requests for host tools.
- `assets/`: prepared images, videos and other project media.

The interface submits actions and renders accepted state. The controller determines shared outcomes and requests media. Credentials, fixed viewer gem rates, wallets and purchase verification remain host authority. The manifest declares behavior defaults and project-specific settings. Editor exports are ZIP archives containing genesis.json, interface.html, controller.js and the JSON Schema. Declared assets use safe relative paths and travel inside the ZIP. Single-file JSON transport projects remain supported for API clients. The editor and host consume the same contracts. Starter selection and import/export are editor actions.

The default controller provides common behavior. Custom controllers can combine generated scenes, prepared media, images, live direction, actor decisions and crowd votes. Registered providers declare supported capabilities. The initial reference host serializes visual jobs.

## Stream chunk interval

`definition.worldVideo.chunkIntervalSeconds` is the nominal duration of each continuous-stream segment, defaulting to 14. The portable schema accepts whole seconds from 2 to 30 so other hosts can experiment with 10 or 5 seconds. A host must validate supported intervals and configure its provider accordingly.

The Sequencer Fast H3 deployment currently accepts only 14 for continuous streams. Its current output is approximately 14 seconds (14.375 seconds at the provider). The Worldstreams host rejects unsupported intervals when saving; its policy is visible in the settings drawer. This setting does not change input-gated clip duration, vote deadlines, playback speed or the platform's viewer gem rate.

## Project and product boundary

The versioned JSON Schema is shipped in schema/genesis.schema.json and exported as GENESIS_PROJECT_SCHEMA. The validator rejects unknown settings instead of silently dropping them. Namespaced extensions are bounded inert data; they do not grant permissions. Reserved product/host fields must stay outside the portable project. Saved interface/controller version IDs are cleared in portable manifests. Connected saved-game IDs are host-specific; archive export requires their game behavior to be implemented in the project files.

Worldstreams keeps workspace membership, ownership, publication, listing category, avatar account connections, chat access/moderation, prices and commercial configuration in its product records. Chat presentation/reactions and requested scene content preferences can travel with Genesis. Hosting grants, provider credentials, resource ceilings, safety enforcement, metering and verified purchases are independently controlled by each deployment. See [project boundary](docs/project-boundary.md).

## Embed or self-host

Use GenesisHost on a Node server and mountGenesisPlayer from the browser entry point. Implement the browser transport against your authenticated server routes. A server issues actor identity; clients submit action data and never select their own authority. The loopback runner is an author tool, not an internet deployment server.

Adapters cover provider jobs, persistent storage, host authorization, moderation, viewer metering and verified commerce. Memory and atomic file storage are included. Multi-worker deployments need transactional storage and distributed admission/locking.

Hosts can register extra tools using namespaced tool capabilities. These can provide audio, maps or other services without modifying the core effect registry. A cached provider is included. The Replicate adapter supports pinned model versions, submission, polling and cancellation using host-owned credentials. Each deployment provides model input mapping, estimated cost, output persistence and actual end-frame extraction. See [providers](docs/providers.md). The adapter is tested against protocol fixtures. Live paid predictions have not been tested in this release.

## Runtime guarantees and limits

The host serializes accepted state transitions, filters private state, validates typed actions and checks host grants independently of project requests. Controllers run in QuickJS with 8 MB memory, bounded execution and no Node, filesystem or network globals. Effects are brokered by the host.

Generation requests and playback completion are separate. Completed video needs its decoded end frame before exploration resumes. Duplicate accepted events and effect IDs do not queue another job. Completed job history is bounded, active and referenced anchors are retained, and free providers release generation reservations. Provider-level exactly-once charging requires provider support; a crash during submission may need manual reconciliation.

Reference bounds include 32 actions, 16 fields per action, 32 flat project settings, 100 participants, 12 choices per collective window and 200 KB session state. Clips use 2 to 10 seconds. These limits describe the current preview contract. Standalone verification covers bounded clips, prepared media and tool data. Continuous streams and avatar/audio sessions need a deployment-specific presentation adapter.

## Develop

```sh
npm test
npm pack --dry-run
```

Read [API](docs/api.md), [provider integration](docs/providers.md), [host authority](docs/host-authority.md) and [contributing](CONTRIBUTING.md). Agent authoring instructions are in AGENTS.md. Apache 2.0 license.

The arena starter (`genesis init my-arena --template arena`) includes verified seat ownership, four server-resolved moves, health, inventory, queued spectators and defeat cooldown. Genesis.players requests participation changes through the host. The portable runtime enforces rules; hosting adapters provide authenticated identity and atomic persistence. See [the participation API](docs/api.md#participation-version-1).

## Connect Sequencer

The `arena-llm` starter uses an off-white vintage interface, generated move data, authoritative turns and shared player seats. The local preview uses prepared fixtures; the Sequencer host requests real backend LLM results.

![Vintage arena mobile author preview using prepared move data](docs/assets/arena-mobile.jpg)

One server credential connects world authoring, structured LLM calls, media uploads, image/audio/video generation and private Worldstreams. Keep `SEQUENCER_API_KEY` in your server environment.

```sh
node dist/cli.js init ./battle --template arena-llm
node dist/cli.js dev ./battle
node dist/cli.js export ./battle --out ./battle.zip
node dist/cli.js save ./battle --workspace YOUR_WORKSPACE_ID
```

The save command creates a draft. In server code:

```js
import {SequencerClient, createSequencerLlmProvider, FileGenesisToolResults} from '@genesis-worlds/runtime';
const sequencer = new SequencerClient({apiKey: process.env.SEQUENCER_API_KEY});
const llm = createSequencerLlmProvider({client: sequencer, workspaceId,
  results: new FileGenesisToolResults('./private-tool-results')});
const quote = await sequencer.streamQuote(workspaceId, worldId);
const stream = await sequencer.startStream(workspaceId, worldId, crypto.randomUUID(), 600);
// Renew with readStream about every 10 seconds. Always stopStream when done.
```

Private API streams charge the creator account at the configured rate, currently $40/hour of active streaming. The current native pilot supports 30–600 seconds per creator session; its bounded duration is exposed in the quote. It reserves the maximum cost ($6.67 for 600 seconds), then refunds unused credit on teardown. Startup time is excluded. Creators control their own users, viewer access and monetization. Media and LLM calls have their own quoted charges. Hosted LLM jobs automatically use the workspace owner's credit, currently $0.01/request; host-enforced session and wallet limits still apply.

| Capability | Genesis with Sequencer | Genesis with your own providers |
| --- | --- | --- |
| World rules, custom UI and portable media bundles | Included | Included |
| LLM, images, audio, video and private stream APIs | One Sequencer server key | Supply adapters and credentials |
| Workspace assets and versioned drafts | Managed Sequencer integration | Supply storage and publishing |
| Shared backend job polling | Included in Sequencer hosting | Run your own worker |
| Identity and viewer billing on Worldstreams | Managed gems and viewer leases | Implement your own policies |
| Identity and monetization in a custom deployment | Creator-owned | Creator-owned |

Choose your own LLM or stream provider by implementing the provider contract. The core requires no Sequencer account. A video URL alone supports prepared clips; live services also need playback, readiness, prompt control, cancellation and reconnect behavior. See [integration](docs/integration.md), [architecture](docs/architecture.md), [compatibility](docs/compatibility.md) and the bundled [create-world-stream skill](skills/create-world-stream/SKILL.md).

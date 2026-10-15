# Run a starter locally

Play an included world, customize its rules and connect generation. Requires Node 20 or later.

Want your coding agent to build an original world? Start with the [Genesis skill quickstart](agent-skill.md).

## Start the preview

Clone Genesis, build the tools and start the vintage battle example:

```sh
git clone https://github.com/sequencer-media/genesis.git
cd genesis
npm ci
npm run build
node dist/cli.js init ./my-world --template arena-llm
node dist/cli.js dev ./my-world
```

Open the printed local URL. Play a turn, switch preview players and inspect the accepted state. The runner uses labeled prepared video and an arena move fixture.

The local preview runs without a Sequencer account, Worldstreams API key or generation service. `genesis dev` always uses its prepared providers, including when a key is present in the environment. Live AI generation requires a custom host connected to your chosen provider. Continuous streaming also requires that provider's playback and session integration.

## Choose an experience

| Template | Starting point |
| --- | --- |
| arena-llm | Two players, shared health, structured LLM move definitions and a vintage interface. |
| exploration | Generated scene progression and end-frame continuity. |
| decisions | Branching choices and collective decisions. |
| timing | A bounded input window and a repeatable starting scene. |
| arena | Fixed server-resolved moves, inventory, seats and spectator queues. |

Pass the template name with `--template`. For an original world, [give your coding agent a prompt](agent-skill.md).

## Make the world yours

- **genesis.json:** Declare player actions, settings, requested tools and assets.
- **interface.html:** Build the controls and render the accepted public state.
- **controller.js:** Keep inventory, variables, locations and characters in state; resolve actions and request backend tools.

The browser submits intentions. The controller commits the result. Model and media jobs return as events; the controller chooses the next state.

Restart the local runner after changing the project. Sessions pin their project contents. Remove the generated `.genesis/` directory inside your world when you want a fresh development session.

## Validate and export

```sh
node dist/cli.js validate ./my-world
node dist/cli.js export ./my-world --out ./my-world.zip
```

The bundle contains the manifest, interface, controller, JSON Schema and complete declared assets. Use safe relative asset paths. The host attaches those assets and serves runtime URLs.

## Connect live generation

Use the [Worldstreams API](integration.md) for the managed Sequencer path, or [register your own providers](providers.md). Keep credentials on the server. Your host independently authorizes tool access and spending.

The local runner supplies the arena move fixture for LLM requests. When your world requests another response shape, supply matching fixture data through a local `createLlmProvider` host adapter or connect the configured backend.

## Publish on Sequencer

[Open My Worlds](https://sequencer.media/worldstreams#my-worlds) with your existing Sequencer account. Create a world, import your ZIP in the editor, then preview, save and publish it. Sequencer handles your workspace, assets and gems.

Read the [integration guide](integration.md) to upload a local project with the API.

## Take it into production

Embed `mountGenesisPlayer` in your app and run `GenesisHost` behind authenticated routes. Choose persistent storage and a background worker for the room. Distributed deployments need transactional storage and durable scheduling. Read [host authority](host-authority.md) and [the API reference](api.md) before deployment.

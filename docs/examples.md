# Example projects

Explore GENESIS worlds with real interfaces, shared rules and persistent state.

## Mosslight: Lantern Run

Run `npm run play` for a complete solo adventure. Find three stars, choose a route, manage your lantern and outwit a thorn sentinel. A run takes six or more choices and ends with a result you can replay. Everything runs locally without an account, API key or model provider.

The [`quest` starter](https://github.com/sequencer-media/genesis/tree/main/examples/quest) includes the interface, authoritative rules and editable settings. Change the world name, lantern duration or difficulty in `genesis.json`, then restart the preview. [Start playing and remixing](getting-started.md).

## Pokémon Stadium

[Open Pokémon Stadium on Sequencer](https://sequencer.media/worldstreams/S_R5xijO8Pjv).

Two trainers choose their Pokémon, ready up and battle in the same Worldstream. A challenger queue lets the next trainer join the action.

[![Pokémon Stadium interface showing trainer seats, health and battle controls](assets/pokemon-stadium-ui.webp)](https://sequencer.media/worldstreams/S_R5xijO8Pjv)

| Part of the experience | What it demonstrates |
| --- | --- |
| Trainer selection and readiness | Player seats, eligible actions and a shared start condition. |
| Turns and combat | Authoritative rules for type effects, status conditions and battle outcomes. |
| Items, health and EXP | World variables that persist between actions. |
| Challenger queue | Multiplayer participation and room state. |
| Battle interface and Worldstream | Player controls around generated video. |

### Build something similar

Use the [Genesis skill quickstart](agent-skill.md). Describe your own cast, battle rules and visual style. Start with the `arena-llm` example for generated move sets, or `arena` for controller-driven combat.

Keep accepted game outcomes in `controller.js`. Ask the LLM for bounded move data, then validate it before opening actions. Use generated video to depict the committed outcome and advance the visual turn after playback completes. [Read the authoring contract](../AGENTS.md).

Publish your finished world using [My Worlds](https://sequencer.media/worldstreams#my-worlds), or export a complete project for your own host.

## Included starter projects

The repository includes runnable starters for solo adventures, exploration, battles, crowd voting, shared state and custom tools. [Run a starter locally](getting-started.md) or [watch the Worldstream demos](demos.md).

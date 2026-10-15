# Build a world with the Genesis skill

Describe your world, then let your coding agent build its interface, memory and rules. The included **create-world-stream** skill takes it through a local preview and a complete project export.

Requires a coding agent that can read local files and run commands, plus Node 20 or later.

## Get Genesis ready

Clone the repository and try its first game:

```sh
git clone https://github.com/sequencer-media/genesis.git
cd genesis
npm run play
```

Open the printed URL and play a few choices in Mosslight. Stop the preview when you are ready to build your own world. Open the `genesis` folder in your coding agent. The skill is already included at `skills/create-world-stream/SKILL.md`. Repo-aware agents can also discover it through `AGENTS.md`.

## Describe your world

Paste this prompt into your agent. Change the setting, interactions and visual style to match your idea.

<div class="prompt-card">
<pre><code>Read skills/create-world-stream/SKILL.md and build Moonmoth, a solo game about a courier crossing floating islands. Start from the quest template.&#10;&#10;Give it an original interface, meaningful route choices, an inventory, a clear win/lose goal and replay. Keep the first version instantly playable with local rules.&#10;&#10;Validate and export the project, play a complete run, and give me the local preview URL and ZIP.</code></pre>
<button type="button" data-copy-prompt>Copy world-building prompt</button>
</div>

The agent chooses a starter, adapts its controls and rules, and checks the result. Tell it which model provider you want when you are ready to connect generation.

## Play, refine and export

Open the preview URL your agent returns. Try a turn, switch players and check that inventory and progress carry forward. Ask for changes in the same conversation.

Your agent should give you:

- **A playable preview:** Your interface and controls running locally.
- **An editable project:** `genesis.json`, `interface.html`, `controller.js` and declared assets.
- **A complete ZIP:** A validated bundle to import into a compatible host.

Want to inspect or export the project yourself? Follow the [local starter guide](getting-started.md#validate-and-export).

## Connect live generation

Local previews use prepared responses and media. The stock runner includes an arena move fixture; another response format needs a matching local provider fixture.

Choose a connection when you want generated images, audio and video:

- **Sequencer:** Use the [Worldstreams API](integration.md) with one server key, or [import your project into My Worlds](https://sequencer.media/worldstreams#my-worlds) to preview and publish it.
- **Your own providers:** Connect your LLM and World Model through [server-side adapters](providers.md).

Configure your provider and generation budget before requesting live media. Credentials and spending limits belong on the host server.

## Skill reference

The skill ships with the Apache 2.0 licensed engine. <a href="skills/create-world-stream/SKILL.md" download>Download SKILL.md</a>, or expand the full instructions below.

# Build any world from one prompt

The open source **create-world-stream** skill helps a coding agent build a playable World Model prototype in minutes. Describe the experience; the agent creates the interface, controller rules, backend requests and portable project.

## Use the included skill

Give your coding agent the Genesis checkout and ask it to use `skills/create-world-stream/SKILL.md`. Repo-aware agents discover it through AGENTS.md. Other skill-capable agents can load the file directly.

The agent needs access to the checkout, Node 20 or later and the Genesis CLI. This preview is supplied as source; npm and public GitHub publication are pending.

<div class="prompt-card">
<pre><code>Use the create-world-stream skill to build Mosslight, a forest
battle worldstream with a cream pixel interface. Let two players
take turns, ask the backend LLM for four moves per encounter,
and remember their inventory, health and progress. Give me a
working local preview and an exportable world.</code></pre>
<button type="button" data-copy-prompt>Copy world-building prompt</button>
</div>

## What the agent produces

- A world manifest with settings, typed actions, tool requests and declared assets.
- A custom interface for controls, inventory, characters and scene presentation.
- An authoritative controller for state, shared rules, turns and generation requests.
- A working local preview and a validated, exportable bundle.

Describe the genre, interaction and visual style you want. The skill chooses the nearest starter and adapts its mechanics to your idea. Your chosen model provider remains yours.

## Local prototype to live worldstream

Prepared fixtures make the interaction loop available immediately. The stock runner includes an arena move fixture; other structured responses need a matching local provider fixture.

With a configured provider and authorized budget, the agent can generate and attach images, audio and video. The [Worldstreams API](integration.md) connects those services through one Sequencer server key. You can also [bring your own models](providers.md).

The skill validates the project, exports its assets and exercises the controls, repeated turns, actor permissions and mobile layout. It reports the actual local result or saved draft and any live-provider behavior still to verify.

## Read or download the skill

The skill is included with the Apache 2.0 licensed framework. <a href="skills/create-world-stream/SKILL.md" download>Download SKILL.md</a> to load it in your agent alongside the checkout. The full authoring instructions appear below.

<section class="hero">
<div>
<p class="hero-label">Open source World Model game engine</p>

# Create infinite experiences, in minutes.

Give your World Model a memory, an inventory and a playable interface. GENESIS is the dungeon master for your worldstream: it remembers the world, applies the rules and connects player actions to generated scenes.

<div class="hero-actions"><a class="button primary" href="getting-started.html">Build your first world</a><a class="button" href="agent-skill.html">Create from one prompt</a></div>
<p class="hero-note">Apache 2.0 licensed. Bring your own models, or connect the Worldstreams API with one server key.</p>
</div>
<img src="assets/genesis-worlds.svg" alt="Three pixel worlds: a floating forest, a castle arena and a lunar outpost" width="1280" height="360">
</section>

## Your World Model needs a dungeon master.

In a tabletop game, the dungeon master remembers what you carry, who you met and what changed. GENESIS gives infinite experiences that same foundation. Your controller owns the facts; your LLM and World Model receive the context for what happens next.

<div class="feature-grid">
<section><h3>World memory</h3><p>Persist inventory, health, quest flags, locations and character relationships in structured state.</p></section>
<section><h3>Playable worlds</h3><p>Build custom interfaces, authoritative turns, player seats and crowd decisions around generated scenes.</p></section>
<section><h3>Connected generation</h3><p>Validate LLM replies, track asynchronous jobs and carry real scene checkpoints into the next moment.</p></section>
</div>

## Describe any world. Start with one prompt.

The included **create-world-stream skill** helps a coding agent turn your idea into a working prototype: world settings, a custom interface, controller rules, assets and an exportable bundle.

<div class="prompt-card">
<pre><code>Use the create-world-stream skill to build Mosslight, a forest
battle worldstream with a cream pixel interface. Let two players
take turns, ask the backend LLM for four moves per encounter,
and remember their inventory, health and progress. Give me a
working local preview and an exportable world.</code></pre>
<button type="button" data-copy-prompt>Copy world-building prompt</button>
</div>

Start with labeled fixtures for a local prototype. Connect your chosen models and a generation budget for live media. [Learn the agent workflow](agent-skill.html).

## Rick and Morty, together in one worldstream

Watch the multiplayer example: Rick and Morty have their own character controls, and both actions feed the shared experience.

<figure class="demo-feature">
<video controls playsinline preload="none" poster="assets/rick-morty-multiplayer.webp" aria-label="Rick and Morty multiplayer Worldstream">
<source src="https://sequencer.media/demo/worlds/multiplayer-demo-cropped-v2.mp4" type="video/mp4">
<a href="https://sequencer.media/demo/worlds/multiplayer-demo-cropped-v2.mp4">Watch the multiplayer Rick and Morty video</a>
</video>
<figcaption>Recorded Worldstreams example. <a href="demos.html">Explore all demos</a>.</figcaption>
</figure>

## Three files. Your whole world.

```text
my-world/
├── genesis.json      World settings, actions, tools and assets
├── interface.html    Your interface and player controls
├── controller.js     World memory, rules and backend requests
└── assets/           Images, audio and video that travel with you
```

GENESIS coordinates the world; connected providers generate media. Your host supplies identity, storage, credentials and spending policy. [Start building](getting-started.html).

## Choose your connection

| Worldstreams API | Your own World Models |
| --- | --- |
| One Sequencer server key connects LLM tools, media generation, assets and managed worldstream APIs. | Choose your LLM and World Model, then register their server-side adapters. |
| [Connect Worldstreams](integration.html) | [Connect your own providers](providers.html) |

The source is **Apache 2.0 licensed**. Version 0.1 is an unpublished development preview, being polished for launch. [Read the license](license.html), [contribute](contributing.html) or [explore the SDK API](api.html).

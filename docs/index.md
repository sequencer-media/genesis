<section class="hero">
<div>
<p class="hero-label">Open source World Model engine</p>

# Create infinite experiences, in minutes.

## Your World Model needs an engine.

GENESIS gives generated worlds memory, rules and controls. It tracks your inventory, characters and locations, then connects each player action to what happens next.

</div>
</section>

Rick and Morty have their own character controls, and both actions feed the shared experience. Watch the multiplayer Worldstream.

<figure class="demo-feature" id="worldstreams-in-action">
<video controls playsinline preload="none" poster="assets/rick-morty-multiplayer.webp" aria-label="Rick and Morty multiplayer Worldstream">
<source src="https://sequencer.media/demo/worlds/multiplayer-demo-cropped-v2.mp4" type="video/mp4">
<a href="https://sequencer.media/demo/worlds/multiplayer-demo-cropped-v2.mp4">Watch the multiplayer Rick and Morty video</a>
</video>
<figcaption>Recorded Worldstreams example. <a href="demos.html">Explore all demos</a>.</figcaption>
</figure>

<div class="demo-gallery">
<section class="demo-card">
<video controls playsinline preload="none" poster="assets/adventure-time-worldstream.webp" aria-label="Adventure Time Worldstream, Land of Ooo">
<source src="https://sequencer.media/demo/worldstreams/adventure-time/adventure-time-720p-0bfe8c425454.mp4" type="video/mp4">
<a href="https://sequencer.media/demo/worldstreams/adventure-time/adventure-time-720p-0bfe8c425454.mp4">Watch the Adventure Time video</a>
</video>
<div class="demo-caption"><h3>Adventure Time · Land of Ooo</h3><p>A fantasy journey with audience-choice controls around prepared World Model scenes.</p><a href="https://sequencer.media/demo/worldstreams/adventure-time">Try the preview player</a></div>
</section>
<section class="demo-card">
<video controls playsinline preload="none" poster="assets/world-model-games.webp" aria-label="World Model games example">
<source src="https://sequencer.media/landing/product-demos/world-games-v03-720p.mp4" type="video/mp4">
<a href="https://sequencer.media/landing/product-demos/world-games-v03-720p.mp4">Watch the World Model games video</a>
</video>
<div class="demo-caption"><h3>World Model games</h3><p>Explore playable World Model experiences in this recorded product demo.</p><a href="https://sequencer.media/landing/product-demos/world-games-v03-720p.mp4">Open video</a></div>
</section>
</div>

## What GENESIS handles

You define the experience. GENESIS runs the state and interaction loop around your connected models.

<ul class="feature-list">
<li><strong>World memory</strong><span>Remember choices, quest progress and relationships from one turn to the next.</span></li>
<li><strong>Inventory and variables</strong><span>Track items, health, scores and resources using your world's rules.</span></li>
<li><strong>Characters and locations</strong><span>Keep your cast, places and scene facts organized for the next generation request.</span></li>
<li><strong>LLM prompts and replies</strong><span>Pass world context to your LLM and validate structured moves, dialogue and choices.</span></li>
<li><strong>Custom interfaces</strong><span>Build player controls, inventory panels and overlays with HTML, CSS and JavaScript.</span></li>
<li><strong>Multiplayer and shared rules</strong><span>Coordinate player seats, turns and crowd votes. Keep everyone's accepted state in sync.</span></li>
<li><strong>Scene continuity</strong><span>Track generation jobs, carry the actual last frame forward and advance after playback.</span></li>
<li><strong>Portable worlds and assets</strong><span>Export your settings, interface, controller and declared media in one complete bundle.</span></li>
</ul>

## Quickstart with the Genesis skill

Give your coding agent an idea. The included **create-world-stream** skill guides it through building and checking a playable prototype.

<ol class="quickstart-steps">
<li><h3>Open Genesis in your coding agent</h3><p>Clone the repository and open its folder in your agent. The skill is included at <code>skills/create-world-stream/SKILL.md</code>. <a href="agent-skill.html#get-genesis-ready">View setup commands</a>.</p></li>
<li><h3>Describe your world</h3><p>Start with the prompt below. Change the setting, controls and visual style to make it yours.</p>
<div class="prompt-card">
<pre><code>Read skills/create-world-stream/SKILL.md and use it to build Mosslight, a forest battle worldstream with a cream pixel interface.&#10;&#10;Let two players take turns. Have the backend LLM create four moves per encounter. Remember inventory, health and progress.&#10;&#10;Start with labeled local fixtures. Validate the project, test the controls, and give me a playable local preview and a complete ZIP export.</code></pre>
<button type="button" data-copy-prompt>Copy world-building prompt</button>
</div>
</li>
<li><h3>Play, refine and export</h3><p>Open the local preview, try the controls and ask your agent for changes. Your ZIP contains the world's code and declared assets, ready to import into a compatible host.</p></li>
</ol>

Local previews use prepared responses and media. For live generation, connect the [Worldstreams API](integration.html) or [your own models](providers.html).

[Follow the full skill quickstart](agent-skill.html) · [Run a starter yourself](getting-started.html)

## What can you build?

One engine, many kinds of infinite experience. Start with a world people can play, watch, explore or learn from.

<dl class="experience-list">
<div><dt>Play</dt><dd><strong>Games, multiplayer games and creative sandboxes.</strong> Build quests, cooperative battles and worlds players can keep changing.</dd></div>
<div><dt>Watch</dt><dd><strong>Infinite TV, interactive stories and live events.</strong> Create ongoing shows and performances shaped by the audience.</dd></div>
<div><dt>Explore</dt><dd><strong>Travel experiences, social worlds and virtual showrooms.</strong> Visit destinations, meet characters and tour spaces together.</dd></div>
<div><dt>Learn</dt><dd><strong>Learning experiences, interactive history lessons and robotics training simulations.</strong> Practice languages, step into another era or connect specialist simulation tools.</dd></div>
<div><dt>Practice</dt><dd><strong>Coaching, training and rehearsal, and therapy and wellbeing.</strong> Rehearse interviews and workplace scenarios, or build practitioner-led reflection experiences.</dd></div>
</dl>

You supply the domain content, rules and any specialist tools your experience needs.

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

### Publish on Sequencer

[Open My Worlds](https://sequencer.media/worldstreams#my-worlds), sign in with your Sequencer account and create a world. Describe your idea to Spark, or import a GENESIS project in the world editor. Preview it, save it and publish it to Worldstreams.

Your existing account, workspace, assets and gems carry through creation and publishing.

### Connect from your own app

- **Worldstreams API:** Connect LLM tools, media generation, assets and managed worldstreams with one Sequencer server key. [Integration guide](integration.html).
- **Your own models:** Choose your LLM and World Model, then register their server-side adapters. [Provider guide](providers.html).

The source is **Apache 2.0 licensed**. Version 0.1 is a source preview, with npm publication and the wider launch being prepared. [Browse the repository](https://github.com/sequencer-media/genesis), [read the license](license.html), [contribute](contributing.html) or [explore the SDK API](api.html).

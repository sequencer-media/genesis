<section class="hero">
<div>
<p class="hero-label">Open source World Model engine</p>

# Create infinite experiences, in minutes.

## Your World Model needs an engine.

GENESIS remembers your inventory, characters and locations, applies the rules and connects player actions to generated scenes. It gives your World Model the memory, shared state and playable interface an infinite experience needs.

<div class="hero-actions"><a class="button primary" href="#worldstreams-in-action">Watch the demos</a><a class="button" href="agent-skill.html">Build from one prompt</a></div>
<p class="hero-note">Apache 2.0 licensed. Bring your own models, or connect the Worldstreams API with one server key.</p>
</div>
</section>

## Worldstreams in action

Rick and Morty have their own character controls, and both actions feed the shared experience. Watch the multiplayer Worldstream.

<figure class="demo-feature">
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

## What can you build?

Build worlds people can play, watch, explore, learn from and shape together.

| Experience | Imagine your worldstream |
| --- | --- |
| **Games** | Roleplaying adventures, puzzles, quests and battles that remember each choice. |
| **Multiplayer games** | Cooperative journeys, competitive arenas and shared worlds with individual player controls. |
| **Infinite TV** | Ongoing shows with recurring characters, evolving storylines and audience-directed plots. |
| **Learning experiences** | Explore science, practice languages and solve problems inside interactive worlds. |
| **Travel experiences** | Wander cities, landmarks and imagined destinations, choosing where to go next. |
| **Interactive history lessons** | Step into another era, meet its characters and explore how decisions shape events. |
| **Robotics training simulations** | Connect simulation tools to rehearse navigation, object interactions and changing environments. |
| **Therapy and wellbeing** | Practitioner-led roleplay, guided reflection and calming environments. |
| **Coaching** | Rehearse interviews, leadership and public speaking with scenarios that remember progress. |
| **Training and rehearsal** | Practice customer service, workplace scenarios and complex decisions in guided simulations. |
| **Interactive stories** | Branching mysteries, character relationships and adventures shaped by the audience. |
| **Social worlds** | Shared hangouts, community characters and places that grow with their participants. |
| **Creative sandboxes** | Design spaces, invent characters and direct scenes inside a world you can keep changing. |
| **Live events** | Audience-led performances, collective challenges and interactive broadcasts. |
| **Virtual showrooms** | Explore products, interiors and spaces through guided tours and custom interactions. |

These are directions for your next experience. You supply the domain content and rules, then connect the models or specialist tools it needs.

## What GENESIS handles

Your controller owns the world's facts. Your LLM and World Model receive the context for what happens next, and every player's interface reflects the accepted result.

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

### Create and publish with Sequencer

[Open My Worlds](https://sequencer.media/worldstreams#my-worlds), sign in with your Sequencer account and create a world. Describe your idea to Spark, or import a GENESIS project in the world editor. Preview it, save it and publish it to Worldstreams.

Your existing account, workspace, assets and gems carry through creation and publishing. Exploring these docs and watching the recorded demos is free.

### Connect from your own app

| Worldstreams API | Your own World Models |
| --- | --- |
| One Sequencer server key connects LLM tools, media generation, assets and managed worldstream APIs. | Choose your LLM and World Model, then register their server-side adapters. |
| [Connect Worldstreams](integration.html) | [Connect your own providers](providers.html) |

The source is **Apache 2.0 licensed**. Version 0.1 is a source preview, with npm publication and the wider launch being prepared. [Browse the repository](https://github.com/sequencer-media/genesis), [read the license](license.html), [contribute](contributing.html) or [explore the SDK API](api.html).

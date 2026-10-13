# Architecture

Genesis is a portable runtime and project format. A world has a browser interface, a synchronous sandboxed server controller, accepted state and asynchronous host effects. The host owns authentication, provider credentials, permissions, spending, publication and storage. Sequencer implements that host with managed media, LLM requests, versioned assets and stream infrastructure.

## A universal World Model Context Protocol

The GENESIS Context Engine connects structured world state, settings and player actions to your World Model. It defines the shared contract for model requests and accepted results. The tinted LLM, World Model and optional image model are external services connected through host adapters. Streaming delivery returns generated video to the player's interface.

<p class="diagram-hint">Scroll the diagram horizontally to explore the full loop.</p>
<figure class="world-flow">
<div class="world-flow-scroll" role="region" aria-label="GENESIS modular World Model flow diagram" tabindex="0"><img src="assets/genesis-world-context.svg" alt="Memory, scenes, inventory, multiplayer and settings feed the GENESIS Context Engine, which connects to an external World Model and LLM. An optional image model takes LLM prompts and supplies image inputs to the World Model. Streaming delivery returns generated video to the UI." width="960" height="760" loading="lazy"></div>
<figcaption>Use the GENESIS modules your project needs. Connect external models through host adapters.</figcaption>
</figure>

### Optional image generation

A project can declare a boolean setting in `definition.genesis.configSchema`, then read it through `context.config.settings` to decide when its controller emits `image.request`. Declare the capability in the project and grant it on the host. The host adapter connects the image provider and enforces permissions and spending limits.

The LLM can supply a bounded image prompt. Validate that reply, request the image and wait for `job.ready` before using its accepted image or anchor in the next scene request. This makes image generation a settings-controlled branch of the context loop. The World Model adapter must support the image input your project uses.

## The action and generation loop

```
Viewer action -> authenticated host -> controller -> committed state
                                         |
                                    bounded effect
                                         |
                               provider / backend LLM
                                         |
                              validated job.ready data
                                         |
                                    controller -> UI
```

The same LLM service can return both a video prompt and structured scene facts. Validate the structured result before accepting it. A director describes the committed game outcome; it cannot rewrite health, payments or eligibility. A generated battle move set is installed once for its battle. The effect's guard cancels obsolete results after player replacement. A video result becomes playable only after an actual end-frame checkpoint. A live-direction receipt acknowledges queued delivery, not playback completion.

One server worker advances each shared hosted session under a durable lease. Viewer reads return accepted state and renew throttled presence. They do not independently poll the provider. Cloud Tasks retries failures; a busy worker returns a retryable failure. Durable provider records and stable request IDs survive process loss. Ambiguous paid submissions require reconciliation instead of issuing another charge. These are scoped guarantees, not a promise of exactly-once behavior from arbitrary providers.

SDK memory/file adapters support one host process. Distributed creators provide transactional storage, job admission and durable scheduling. Never run the loopback authoring server on the public internet. Host adapters validate capabilities independently of the project's requests.

Relative paths identify portable assets. ZIP import enforces safe paths, supported media, declared sizes, duplicate detection and bounded decompression. Sequencer uploads owned media, copies immutable version assets and serves host-controlled URLs. The portable registry and inert reference metadata support downloading a complete bundle later. New saves reuse uploads within a SequencerClient instance; multi-instance upload caching is a creator storage choice.

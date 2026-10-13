# Architecture

Genesis is a portable runtime and project format. A world has a browser interface, a synchronous sandboxed server controller, accepted state and asynchronous host effects. The host owns authentication, provider credentials, permissions, spending, publication and storage. Sequencer implements that host with managed media, LLM requests, versioned assets and stream infrastructure.

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

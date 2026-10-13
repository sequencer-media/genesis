# Compatibility and growth

Genesis can continue to evolve after publication. Releases use semantic versioning. Project format 1, participation 1, bounded tool contracts and asset registry fields are versioned independently. Existing format-1 projects without assets or LLM capabilities remain valid. Unknown fields fail visibly; hosts advertise capabilities and supported cadence instead of silently promising unsupported behavior.

Keep new provider integrations in adapters. Add optional capabilities before making a host depend on them. Extensions are bounded inert data and grant no authority. A host pins controller/interface versions for a session, and new drafts affect new sessions. Maintain supported version fixtures and round-trip tests. Breaking format changes require an explicit migration and a major release; do not mutate existing session rules halfway through a game.

This source preview runs CI on Node 20 and 22 in [sequencer-media/genesis](https://github.com/sequencer-media/genesis). npm publication is disabled with private:true until an authorized package release. GitHub repository visibility is managed separately. Keep commercial account records, operational credentials and deployment settings outside the repository.

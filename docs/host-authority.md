# Host authority

Creator code owns rules, scores, UI, turns, votes, story behavior and declared project settings. Manifest capabilities are requests. GenesisHostPolicy supplies independent host grants and ceilings; a manifest cannot raise them.

The deployment owns authentication and actor admission, content policy, storage access, resource admission, billing, wallet state and verified purchases. GenesisHostServices exposes authorization and action-moderation hooks. GenesisMeteringAdapter describes authoritative viewer admission/release integration. A host calls these from its own viewer infrastructure, not from controller-provided times. Sequencer's shared hourly gem pool, split across active authenticated viewers, stays in its private host adapter.

GenesisCommerceAdapter quotes registered offers and verifies platform receipts. No controller defines prices, adds gems or asserts that a purchase succeeded. Host quote/confirmation/charge infrastructure remains external. The portable preview does not implement a wallet or a commerce UI.

Keep required billing, exit and reconnect controls outside creator iframes. Filter participant-private state and omit server state from view broadcasts. Public metadata and configuration are not secret storage. Diagnostics are restricted to authors/operators.

The local runner binds loopback, issues actor tokens, checks same-origin writes, and rejects unsupported file paths. It deliberately supports simulated actor switching for authoring. Replace this with your own authenticated routes before exposing a host to the internet.

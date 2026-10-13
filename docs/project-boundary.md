# Project, product and host

Genesis is a portable project contract. It can run inside a hosting product or the standalone reference runner.

| Layer | Owns |
| --- | --- |
| Genesis project | Metadata, assets, interface, controller, participation, action contracts, stream defaults, content preferences, requested capabilities and budgets. |
| Hosting product | Ownership, collaborators, publication/discovery, avatar account connections, chat membership/moderation, offers, prices and payouts. |
| Host policy/services | Credentials, model access, granted tools, resource ceilings, required safety checks, authoritative metering, wallets and verified receipts. |

Requested settings are validated independently of grants. Importing a project does not replace product permissions or grant new host capabilities. Unknown manifest fields are rejected. Namespaced extensions preserve bounded configuration and have no execution or permission semantics.

Hosts can impose narrower limits. Worldstreams currently supports 100-character titles, 280-character listing descriptions and 14-second continuous stream chunks. Unsupported values are rejected before saving, while the portable project contract remains independent of those product limits.

The three entry points are genesis.json, interface.html and controller.js. HTML may include browser JavaScript for local interactions. Shared world logic executes in the isolated controller. A viewer interface submits actions, while the controller commits outcomes and requests host effects. Larger projects may compile multiple modules into those entry points; the file loader accepts contained relative source references. The editor's current archive importer uses the three canonical root filenames.

Starter selection, validation and import/export are authoring actions. They are not runtime settings. Export archives include the JSON Schema to support ordinary JSON editors. Assets remain HTTPS or local /assets references. Transfer local media with the project, and upload it before importing into a host that requires hosted media. Archives with separately connected host game packages cannot be exported as runnable standalone games until that behavior is moved into the project files.

A purchase is a host-verified event, not a browser assertion. Viewer admission and metering come from host infrastructure. Implement deployment adapters using platformHooks.ts and the host authorization service. The portable package includes those interfaces; it does not provide a payment processor or a viewer wallet.

The project version and existing event/action/effect contract define compatibility. Additive APIs need compatibility tests and documentation. Breaking contract changes require a new version. JSON Schema is the manifest tooling contract; runtime semantic validation also checks cross-references and spending limits. This development preview has not established a public governance process or a standards-body endorsement.

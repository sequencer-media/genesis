# Contributing

Use Node 20 or later. Run `npm ci` and `npm test` from this directory.

Use the [bug report or feature request forms](https://github.com/sequencer-media/genesis/issues/new/choose) to describe reproducible behavior or a concrete creator workflow. For a pull request, fork the repository, create a branch and keep the change focused. Include the relevant checks and an example when it introduces a new programming pattern.

The documentation site is built from the Markdown guides, the README and the bundled authoring skill. Run `npm run docs:build` after editing them, or `npm run docs:dev` for a local browser preview. Commit the generated HTML with its source changes. The build checks local links and section anchors. Keep demos clearly labeled as recorded examples.

The hosted site lives at [sequencer.media/genesis](https://sequencer.media/genesis). Check this deployment mode with `npm run docs:build -- --out .genesis-site --base-path /genesis/`. Site navigation stays under that path; creation links reuse Sequencer's existing My Worlds editor and sign-in. Keep portable SDK examples available for creators using their own hosts.

Keep the runtime independent of a deployment, provider or framework. Host adapters own credentials, identity, purchases, content policy and resource grants. Project manifests only request capabilities.

A change to actions, controller context, state views, jobs or playback events needs a compatibility test and an API changelog entry. Add a runnable example for a new programming pattern. Preserve private state filtering and server authority.

Open an issue before adding a dependency or changing the project format. Pull requests should explain the behavior and include relevant tests. Contributions use Apache 2.0. Maintainers review contributions and publish releases; no community governance or support SLA is implied by this preview.

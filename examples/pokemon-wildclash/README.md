# Pokémon Wildclash

The portable version of the Pokémon Worldstream: the current battle controller, pixel interface and live-action scene settings, with bundled start artwork. It includes the eight original-generation species, private command rounds, type effects, status, PP, items, trainer seats, a challenger queue and the PLAY BOTH testing control.

## Play locally

From the repository root:

```sh
npm ci
npm run build
node dist/cli.js dev examples/pokemon-wildclash
```

Open the printed URL. Choose a trainer or PLAY BOTH, choose a Pokémon and press SEND OUT. Each trainer commits one command per round. The preview uses the real rules and prepared fixtures. Continuous video directions complete as simulated playback, so this mode tests the game without generation charges. The bundled image supplies the scene background.

To test separate browser connections against a shared server:

```sh
npm run serve:world
```

Open the server URL in two browser windows and enter a different printed player token in each. The [server example](../server/README.md) explains persistence, authentication and provider configuration.

## Project files

- `genesis.json` declares the actions, player seats, visual settings and local asset.
- `interface.html` is the same interface used by the Worldstream.
- `controller.js` is the same authoritative battle controller used by the Worldstream.
- `assets/start.png` is the clean initial scene and cover artwork.
- `BATTLE.md` describes the battle rules and the hosted stream's presentation contract.

The source controller and interface are copied without modification. The portable manifest replaces hosted media URLs with local paths. Workspace records, deployment settings and account data stay outside this example.

## Connect generated video

The manifest requests `live.direction` and background images. A continuous provider must deliver accepted directions to its running stream, maintain idle animation, supply observed playback completion, and integrate stream presentation with your frontend. The hosted Worldstream implements that adapter. The basic server supplies the shared game state and provider hooks; its default fixtures simulate directions.

The camera looks downward 65 degrees, holding the near red Pokémon in the lower-left quadrant and the more distant blue Pokémon in the upper-right. Each occupied side has one Pokémon, at most two total. Attacks use explosive acceleration, brilliant elemental effects and weighted recovery. Fresh start frames prepare each round and every 30 seconds during idle, then cut in at safe boundaries. Preparing messages and the matchup banner sit at the top. Combat media fills the viewer, including providers with slightly different aspect ratios. A knockout is followed by a full lingering shot, then a separate slow Poké Ball recall. The next challenger enters after observed recall playback, with bounded failure and timeout fallbacks. Generated setup and fainting frames prepare ahead of events and reanchor only at safe boundaries. Ordinary moves preserve scene continuity. Read [BATTLE.md](BATTLE.md) and the [provider guide](../../docs/providers.md) before replacing the fixture provider.

## Validate and test

```sh
node dist/cli.js validate examples/pokemon-wildclash
node --test examples/pokemon-wildclash/*.test.mjs
node dist/cli.js export examples/pokemon-wildclash --out pokemon-wildclash.zip
```

`npm test` also runs these regressions. The export contains the complete project and declared artwork.

Maintainers can refresh the public example from the authored Worldstream directory:

```sh
node scripts/sync-pokemon-world.mjs /path/to/worlds/pokemon-wildclash
```

The sync copies the controller, interface, artwork and project tests, and rebuilds the portable manifest. Run `npm test` afterward.

Attack damage defaults to 40% of the underlying formula, with a 30% full-HP cap per hit. These settings keep battles going for more rounds. The winning trainer and Pokémon remain sent out and ready on their existing side while the next challenger joins. The [MCP adapter](../../docs/mcp.md) exposes the declared moves, items and seat controls to agents, plus optional author tools for cached images and live scene changes.

# World memory, inventory and characters

A World Model receives the context for its next scene. GENESIS stores the facts that make that scene part of the same experience: what players carry, where they are, who they met and which decisions changed the world.

## Define your world's facts

The controller state is JSON. Choose the structure that fits your world. For example:

```json
{
  "location": "mosslight_gate",
  "inventory": ["brass_key", "healing_herb"],
  "health": 90,
  "quests": {"find_the_lighthouse": "active"},
  "locations": {
    "mosslight_gate": {"visited": true, "doorUnlocked": false}
  },
  "characters": {
    "keeper": {"name": "Mira", "relationship": "trusted"}
  }
}
```

This is an example state shape. Your controller defines the inventory rules, character behavior, location transitions and values your interface displays.

## Public, private and server state

| State | Use it for |
| --- | --- |
| public | Shared inventory, visible characters, location and game progress. |
| private | A participant's hidden information. The host filters the view by actor. |
| server | Internal encounter IDs, generation guards and facts the controller needs to keep off the public view. |

The host persists accepted state with the session. Memory and file adapters support one host process; production hosts choose storage for their deployment. This preview bounds session state to 200 KB. Long histories and external memory stores belong in host adapters.

## Resolve the action first

When a player uses the brass key, the controller checks the accepted inventory and current location. It commits the unlocked door to state, then requests a scene describing that outcome.

1. The interface submits a declared, typed action.
2. The host checks actor eligibility and the current input window.
3. The controller commits the inventory and location changes.
4. A bounded backend request carries the outcome and relevant world context.
5. Validated results return to the controller and update the accepted view.

The LLM can describe a character's response or propose structured choices. Your rules remain the authority for inventory, health, access and turn order.

## Keep generated data structured

For generated moves, dialogue or choices, use `tool.llm.generate` with a bounded object response schema. Choose fields such as name, description and permitted numeric attributes. Render model text as text in the interface.

Use an encounter or scene guard so an old LLM result cannot replace the current decision. The [arena-llm starter](getting-started.md) generates four moves once per encounter. See [structured LLM helpers](api.md#structured-llm-and-asset-helpers).

## Give the next scene the right context

Scene requests can carry intent, a required outcome, an anchor and a spending ceiling. Include the facts that matter for this scene rather than sending every stored detail.

Carry the actual decoded end frame into the next video request. Generation completion and playback completion are separate events. Reopen visual actions after the host accepts playback completion.

GENESIS keeps the state and job lifecycle consistent. Visual fidelity depends on the connected World Model. [Read the controller API](api.md#controller) and [architecture](architecture.md).

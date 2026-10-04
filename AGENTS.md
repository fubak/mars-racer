# Mars Racer

Repo-local guidance for agents. The parent workspace rules still apply.

## Continue the critic loop

The truck mesh is closed. The loop is stopped after round 916. Continue it on the rest of the game only when the user asks. Read `docs/critic-handoff.md` and `public/critic-state.json` first, then run the next round from `nextRound`.

Hard limits:

- Do not edit `src/pieces/truck.ts`. Keep the hashikemu glTF loader.
- Do not revert `src/vehicle.ts`.
- Do not send a roughness pass on the material named `body`.
- Do not measure the door row or send a builder for it. A flat run of about 104–110 pixels of rgb(111, 79, 57) is closed.
- Do not start a second writer while a piece file is already being edited.
- Judge the screenshots. A vision description that says the truck is hovering does not override the pixel measurement.
- Do not commit unless the user asks.

## Checks

`npm run typecheck` and `npm test`. Dev server is `http://127.0.0.1:5173/` on host `127.0.0.1`. Do not start a second Vite if that port is already serving the sim.

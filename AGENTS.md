# Mars Racer

Repo-local guidance for agents. The parent workspace rules still apply.

## Continue the critic loop

The user resumed the loop on 2026-10-04. Continue it when asked, or when the armed wake says to continue. Read `docs/critic-handoff.md` and `public/critic-state.json` first, then run the next round from `nextRound`.

Hard limits:

- Keep the hashikemu glTF loader in `src/pieces/truck.ts`.
- Do not revert `src/vehicle.ts`.
- Do not send a roughness pass on the material named `body`.
- Do not start a second writer while `truck.ts` is being edited.
- Do not send a builder because the door row is still about 104–110 pixels of rgb(111, 79, 57).
- Judge the screenshots. A vision description that says the truck is hovering does not override the pixel measurement.
- Do not commit unless the user asks.

## Checks

`npm run typecheck` and `npm test`. Dev server is `http://127.0.0.1:5173/` on host `127.0.0.1`. Do not start a second Vite if that port is already serving the sim.

# Critic loop handoff

Resume this only when asked to continue the critic loop. The user resumed it on 2026-10-04. Last completed round is **867** (`public/critic-state.json`, `public/progress.json`). The next round is 868.

## What the last frames showed

Side shot, parked, slip 0: a door row at y=576 is 106 pixels of rgb(111, 79, 57). The longest flat run is 343 pixels of rgb(115, 78, 49) at y=654. Tires meet the sand. A vision model will often call this a hover; the pixel run does not.

Chase shot: tailgate of the hashikemu Cybertruck, two tracks, dust, red tail lamp, about 40 m/s (measured 39.610).

That door row has stayed about 104–110 pixels of the same color for hundreds of rounds. Editing the material named `body` does not change it. Do not send a builder for that gap.

## One round

1. Confirm `http://127.0.0.1:5173/` returns 200. Do not start a second Vite.
2. `curl -s http://127.0.0.1:9222/json/list` and use the Mars Racer game tab. Do not launch Chrome on 9222. Playwright is a different browser.
3. Attach with the global `WebSocket` in Node (`node --input-type=module`). Do not `require('ws')`.
4. `Page.enable`, `Runtime.enable`, `Page.bringToFront`, navigate, wait 1800 ms, poll `window.__MARS_FRAME` up to 8 times at 400 ms, then `Page.captureScreenshot` as png into `/tmp/mars-critic-truck.png` and `/tmp/mars-critic-hero.png`.
5. Measure with Pillow, not pngjs. Image is 1920×1086 RGB. On the side shot, scan x=780–1280 at y=544, 560, 576, 600, 640, 654, 655. The door row is y=576.
6. Look at both images. Report the measured door count and the actual chase pose and speed.
7. Rewrite all of `public/progress.json`. Update `public/critic-state.json` with the new round. Copy `/tmp/mars-critic-*.png` to `public/shots/`.
8. Arm exactly one sleeper: copy the shots, `sleep 180`, then echo `AGENT_LOOP_WAKE_mars` with the prompt stored in `critic-state.json`. Do not arm a second sleeper.

Speed wording: 39.56 m/s and above is about 40 m/s. About 39.45 m/s and just under is about 39 m/s. A one-frame pose change or a parked slip near 2 is not a new builder task if the next frame returns to the tailgate and slip 0.

## Do not

- Replace the hashikemu loader in `src/pieces/truck.ts`.
- Revert `src/vehicle.ts`.
- Run a roughness pass on the material named `body`.
- Start a second writer while `truck.ts` is being edited.
- Set `model.position.y` back to `-0.42`. The mesh origin is tire contact; `model.position.y = -0.08` keeps the tires on the sand.
- Regenerate `public/textures/sand.jpg` or `rock.jpg` unless asked.
- Commit or push unless asked. A push to `main` publishes https://fubak.github.io/mars-racer/ through the Pages workflow.

## Already verified

- A and left steer toward −Z when facing +X. D and right steer toward +Z. Space is the handbrake slide. S brakes, then reverses when slow. R resets.
- Solid rocks stop the truck. Pebbles do not.
- Headlights and the slip-driven tail lamp are in the scene.
- Sand and rock photos are the Grok Imagine files already on disk.
- Credit stays visible: truck model by hashikemu, CC BY 4.0.

## Repo

Branch `main`, remote `https://github.com/fubak/mars-racer`. Published site `https://fubak.github.io/mars-racer/`. Steering, ride height, rock collision, lights, textures, tests, and the critic files are committed on `main`. `public/shots/` is gitignored.

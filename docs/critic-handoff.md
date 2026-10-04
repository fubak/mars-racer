# Critic loop handoff

The truck mesh is closed. Last completed round is **916** (`public/critic-state.json`, `public/progress.json`). The next round is 917. The loop is stopped: the user asked to commit and push after round 916, and no wake is armed. Continue only when the user asks.

## What the last frames showed

Sky shot, `?shot=sky&t=0`: the horizon row y=660 is rust on the left, average rgb(181, 150, 130), and a solid blue band on the right, 160/160 samples, average rgb(157, 178, 203). Streaks are still in the rust sky.

Terrain shot, `?shot=terrain`: one beige field. Sampled colors only span rgb(173, 151, 134) to rgb(201, 179, 161). No dune, rock, or track reads in that frame. Near sand in the chase still shows the photo.

Dust shot, `?shot=dust&t=8`: tailgate, two dark tracks, sparks, red tail lamp, slip 0, about 39 m/s (measured 39.445). The HUD frame is back at about 40 m/s (measured 39.680) and slip 0.

HUD shot, `?shot=hud&t=8`: 143 km/h, lap 1 gate 6/8, timer 0:08.2, map, and the hashikemu credit.

The door row is a closed topic. Do not measure it and do not send a builder for it.

## One round

1. Confirm `http://127.0.0.1:5173/` returns 200. Do not start a second Vite.
2. `curl -s http://127.0.0.1:9222/json/list` and use the Mars Racer game tab. Do not launch Chrome on 9222. Playwright is a different browser.
3. Attach with the global `WebSocket` in Node (`node --input-type=module`). Do not `require('ws')`.
4. `Page.enable`, `Runtime.enable`, `Page.bringToFront`, navigate, wait 1800 ms, poll `window.__MARS_FRAME` up to 8 times at 400 ms, then `Page.captureScreenshot` as png into `/tmp/mars-critic-sky.png`, `/tmp/mars-critic-terrain.png`, `/tmp/mars-critic-dust.png`, and `/tmp/mars-critic-hud.png`.
5. Measure with Pillow, not pngjs. Image is 1920×1086 RGB. On the sky shot, compare x=0–320 and x=1600–1920 at y=660. On the terrain shot, record min and max color. Do not scan the door row.
6. Look at all four images. Report the sky band, whether the terrain overview is still flat, and the dust pose and HUD readout.
7. Rewrite all of `public/progress.json`. Update `public/critic-state.json` with the new round. Copy `/tmp/mars-critic-*.png` to `public/shots/`.
8. Arm exactly one sleeper: copy the shots, `sleep 180`, then echo `AGENT_LOOP_WAKE_mars` with the prompt stored in `critic-state.json`. Do not arm a second sleeper.

Speed wording: 39.56 m/s and above is about 40 m/s. About 39.45 m/s and just under is about 39 m/s.

## Do not

- Edit `src/pieces/truck.ts` or replace the hashikemu loader.
- Revert `src/vehicle.ts`.
- Run a roughness pass on the material named `body`.
- Measure or rebuild the door row. A flat run of about 104–110 pixels of rgb(111, 79, 57) is closed.
- Start a second writer while a piece file is already being edited.
- Set `model.position.y` back to `-0.42`. The mesh origin is tire contact; `model.position.y = -0.08` keeps the tires on the sand.
- Regenerate `public/textures/sand.jpg` or `rock.jpg` unless asked.
- Commit or push unless asked. A push to `main` publishes https://fubak.github.io/mars-racer/ through the Pages workflow.

## Already verified

- A and left steer toward −Z when facing +X. D and right steer toward +Z. Space is the handbrake slide. S brakes, then reverses when slow. R resets.
- Solid rocks stop the truck. Pebbles do not.
- Headlights and the slip-driven tail lamp are in the scene.
- Sand and rock photos are the Grok Imagine files already on disk.
- Credit stays visible: truck model by hashikemu, CC BY 4.0.
- HUD speed matches the chase: about 39.6 m/s reads as 143 km/h.

## Repo

Branch `main`, remote `https://github.com/fubak/mars-racer`. Published site `https://fubak.github.io/mars-racer/`. `public/shots/` is gitignored.

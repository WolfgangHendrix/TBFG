# ICHIGEKI 一撃 — One Strike

A turn-based one-hit-kill samurai duel for the browser. Two samurai fight for
their lord on a battlefield at dusk. Rock-paper-scissors backbone with a
block-token mind game on top.

## Rules

- **JUMP kills CROUCH · CROUCH kills LUNGE · LUNGE kills JUMP**
- Both fighters pick simultaneously; the exchange plays out as one clash.
- First to **2 round wins** takes the duel. Same move = draw, replay.
- Each samurai carries **one BLOCK per duel**. Arm it alongside your attack:
  - If you would have died, the block turns the round into a draw (replayed).
  - If you won or drew anyway, the block is wasted.
  - Either way it is consumed — when you burn it is the real decision.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8000
# then visit http://localhost:8000
```

Controls: click the move buttons, or keys `1` (jump) / `2` (lunge) /
`3` (crouch) and `B` to arm the block.

## Project layout

```
index.html          shell + DOM UI (title, HUD, move panel, banners)
css/style.css       all styling
js/logic.js         pure game rules — no DOM, reusable by a future MP server
js/ai.js            opponent AI (recency-weighted prediction + counter)
js/fx.js            synthesized sound (WebAudio), particles, shake, flash
js/main.js          rendering, animation choreography, match flow, input
assets/images/      source art (background, character turnaround sheets)
assets/sprites/     auto-cut character views (front/side/back, transparent)
tools/cut_sprites.ps1   regenerates assets/sprites from the sheets
```

## Updating the character art

Drop new turnaround sheets (3 views on a white background) over
`assets/images/tbfg_p1_00.png` / `tbfg_p2_00.png`, then:

```
powershell -ExecutionPolicy Bypass -File tools/cut_sprites.ps1
```

It strips the white background (edge flood-fill, so white costume parts
survive), finds the three figures, and saves tight-cropped transparent PNGs.

## Publishing to itch.io

1. Zip the contents of this folder (`index.html` must be at the zip root;
   include `css/`, `js/`, `assets/` — `tools/` is optional).
2. New project → *Kind of project: HTML* → upload the zip and tick
   **"This file will be played in the browser"**.
3. Set viewport to **1280 × 720**. Fullscreen button recommended.

## Roadmap

- [ ] Online multiplayer (logic.js is already pure/deterministic for this)
- [ ] Real attack-pose sprites per move (current animation is transform-based)
- [ ] Local two-player (pass-and-play with hidden picks)
- [ ] Music loop, more SFX variety

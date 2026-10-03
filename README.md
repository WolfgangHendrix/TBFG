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

## Animation workshop

Open `http://localhost:8000/tools/animation-editor.html` while serving the
project from its root folder. The workshop lets you scrub and play poses,
adjust pose scale and foot anchor, and compare each pose against the combat
idle. Keep the game and workshop open at the same host and port, then choose
**Save to game live** to share adjustments with the running game. Export JSON
to back up or move calibration settings to another browser. The current P1
and P2 calibrations are included in project defaults, so they apply after reload.
Both fighters use a shared 80% overall size multiplier before their pose
corrections. Frame durations in the workshop set each pose's timing share
inside the synchronized attack, so both fighters still arrive at the clash
together. Side idle and combat idle use paired hand-drawn inhale/exhale frames;
those frames inherit the parent pose's scale and foot anchor to keep breathing
from changing character size.

The jump and crouch sequences now have three authored poses for both fighters.
Open a pose directly with query parameters, for example
`?fighter=p1&sequence=jump&frame=1` or
`?fighter=p2&sequence=crouch&frame=1`.

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
assets/clean/       calibrated poses, generated action in-betweens, idle breathing
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

To compare the visible size of every pose, run:

```
python tools/analyze_animation_scale.py
```

This writes a calibrated contact sheet and CSV using the game defaults. To
audit the exact values from the workshop, pass its exported JSON file:

```
python tools/analyze_animation_scale.py tbfg-animation-calibration.json
```

The battlefield uses a cloudless sunset plate with independent, moving far and
near cloud layers, wind-swaying cloth banners, coordinated field grass, drifting
smoke and embers, motes, and a slow sunlit shimmer. On a draw, the fighters recover at the clash point and the next
exchange starts there, keeping the roshambo exchanges face-to-face.

This writes `reports/animation_scale.png` (poses rendered at each fighter's
fixed source-pixel scale, with side idle matched to combat-ready height) and
`reports/animation_scale.csv` (source bounds and predicted visible heights).

## Publishing to itch.io

1. Zip the contents of this folder (`index.html` must be at the zip root;
   include `css/`, `js/`, `assets/` — `tools/` is optional).
2. New project → *Kind of project: HTML* → upload the zip and tick
   **"This file will be played in the browser"**.
3. Set viewport to **1280 × 720**. Fullscreen button recommended.

## Roadmap

- [ ] Online multiplayer (logic.js is already pure/deterministic for this)
- [ ] Add authored block, recoil, and defeat animation cycles
- [ ] Local two-player (pass-and-play with hidden picks)
- [ ] Music loop, more SFX variety

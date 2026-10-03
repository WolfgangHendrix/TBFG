"""Audit the rendered height and foot alignment of every live animation pose."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "assets" / "clean"
REPORTS = ROOT / "reports"
CHAR_HEIGHT = 330
GLOBAL_SCALE = 0.8
SHEET_HEIGHT = 196
CELL_W, CELL_H, COLUMNS = 380, 254, 4

# Keep these in sync with CALIBRATION_DEFAULTS in js/main.js. Exported editor
# JSON can be passed on the command line to audit the user's current values.
POSE_SCALES = {
    "p1": {
        "idle": 1.33244, "idle_fwd": 1.32, "jump_0": 1.25, "jump_mid": 1.0748,
        "jump_1": 1.17, "crouch_0": 0.89, "crouch_mid": 0.9172, "crouch_1": 1,
        "lunge_0": 0.8925, "lunge_mid": 1.1015, "lunge_1": 0.9405,
        "block": 1.19, "idle_fight": 1.06, "blockknock": 1.04,
    },
    "p2": {
        "idle": 1.33244, "idle_fwd": 1.3465, "defeat": 0.9625,
        "jump_0": 1.2757, "jump_mid": 1.191, "jump_1": 1.2453,
        "crouch_0": 1.0599, "crouch_mid": 0.9661, "crouch_1": 1.0501,
        "lunge_0": 0.9306, "lunge_mid": 1.086, "lunge_1": 0.9928,
        "block": 1.0907, "idle_fight": 0.9943, "blockknock": 1.0848,
    },
}

LIVE_POSES = {
        "idle.png": "idle",
        "idle_breathe_out.png": "idle_breathe_out",
        "idle_breathe_in.png": "idle_breathe_in",
        "idle_fight.png": "idle_fight",
        "idle_fight_breathe_out.png": "idle_fight_breathe_out",
        "idle_fight_breathe_in.png": "idle_fight_breathe_in",
    "idle_fwd.png": "idle_fwd",
    "block_00.png": "block",
    "blockknockback_00.png": "blockknock",
    "defeated_00.png": "defeat",
        "jump_00.png": "jump_0",
        "jump_mid_v1.png": "jump_mid",
        "jump_01.png": "jump_1",
    "crouch_00.png": "crouch_0",
    "crouch_mid_v1.png": "crouch_mid",
    "crouch_01.png": "crouch_1",
    "lunge_windup_v2.png": "lunge_0",
    "lunge_drive_v2.png": "lunge_mid",
    "lunge_follow_v2.png": "lunge_1",
}


def read_calibration(path: Path | None) -> tuple[float, dict[str, dict[str, dict[str, float]]]]:
    scale = GLOBAL_SCALE
    poses = {fighter: {name: {"scale": value} for name, value in entries.items()}
             for fighter, entries in POSE_SCALES.items()}
    if path is None:
        for fighter in ("p1", "p2"):
            poses[fighter]["idle_breathe_out"] = poses[fighter]["idle"]
            poses[fighter]["idle_breathe_in"] = poses[fighter]["idle"]
            poses[fighter]["idle_fight_breathe_out"] = poses[fighter]["idle_fight"]
            poses[fighter]["idle_fight_breathe_in"] = poses[fighter]["idle_fight"]
        return scale, poses
    saved = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(saved.get("globalScale"), (int, float)):
        scale = float(saved["globalScale"])
    for fighter in ("p1", "p2"):
        if not isinstance(saved.get(fighter), dict):
            continue
        for state, values in saved[fighter].items():
            if isinstance(values, dict) and isinstance(values.get("scale"), (int, float)):
                poses[fighter].setdefault(state, {})["scale"] = float(values["scale"])
    for fighter in ("p1", "p2"):
        # Breathing art always inherits its parent idle pose transform.
        for state in ("idle_breathe_out", "idle_breathe_in"):
            poses[fighter][state] = poses[fighter]["idle"]
        for state in ("idle_fight_breathe_out", "idle_fight_breathe_in"):
            poses[fighter][state] = poses[fighter]["idle_fight"]
    return scale, poses


def live_frames() -> list[tuple[str, str, str, Path]]:
    frames = []
    for fighter_id in ("p1", "p2"):
        for filename, state in LIVE_POSES.items():
            path = ART / f"tbfg_{fighter_id}_{filename}"
            if path.exists():
                frames.append((fighter_id, "AKAONI" if fighter_id == "p1" else "KUROGANE", state, path))
    return frames


def records(calibration_path: Path | None) -> tuple[list[dict[str, object]], float]:
    global_scale, pose_scales = read_calibration(calibration_path)
    result = []
    for fighter_id, fighter, state, path in live_frames():
        image = Image.open(path).convert("RGBA")
        bounds = image.getchannel("A").getbbox()
        if not bounds:
            continue
        left, top, right, bottom = bounds
        visible_height = bottom - top
        reference = Image.open(ART / f"tbfg_{fighter_id}_idle.png").convert("RGBA")
        reference_canvas_height = reference.height
        combat = Image.open(ART / f"tbfg_{fighter_id}_idle_fight.png").convert("RGBA")
        combat_bounds = combat.getchannel("A").getbbox()
        combat_height = combat_bounds[3] - combat_bounds[1]
        source_to_screen = CHAR_HEIGHT / reference_canvas_height
        adjustment = pose_scales[fighter_id].get(state, {}).get("scale", 1.0)
        visible_screen_height = visible_height * source_to_screen * global_scale * adjustment
        combat_scale = pose_scales[fighter_id].get("idle_fight", {}).get("scale", 1.0)
        baseline_height = combat_height * source_to_screen * global_scale * combat_scale
        result.append({
            "file": path.name,
            "fighter": fighter,
            "state": state,
            "width": right - left,
            "height": visible_height,
            "alpha_bounds": f"{left},{top},{right},{bottom}",
            "pose_scale": adjustment,
            "global_scale": global_scale,
            "source_to_screen_scale": source_to_screen * global_scale * adjustment,
            "visible_height_px": round(visible_screen_height, 1),
            "combat_idle_height_px": round(baseline_height, 1),
            "height_change_pct": round((visible_screen_height / baseline_height - 1) * 100, 1),
            "foot_anchor_y": bottom,
            "reference_canvas_height": reference_canvas_height,
            "image": image.crop(bounds),
        })
    return result, global_scale


def make_sheet(rows: list[dict[str, object]]) -> Image.Image:
    font = ImageFont.load_default()
    groups = []
    for fighter in ("AKAONI", "KUROGANE"):
        group = [row for row in rows if row["fighter"] == fighter]
        groups.extend((fighter, group[i:i + COLUMNS]) for i in range(0, len(group), COLUMNS))
    sheet = Image.new("RGB", (CELL_W * COLUMNS, CELL_H * len(groups)), (42, 35, 29))
    draw = ImageDraw.Draw(sheet)
    for row_index, (fighter, group) in enumerate(groups):
        y0 = row_index * CELL_H
        draw.text((8, y0 + 4), fighter, font=font, fill=(255, 214, 140))
        for col, item in enumerate(group):
            x0 = col * CELL_W
            scale = (SHEET_HEIGHT / CHAR_HEIGHT) * item["source_to_screen_scale"]
            thumb = item["image"].resize((round(item["image"].width * scale), round(item["image"].height * scale)), Image.Resampling.LANCZOS)
            x = x0 + (CELL_W - thumb.width) // 2
            foot_y = y0 + 29 + SHEET_HEIGHT
            sheet.paste(thumb, (x, foot_y - thumb.height), thumb)
            draw.line((x0 + 10, foot_y, x0 + CELL_W - 10, foot_y), fill=(199, 143, 72), width=1)
            label = f"{item['state']}  {item['visible_height_px']}px  ({item['height_change_pct']:+.1f}%)"
            draw.text((x0 + 8, y0 + CELL_H - 17), label, font=font, fill=(240, 229, 207))
    return sheet


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("calibration", nargs="?", type=Path,
                        help="optional JSON exported from the animation workshop")
    args = parser.parse_args()
    rows, global_scale = records(args.calibration)
    REPORTS.mkdir(parents=True, exist_ok=True)
    fields = ["file", "fighter", "state", "width", "height", "alpha_bounds",
              "pose_scale", "global_scale", "source_to_screen_scale", "visible_height_px",
              "combat_idle_height_px", "height_change_pct", "foot_anchor_y"]
    with (REPORTS / "animation_scale.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for item in rows:
            writer.writerow({key: item[key] for key in fields})
    make_sheet(rows).save(REPORTS / "animation_scale.png", optimize=True)
    source = f" from {args.calibration}" if args.calibration else " from project defaults"
    print(f"Analyzed {len(rows)} live poses at {global_scale:.0%} global scale{source}; reports saved under reports/")


if __name__ == "__main__":
    main()

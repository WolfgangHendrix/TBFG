from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'assets/images/tbfg_bg_cloudless_sky_v3.png').convert('RGBA')
background = Image.open(r'C:\Users\santi\.codex\generated_images\01a0f9bd-a554-7591-a068-5fd67e1d153b\exec-b12c5911-cb58-449f-bde1-995e65a6c7d5.png').convert('RGB')
assert source.size == background.size, (source.size, background.size)
outdir = ROOT / 'assets/images/flags'
outdir.mkdir(parents=True, exist_ok=True)

# Polygons trace just the cloth, leaving its support poles in the static plate.
flags = {
    'red_left_small': ((17, 330, 80, 441), [(22, 345), (67, 347), (68, 424), (63, 439), (54, 424), (48, 439), (40, 424), (34, 439), (27, 422)]),
    'red_left_tall': ((139, 155, 229, 552), [(151, 164), (222, 166), (221, 535), (213, 549), (205, 532), (196, 548), (187, 530), (177, 545), (169, 529), (160, 543), (153, 524)]),
    'red_mid_tall': ((265, 210, 387, 596), [(310, 222), (381, 236), (372, 581), (363, 595), (352, 579), (342, 591), (331, 576), (320, 588), (308, 570), (297, 586), (290, 566)]),
    'yellow_mid_left': ((397, 375, 439, 600), [(403, 384), (431, 389), (427, 586), (418, 597), (410, 584), (402, 595)]),
    'yellow_mid_right': ((435, 379, 484, 600), [(446, 389), (477, 391), (474, 586), (465, 600), (456, 585), (447, 597)]),
    'yellow_mid_small': ((492, 433, 527, 603), [(499, 439), (520, 441), (517, 589), (509, 601), (502, 588)]),
    'blue_right_tall': ((1415, 236, 1564, 584), [(1477, 252), (1554, 244), (1552, 571), (1540, 584), (1528, 569), (1516, 582), (1504, 568), (1492, 582), (1481, 568)]),
    'yellow_right': ((1570, 350, 1671, 579), [(1611, 367), (1668, 369), (1668, 562), (1658, 577), (1646, 562), (1634, 576), (1622, 560), (1614, 570)]),
}

for name, (box, polygon) in flags.items():
    x0, y0, x1, y1 = box
    crop = source.crop(box)
    mask = Image.new('L', crop.size, 0)
    ImageDraw.Draw(mask).polygon([(x-x0, y-y0) for x, y in polygon], fill=255)
    crop.putalpha(mask)
    crop.save(outdir / f'{name}.png')

# A still proof image makes it easy to check cutouts against the inpainted plate.
proof = background.convert('RGBA')
for name, (box, _) in flags.items():
    proof.alpha_composite(Image.open(outdir / f'{name}.png'), (box[0], box[1]))
proof.convert('RGB').save(ROOT / 'reports/flag-extraction-proof.png', quality=92)

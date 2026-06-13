# Cuts character turnaround sheets (white background) into individual
# transparent-PNG views: front / side / back.
# Usage: powershell -ExecutionPolicy Bypass -File tools/cut_sprites.ps1
# Re-run whenever the source sheets in assets/images change.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$refs = if ($PSVersionTable.PSEdition -eq 'Core') {
    'System.Drawing.Common', 'System.Private.Windows.GdiPlus', 'System.Private.Windows.Core'
} else {
    'System.Drawing'
}
Add-Type -ReferencedAssemblies $refs -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SpriteCutter
{
    class Comp
    {
        public int Id, Count;
        public int MinX, MaxX, MinY, MaxY;
        public int Owner = -1;
    }

    public static string Process(string inPath, string outDir, string prefix)
    {
        var log = new System.Text.StringBuilder();
        using (var src = new Bitmap(inPath))
        {
            int w = src.Width, h = src.Height;
            using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);
                var rect = new Rectangle(0, 0, w, h);
                var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                int stride = data.Stride;
                var px = new byte[stride * h];
                Marshal.Copy(data.Scan0, px, 0, px.Length);
                bmp.UnlockBits(data);

                // --- flood-fill near-white connected to the border -> transparent ---
                var visited = new bool[w * h];
                var stack = new Stack<int>();
                Action<int, int> push = (x, y) =>
                {
                    if (x < 0 || y < 0 || x >= w || y >= h) return;
                    int v = y * w + x;
                    if (visited[v]) return;
                    visited[v] = true;
                    int i = y * stride + x * 4; // BGRA
                    if (px[i] >= 238 && px[i + 1] >= 238 && px[i + 2] >= 238) stack.Push(v);
                };
                for (int x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
                for (int y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
                while (stack.Count > 0)
                {
                    int v = stack.Pop();
                    int x = v % w, y = v / w;
                    px[y * stride + x * 4 + 3] = 0;
                    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
                }

                // --- one halo pass: clear lingering near-white pixels touching cleared ones ---
                var halo = new List<int>();
                for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int i = y * stride + x * 4;
                    if (px[i + 3] == 0) continue;
                    if (px[i] < 228 || px[i + 1] < 228 || px[i + 2] < 228) continue;
                    bool edge =
                        (x > 0 && px[i - 4 + 3] == 0) || (x < w - 1 && px[i + 4 + 3] == 0) ||
                        (y > 0 && px[i - stride + 3] == 0) || (y < h - 1 && px[i + stride + 3] == 0);
                    if (edge) halo.Add(i);
                }
                foreach (int i in halo) px[i + 3] = 0;

                // --- connected components over remaining opaque pixels (8-connectivity) ---
                var labels = new int[w * h];
                for (int i = 0; i < labels.Length; i++) labels[i] = -1;
                var comps = new List<Comp>();
                var fill = new Stack<int>();
                for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int v = y * w + x;
                    if (labels[v] >= 0 || px[y * stride + x * 4 + 3] == 0) continue;
                    var c = new Comp { Id = comps.Count, MinX = x, MaxX = x, MinY = y, MaxY = y };
                    labels[v] = c.Id;
                    fill.Push(v);
                    while (fill.Count > 0)
                    {
                        int p = fill.Pop();
                        int cx = p % w, cy = p / w;
                        c.Count++;
                        if (cx < c.MinX) c.MinX = cx;
                        if (cx > c.MaxX) c.MaxX = cx;
                        if (cy < c.MinY) c.MinY = cy;
                        if (cy > c.MaxY) c.MaxY = cy;
                        for (int dy = -1; dy <= 1; dy++)
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            int nx = cx + dx, ny = cy + dy;
                            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                            int nv = ny * w + nx;
                            if (labels[nv] >= 0 || px[ny * stride + nx * 4 + 3] == 0) continue;
                            labels[nv] = c.Id;
                            fill.Push(nv);
                        }
                    }
                    comps.Add(c);
                }

                // --- three largest components are the figures, left to right ---
                var seeds = new List<Comp>(comps);
                seeds.Sort((a, b) => b.Count.CompareTo(a.Count));
                seeds = seeds.GetRange(0, Math.Min(3, seeds.Count));
                seeds.Sort((a, b) => a.MinX.CompareTo(b.MinX));
                for (int s = 0; s < seeds.Count; s++) seeds[s].Owner = s;

                // --- attach satellite pieces to the figure whose (padded) bbox they overlap most ---
                const int pad = 30;
                foreach (var c in comps)
                {
                    if (c.Owner >= 0) continue;
                    long best = 0; int bestSeed = -1;
                    for (int s = 0; s < seeds.Count; s++)
                    {
                        var sd = seeds[s];
                        long ox = Math.Min(c.MaxX, sd.MaxX + pad) - Math.Max(c.MinX, sd.MinX - pad) + 1;
                        long oy = Math.Min(c.MaxY, sd.MaxY + pad) - Math.Max(c.MinY, sd.MinY - pad) + 1;
                        if (ox <= 0 || oy <= 0) continue;
                        long area = ox * oy;
                        if (area > best) { best = area; bestSeed = s; }
                    }
                    c.Owner = bestSeed; // -1 = orphan, dropped
                }

                // --- crop each figure: union bbox of owned comps, copy only owned pixels ---
                string[] names = { "front", "side", "back" };
                for (int s = 0; s < seeds.Count; s++)
                {
                    int minX = w, maxX = -1, minY = h, maxY = -1;
                    foreach (var c in comps)
                    {
                        if (c.Owner != s) continue;
                        if (c.MinX < minX) minX = c.MinX;
                        if (c.MaxX > maxX) maxX = c.MaxX;
                        if (c.MinY < minY) minY = c.MinY;
                        if (c.MaxY > maxY) maxY = c.MaxY;
                    }
                    int bw = maxX - minX + 1, bh = maxY - minY + 1;
                    using (var crop = new Bitmap(bw, bh, PixelFormat.Format32bppArgb))
                    {
                        var cdata = crop.LockBits(new Rectangle(0, 0, bw, bh),
                            ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                        int cstride = cdata.Stride;
                        var cpx = new byte[cstride * bh];
                        for (int y = minY; y <= maxY; y++)
                        for (int x = minX; x <= maxX; x++)
                        {
                            int lbl = labels[y * w + x];
                            if (lbl < 0 || comps[lbl].Owner != s) continue;
                            int si = y * stride + x * 4;
                            int di = (y - minY) * cstride + (x - minX) * 4;
                            cpx[di] = px[si]; cpx[di + 1] = px[si + 1];
                            cpx[di + 2] = px[si + 2]; cpx[di + 3] = px[si + 3];
                        }
                        Marshal.Copy(cpx, 0, cdata.Scan0, cpx.Length);
                        crop.UnlockBits(cdata);
                        string outPath = System.IO.Path.Combine(outDir, prefix + "_" + names[s] + ".png");
                        crop.Save(outPath, ImageFormat.Png);
                        log.AppendFormat("{0}_{1}: {2}x{3} (x {4}-{5})\n", prefix, names[s], bw, bh, minX, maxX);
                    }
                }
            }
        }
        return log.ToString();
    }
}
'@

$outDir = Join-Path $root 'assets\sprites'
New-Item -ItemType Directory -Force $outDir | Out-Null
[SpriteCutter]::Process((Join-Path $root 'assets\images\tbfg_p1_00.png'), $outDir, 'p1')
[SpriteCutter]::Process((Join-Path $root 'assets\images\tbfg_p2_00.png'), $outDir, 'p2')

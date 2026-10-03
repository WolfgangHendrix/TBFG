// Scene rendering, animation choreography, UI wiring, match flow.
// Game rules live in logic.js; the opponent brain in ai.js; juice in fx.js.
'use strict';
(function () {
  const W = 1280, H = 720;
  const GROUND = 650;           // y of the fighters' feet
  const CLASH_X = W / 2;
  const P1_HOME = 330, P2_HOME = 950;
  const CHAR_H = 330;           // on-screen fighter height
  const NAMES = ['AKAONI', 'KUROGANE'];
  const MOVE_LABEL = { jump: 'JUMP', lunge: 'LUNGE', crouch: 'CROUCH' };
  const CALIBRATION_KEY = 'tbfg.animation-calibration.v3';
  const CALIBRATION_DEFAULTS = {
    globalScale: 0.8,
    p1: {
      // The previous preview applied an idle-only factor of 1059 / 914.
      // Fold that factor into this value so the new scale formula is uniform.
      idle: { scale: 1.33244, offsetX: 0, offsetY: 0, duration: 180 },
      idle_breathe_out: { duration: 1900 },
      idle_breathe_in: { duration: 1900 },
      idle_fwd: { scale: 1.32, offsetX: 0, offsetY: 0, duration: 180 },
      jump_0: { scale: 1.25, offsetX: -24, offsetY: 0, duration: 180 },
      jump_mid: { scale: 1.0748, offsetX: 0, offsetY: 0, duration: 120 },
      crouch_0: { scale: 0.89, offsetX: 0, offsetY: 0, duration: 180 },
      crouch_mid: { scale: 0.9172, offsetX: 0, offsetY: 0, duration: 140 },
      lunge_0: { scale: 0.8925, offsetX: 0, offsetY: 0, duration: 150 },
      lunge_mid: { scale: 1.1015, offsetX: 0, offsetY: 0, duration: 250 },
      jump_1: { scale: 1.17, offsetX: 10, offsetY: 0, duration: 180 },
      crouch_1: { scale: 1, offsetX: 0, offsetY: 0, duration: 180 },
      block: { scale: 1.19, offsetX: 0, offsetY: 0, duration: 180 },
      idle_fight: { scale: 1.06, offsetX: 0, offsetY: 0, duration: 180 },
      idle_fight_breathe_out: { duration: 1650 },
      idle_fight_breathe_in: { duration: 1650 },
      blockknock: { scale: 1.04, offsetX: 0, offsetY: 0, duration: 180 },
      lunge_1: { scale: 0.9405, offsetX: 0, offsetY: 0, duration: 140 },
    },
    p2: {
      // Matched to P1's calibrated visible frame heights using each P2 source
      // pose's height relative to P2's idle artwork. Horizontal nudges mirror.
      idle: { scale: 1.33244, offsetX: 0, offsetY: 0, duration: 180 },
      idle_breathe_out: { duration: 1900 },
      idle_breathe_in: { duration: 1900 },
      idle_fwd: { scale: 1.3465, offsetX: 0, offsetY: 0, duration: 180 },
      defeat: { scale: 0.9625, offsetX: 0, offsetY: 0, duration: 180 },
      jump_0: { scale: 1.2757, offsetX: 24, offsetY: 0, duration: 180 },
      jump_mid: { scale: 1.191, offsetX: 0, offsetY: 0, duration: 120 },
      crouch_0: { scale: 1.0599, offsetX: 0, offsetY: 0, duration: 180 },
      crouch_mid: { scale: 0.9661, offsetX: 0, offsetY: 0, duration: 140 },
      lunge_0: { scale: 0.9306, offsetX: 0, offsetY: 0, duration: 150 },
      lunge_mid: { scale: 1.086, offsetX: 0, offsetY: 0, duration: 250 },
      jump_1: { scale: 1.2453, offsetX: -10, offsetY: 0, duration: 180 },
      crouch_1: { scale: 1.0501, offsetX: 0, offsetY: 0, duration: 180 },
      block: { scale: 1.0907, offsetX: 0, offsetY: 0, duration: 180 },
      idle_fight: { scale: 0.9943, offsetX: 0, offsetY: 0, duration: 180 },
      idle_fight_breathe_out: { duration: 1650 },
      idle_fight_breathe_in: { duration: 1650 },
      blockknock: { scale: 1.0848, offsetX: 0, offsetY: 0, duration: 180 },
      lunge_1: { scale: 0.9928, offsetX: 0, offsetY: 0, duration: 140 },
    },
  };
  let animationCalibration = readAnimationCalibration();

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  function readAnimationCalibration() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CALIBRATION_KEY) || '{}'); }
    catch (_) { saved = {}; }
    return {
      globalScale: Number.isFinite(saved.globalScale) ? saved.globalScale : CALIBRATION_DEFAULTS.globalScale,
      p1: { ...CALIBRATION_DEFAULTS.p1, ...(saved.p1 || {}) },
      p2: { ...CALIBRATION_DEFAULTS.p2, ...(saved.p2 || {}) },
    };
  }
  function poseAdjustment(a) {
    const character = animationCalibration[a.playerId] || {};
    return character[a.state] || {};
  }
  function poseDuration(a, state, fallback) {
    const saved = animationCalibration[a.playerId]?.[state]?.duration;
    const defaultDuration = CALIBRATION_DEFAULTS[a.playerId]?.[state]?.duration;
    const duration = Number.isFinite(saved) ? saved : Number.isFinite(defaultDuration) ? defaultDuration : fallback;
    return Math.max(40, Math.min(2000, duration));
  }
  function phaseDurations(a, states, total) {
    const weights = states.map((state, index) => poseDuration(a, state, 180 + index * 20));
    const sum = weights.reduce((value, weight) => value + weight, 0);
    return weights.map(weight => total * weight / sum);
  }
  window.addEventListener('storage', event => {
    if (event.key === CALIBRATION_KEY) {
      animationCalibration = readAnimationCalibration();
      applyTitleCalibration();
    }
  });

  // ---------- assets ----------
  const IMG = { p1: {}, p2: {} };
  const FLAG_DEFS = [
    { key: 'red_left_small', box: [17, 330, 80, 441], sway: 2.3, phase: 0.4 },
    { key: 'red_left_tall', box: [139, 155, 229, 552], sway: 7.2, phase: 0.1 },
    { key: 'red_mid_tall', box: [265, 210, 387, 596], sway: 6.4, phase: 1.3 },
    { key: 'yellow_mid_left', box: [397, 375, 439, 600], sway: 2.5, phase: 2.1 },
    { key: 'yellow_mid_right', box: [435, 379, 484, 600], sway: 2.9, phase: 0.8 },
    { key: 'yellow_mid_small', box: [492, 433, 527, 603], sway: 1.8, phase: 2.8 },
    { key: 'blue_right_tall', box: [1415, 236, 1564, 584], sway: 6.8, phase: 1.9 },
    { key: 'yellow_right', box: [1570, 350, 1671, 579], sway: 3.0, phase: 0.5 },
  ];
  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Failed to load ' + src));
      img.src = src;
    });
  }
  async function loadAssets() {
    const list = [
      ['bg', 'assets/images/tbfg_bg_cloudless_no_flags_v1.png'],
      ['cloudsNear', 'assets/images/tbfg_clouds_near_v2.png'],
      ['cloudsFar', 'assets/images/tbfg_clouds_far_v2.png'],
      ...FLAG_DEFS.map(flag => [`flag_${flag.key}`, `assets/images/flags/${flag.key}.png`]),
      ['p1_idle', 'assets/clean/tbfg_p1_idle.png'],
      ['p1_idle_breathe_out', 'assets/clean/tbfg_p1_idle_breathe_out.png'],
      ['p1_idle_breathe_in', 'assets/clean/tbfg_p1_idle_breathe_in.png'],
      ['p1_idle_fight', 'assets/clean/tbfg_p1_idle_fight.png'],
      ['p1_idle_fight_breathe_out', 'assets/clean/tbfg_p1_idle_fight_breathe_out.png'],
      ['p1_idle_fight_breathe_in', 'assets/clean/tbfg_p1_idle_fight_breathe_in.png'],
      ['p1_idle_fwd', 'assets/clean/tbfg_p1_idle_fwd.png'],
      ['p1_block', 'assets/clean/tbfg_p1_block_00.png'],
      ['p1_blockknock', 'assets/clean/tbfg_p1_blockknockback_00.png'],
      ['p1_defeat', 'assets/clean/tbfg_p1_defeated_00.png'],
      ['p1_lunge_0', 'assets/clean/tbfg_p1_lunge_windup_v2.png'],
      ['p1_lunge_1', 'assets/clean/tbfg_p1_lunge_follow_v2.png'],
      ['p1_lunge_mid', 'assets/clean/tbfg_p1_lunge_drive_v2.png'],
      ['p1_jump_0', 'assets/clean/tbfg_p1_jump_00.png'],
      ['p1_jump_mid', 'assets/clean/tbfg_p1_jump_mid_v1.png'],
      ['p1_jump_1', 'assets/clean/tbfg_p1_jump_01.png'],
      ['p1_crouch_0', 'assets/clean/tbfg_p1_crouch_00.png'],
      ['p1_crouch_mid', 'assets/clean/tbfg_p1_crouch_mid_v1.png'],
      ['p1_crouch_1', 'assets/clean/tbfg_p1_crouch_01.png'],
      ['p2_idle', 'assets/clean/tbfg_p2_idle.png'],
      ['p2_idle_breathe_out', 'assets/clean/tbfg_p2_idle_breathe_out.png'],
      ['p2_idle_breathe_in', 'assets/clean/tbfg_p2_idle_breathe_in.png'],
      ['p2_idle_fight', 'assets/clean/tbfg_p2_idle_fight.png'],
      ['p2_idle_fight_breathe_out', 'assets/clean/tbfg_p2_idle_fight_breathe_out.png'],
      ['p2_idle_fight_breathe_in', 'assets/clean/tbfg_p2_idle_fight_breathe_in.png'],
      ['p2_idle_fwd', 'assets/clean/tbfg_p2_idle_fwd.png'],
      ['p2_block', 'assets/clean/tbfg_p2_block_00.png'],
      ['p2_blockknock', 'assets/clean/tbfg_p2_blockknockback_00.png'],
      ['p2_defeat', 'assets/clean/tbfg_p2_defeated_00.png'],
      ['p2_lunge_0', 'assets/clean/tbfg_p2_lunge_windup_v2.png'],
      ['p2_lunge_1', 'assets/clean/tbfg_p2_lunge_follow_v2.png'],
      ['p2_lunge_mid', 'assets/clean/tbfg_p2_lunge_drive_v2.png'],
      ['p2_jump_0', 'assets/clean/tbfg_p2_jump_00.png'],
      ['p2_jump_mid', 'assets/clean/tbfg_p2_jump_mid_v1.png'],
      ['p2_jump_1', 'assets/clean/tbfg_p2_jump_01.png'],
      ['p2_crouch_0', 'assets/clean/tbfg_p2_crouch_00.png'],
      ['p2_crouch_mid', 'assets/clean/tbfg_p2_crouch_mid_v1.png'],
      ['p2_crouch_1', 'assets/clean/tbfg_p2_crouch_01.png'],
      ];
    const imgs = await Promise.all(list.map(item => loadImage(item[1])));
    list.forEach((item, i) => {
      const k = item[0];
      if (k === 'bg' || k.startsWith('clouds')) IMG[k] = imgs[i];
      else if (k.startsWith('flag_')) (IMG.flags ||= {})[k.slice(5)] = imgs[i];
      else if (k.startsWith('p1_')) IMG.p1[k.slice(3)] = imgs[i];
      else if (k.startsWith('p2_')) IMG.p2[k.slice(3)] = imgs[i];
    });
  }

  function applyTitleCalibration() {
    const stage = document.getElementById('game');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    for (const playerId of ['p1', 'p2']) {
      const title = document.querySelector(`.title-char.${playerId === 'p1' ? 'left' : 'right'}`);
      const idle = IMG[playerId].idle, pose = IMG[playerId].idle_fwd;
      if (!title || !idle || !pose) continue;
      const adjustment = animationCalibration[playerId]?.idle_fwd || {};
      const scale = Number.isFinite(adjustment.scale) ? adjustment.scale : 1;
      const offsetX = Number.isFinite(adjustment.offsetX) ? adjustment.offsetX : 0;
      const offsetY = Number.isFinite(adjustment.offsetY) ? adjustment.offsetY : 0;
      // Match the editor's 330px base scale relative to the side-idle source.
      title.style.height = `${45.8333 * pose.height / idle.height}%`;
      title.style.transformOrigin = 'center bottom';
      title.style.transform = `translate(${offsetX * rect.width / W}px, ${offsetY * rect.height / H}px) scale(${scale * animationCalibration.globalScale})`;
    }
  }
  window.addEventListener('resize', applyTitleCalibration);

  // ---------- tweens & timers (game-time, driven by rAF) ----------
  const tweens = [];
  const timers = [];
  const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeIn = p => p * p * p;
  const linear = p => p;

  function tween(obj, to, dur, ease) {
    ease = ease || easeInOut;
    const from = {};
    for (const k in to) from[k] = obj[k];
    return new Promise(res => tweens.push({ obj, from, to, dur: Math.max(1, dur), t: 0, ease, res }));
  }
  function wait(ms) {
    return new Promise(res => timers.push({ left: ms, res }));
  }
  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      const e = tw.ease(p);
      for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (p >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }
  function updateTimers(dt) {
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].left -= dt;
      if (timers[i].left <= 0) timers.splice(i, 1)[0].res();
    }
  }

  // ---------- actors ----------
  // x/y is the feet anchor (bottom-center).
  function makeActor(name, imgs, homeX, faceRight, nativeFaceRight, playerId) {
    return {
      name, imgs, homeX, faceRight, nativeFaceRight: !!nativeFaceRight, playerId,
      // Every pose uses this same source-pixel scale. Per-frame alpha crops
      // have different heights, so fitting each crop independently zooms the
      // character in and out during an animation.
      scale: CHAR_H / imgs.idle.height,
      x: homeX, y: GROUND,
      sx: 1, sy: 1, rot: 0, alpha: 1,
      idle: true,
      state: 'idle',
    };
  }
  let A1 = null, A2 = null;

  const ghosts = []; // lunge afterimages
  const attackSlashes = []; // brief hand-painted sword arcs at each strike pose
  function spawnAttackSlash(a, dir, kind, t) {
    attackSlashes.push({ x: a.x + dir * 18, y: a.y - (kind === 'low' ? 64 : kind === 'air' ? 154 : 116), dir, kind, born: t, life: kind === 'air' ? 210 : 185 });
  }

  function drawAttackSlashes(t) {
    for (let i = attackSlashes.length - 1; i >= 0; i--) {
      const slash = attackSlashes[i];
      const progress = (t - slash.born) / slash.life;
      if (progress >= 1) { attackSlashes.splice(i, 1); continue; }
      const fade = Math.sin(Math.PI * Math.max(0, progress));
      const widen = 0.72 + progress * 0.42;
      ctx.save();
      ctx.translate(slash.x, slash.y);
      ctx.scale(slash.dir * widen, widen);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.62;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-70, 24);
      ctx.quadraticCurveTo(-4, slash.kind === 'low' ? -50 : -92, 82, -18);
      ctx.strokeStyle = '#ffc869';
      ctx.lineWidth = slash.kind === 'air' ? 7 : 6;
      ctx.stroke();
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.moveTo(-57, 20);
      ctx.quadraticCurveTo(2, slash.kind === 'low' ? -42 : -80, 68, -18);
      ctx.strokeStyle = '#fff0c2';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  function spawnGhost(a) {
    const img = a.imgs[a.state] || a.imgs.idle;
    ghosts.push({ img, state: a.state, scale: a.scale, playerId: a.playerId, x: a.x, y: a.y, faceRight: a.faceRight, nativeFaceRight: a.nativeFaceRight, sx: a.sx, sy: a.sy, rot: a.rot, alpha: 0.4 });
  }

  function drawActor(a, t) {
    if (a.alpha <= 0) return;
    const img = a.img || a.imgs[a.state] || a.imgs.idle;
    const adjustment = poseAdjustment(a);
    const scaleAdjustment = Number.isFinite(adjustment.scale) ? adjustment.scale : 1;
    const offsetX = Number.isFinite(adjustment.offsetX) ? adjustment.offsetX : 0;
    const offsetY = Number.isFinite(adjustment.offsetY) ? adjustment.offsetY : 0;
    // Keep one source-pixel scale across all poses. The bottom-center remains
    // the foot anchor; pose silhouettes can change height without zooming.
    const s = a.scale * animationCalibration.globalScale * scaleAdjustment;
    const sy = a.sy;
    const flip = a.faceRight === a.nativeFaceRight ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.translate(a.x + offsetX, a.y + offsetY);
    ctx.rotate(a.rot);
    ctx.scale(flip * s * a.sx, s * sy);
    const breath = a.idle && !a.img && (a.state === 'idle' || a.state === 'idle_fight');
    const out = breath && a.imgs[`${a.state}_breathe_out`];
    const inhale = breath && a.imgs[`${a.state}_breathe_in`];
    if (out && inhale) {
      // Blend hand-drawn breathing art under one transform. No scale or foot
      // anchor changes are introduced by the breathing cycle.
      const outDuration = poseDuration(a, `${a.state}_breathe_out`, a.state === 'idle' ? 1900 : 1650);
      const inDuration = poseDuration(a, `${a.state}_breathe_in`, a.state === 'idle' ? 1900 : 1650);
      const period = outDuration + inDuration;
      const phase = (t + (a.playerId === 'p2' ? period * 0.38 : 0)) % period;
      const mix = phase < outDuration ? phase / outDuration : 1 - (phase - outDuration) / inDuration;
      const smooth = mix * mix * (3 - 2 * mix);
      ctx.globalAlpha = a.alpha * (1 - smooth);
      ctx.drawImage(out, -out.width / 2, -out.height);
      ctx.globalAlpha = a.alpha * smooth;
      ctx.drawImage(inhale, -inhale.width / 2, -inhale.height);
    } else {
      ctx.drawImage(img, -img.width / 2, -img.height);
    }
    ctx.restore();
  }

  function drawShadow(a) {
    const lift = GROUND - a.y;
    const k = Math.max(0.35, 1 - lift / 500);
    const offsetX = Number.isFinite(poseAdjustment(a).offsetX) ? poseAdjustment(a).offsetX : 0;
    ctx.save();
    ctx.globalAlpha = 0.3 * k * a.alpha;
    ctx.fillStyle = '#100c06';
    ctx.beginPath();
    ctx.ellipse(a.x + offsetX, GROUND + 10, 85 * k * animationCalibration.globalScale, 16 * k * animationCalibration.globalScale, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  // ---------- move reveal labels ----------
  let reveal = null; // { l, r }
  function pickLabel(p) {
    return MOVE_LABEL[p.move] + (p.block ? ' +BLOCK' : '');
  }
  function drawReveal() {
    ctx.save();
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(14,9,4,0.85)';
    ctx.fillStyle = '#ffe9b0';
    for (const [text, a] of [[reveal.l, A1], [reveal.r, A2]]) {
      const y = Math.max(46, a.y - CHAR_H * animationCalibration.globalScale * a.sy - 30);
      ctx.strokeText(text, a.x, y);
      ctx.fillText(text, a.x, y);
    }
    ctx.restore();
  }

  // ---------- render loop ----------
  let last = 0;
  let hitStopRemaining = 0;
  let impactZoomPeak = 1;
  let impactZoomTime = 0;
  let impactZoomDuration = 1;
  let cameraZoom = 1;
  function triggerImpact(hitStopMs, zoom, zoomDuration) {
    hitStopRemaining = Math.max(hitStopRemaining, hitStopMs);
    impactZoomPeak = Math.max(impactZoomPeak, zoom);
    impactZoomTime = 0;
    impactZoomDuration = zoomDuration || 340;
  }
  function frame(ts) {
    const dt = Math.min(50, ts - (last || ts));
    last = ts;
    hitStopRemaining = Math.max(0, hitStopRemaining - dt);
    impactZoomTime += dt;
    const zoomProgress = Math.min(1, impactZoomTime / impactZoomDuration);
    const zoomEnvelope = zoomProgress < 0.24 ? zoomProgress / 0.24 : (1 - zoomProgress) / 0.76;
    const zoomEase = Math.max(0, zoomEnvelope);
    cameraZoom = 1 + (impactZoomPeak - 1) * zoomEase * zoomEase * (3 - 2 * zoomEase);
    if (zoomProgress >= 1) impactZoomPeak = 1;
    updateTimers(dt);
    // Freeze fighter motion for a few frames at contact, while wall-clock waits,
    // particles, and camera effects continue to resolve normally.
    updateTweens(hitStopRemaining > 0 ? 0 : dt);
    FX.update(dt);
    for (let i = ghosts.length - 1; i >= 0; i--) {
      ghosts[i].alpha -= dt * 0.0022;
      if (ghosts[i].alpha <= 0) ghosts.splice(i, 1);
    }
    render(ts);
    requestAnimationFrame(frame);
  }

  function render(t) {
    ctx.save();
    const o = FX.shakeOffset();
    ctx.translate(o.x, o.y);
    ctx.translate(CLASH_X, GROUND - 175);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-CLASH_X, -(GROUND - 175));
    ctx.drawImage(IMG.bg, 0, 0, W, H);
    drawClouds(t);
    drawSmoke(t);
    drawFlags(t);
    drawAtmosphere(t);
    if (A1 && A2) {
      drawShadow(A2);
      drawShadow(A1);
      for (const g of ghosts) drawActor(g, t);
      drawActor(A2, t);
      drawActor(A1, t);
      drawAttackSlashes(t);
      FX.draw(ctx);
      if (reveal) drawReveal();
    }
    ctx.restore();
    FX.drawFlash(ctx, W, H);
  }

  function drawClouds(t) {
    if (!IMG.cloudsNear && !IMG.cloudsFar) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, 410);
    ctx.clip();
    drawLoopingCloudLayer(IMG.cloudsFar, t, 0.012, 0.22, -95, 1500, 566);
    drawLoopingCloudLayer(IMG.cloudsNear, t, 0.025, 0.30, -105, 1680, 572);
    ctx.restore();
    const sunX = 836 + Math.sin(t / 5200) * 10;
    const sun = ctx.createRadialGradient(sunX, 270, 8, sunX, 270, 260);
    const warmth = 0.065 + (Math.sin(t / 3600) + 1) * 0.016;
    sun.addColorStop(0, `rgba(255, 226, 152, ${warmth})`);
    sun.addColorStop(1, 'rgba(255, 184, 91, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(600, 40, 470, 460);
    // A faint moving reflection crosses the field beneath the sun.
    const shimmerX = (t * 0.035) % (W + 240) - 120;
    const shimmer = ctx.createRadialGradient(shimmerX, 590, 4, shimmerX, 590, 190);
    shimmer.addColorStop(0, 'rgba(255, 214, 132, 0.075)');
    shimmer.addColorStop(1, 'rgba(255, 214, 132, 0)');
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, 470, W, 210);
  }

  function drawLoopingCloudLayer(image, t, speed, alpha, y, width, height) {
    if (!image) return;
    const cycle = width * 2;
    const offset = (t * speed) % cycle;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let base = -cycle; base < W + cycle; base += cycle) {
      const x = base - offset;
      ctx.drawImage(image, x, y, width, height);
      ctx.save();
      ctx.translate(x + width * 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, 0, y, width, height);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSmoke(t) {
    // Distant battlefield smoke drifts slowly above the horizon, behind the duel.
    const sources = [[285, 518], [780, 500], [1065, 512]];
    for (let i = 0; i < sources.length; i++) {
      const [baseX, baseY] = sources[i];
      for (let puff = 0; puff < 5; puff++) {
        const phase = (t * 0.000055 + puff * 0.19 + i * 0.27) % 1;
        const radius = 15 + phase * 34 + puff * 2;
        const gust = windAt(t, i * 0.37);
        const x = baseX + phase * (23 + gust * 9) + Math.sin(t / 1700 + puff * 1.8 + i) * (5 + phase * 8);
        const y = baseY - phase * 104 - puff * 7;
        const alpha = (1 - phase) * (0.035 + i * 0.004);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1.15, 1.45);
        const smoke = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
        smoke.addColorStop(0, `rgba(215, 194, 165, ${alpha})`);
        smoke.addColorStop(0.58, `rgba(162, 151, 138, ${alpha * 0.56})`);
        smoke.addColorStop(1, 'rgba(142, 132, 122, 0)');
        ctx.fillStyle = smoke;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        ctx.restore();
      }
    }
  }

  // A shared, slowly changing gust: banners catch the full force, while field
  // grass and battlefield smoke respond more softly at their greater distance.
  function windAt(t, phase = 0) {
    return Math.sin(t / 2350 + phase) * 0.72 + Math.sin(t / 5100 + phase * 0.63) * 0.34 + Math.sin(t / 940 + phase * 1.7) * 0.12;
  }

  function drawFlags(t) {
    if (!IMG.flags) return;
    const ratioX = W / 1672, ratioY = H / 941;
    for (const flag of FLAG_DEFS) {
      const image = IMG.flags[flag.key];
      if (!image) continue;
      const strips = Math.ceil(image.height / 4);
      for (let i = 0; i < strips; i++) {
        const sy = i * 4, sh = Math.min(4, image.height - sy);
        const y = (flag.box[1] + sy) * ratioY;
        const u = (sy + sh * 0.5) / image.height;
        const gust = windAt(t, flag.phase);
        const flutter = Math.sin(t / 390 + flag.phase + u * 7.4) * (0.45 + u * 0.55);
        // The top edge stays fastened; displacement builds toward the torn hem.
        const dx = (gust * u + flutter * u * 0.43) * flag.sway;
        ctx.drawImage(image, 0, sy, image.width, sh,
          flag.box[0] * ratioX + dx, y, image.width * ratioX, sh * ratioY + 0.4);
      }
    }
  }

  // Gentle layered haze and a few drifting motes give the painted field depth
  // without competing with the fighters or the move UI.
  function drawAtmosphere(t) {
    const drift = windAt(t, 0.6) * 8;
    const haze = ctx.createLinearGradient(0, 365 + drift, 0, H);
    haze.addColorStop(0, 'rgba(220, 166, 104, 0)');
    haze.addColorStop(0.58, 'rgba(206, 143, 75, 0.055)');
    haze.addColorStop(1, 'rgba(20, 13, 8, 0.16)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 350, W, H - 350);
    drawWindGrass(t);
    for (let i = 0; i < 24; i++) {
      const x = (i * 173 + t * (0.003 + (i % 4) * 0.0006) * (0.55 + windAt(t, i) * 0.2)) % (W + 32) - 16;
      const y = 395 + ((i * 97 - t * (0.008 + (i % 3) * 0.001)) % 300 + 300) % 300;
      const pulse = 0.16 + (Math.sin(t / 700 + i * 2.1) + 1) * 0.12;
      ctx.fillStyle = `rgba(255, ${171 + i % 3 * 20}, 91, ${pulse})`;
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    const vignette = ctx.createRadialGradient(W / 2, H * 0.54, H * 0.22, W / 2, H * 0.54, H * 0.8);
    vignette.addColorStop(0, 'rgba(8, 6, 4, 0)');
    vignette.addColorStop(1, 'rgba(8, 6, 4, 0.25)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawWindGrass(t) {
    // Small foreground blades sway together in slow gusts, with different
    // phases by depth so they read as field motion rather than a UI shimmer.
    for (let i = 0; i < 72; i++) {
      const x = (i * 89 + 21) % W;
      const depth = i % 3;
      const baseY = 636 + depth * 9;
      const height = 7 + (i * 13) % 15;
      const gust = windAt(t, depth * 0.48 + i * 0.09);
      const sway = gust * (4 + depth * 1.8) + Math.sin(t / (920 + depth * 190) + i * 1.7) * (1.2 + depth * 0.8);
      ctx.strokeStyle = `rgba(${depth === 0 ? '230, 181, 96' : '115, 102, 52'}, ${0.18 + depth * 0.045})`;
      ctx.lineWidth = depth === 2 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + sway * 0.4, baseY - height * 0.55, x + sway, baseY - height);
      ctx.stroke();
    }
  }

  // ---------- UI ----------
  const titleScreen = $('title-screen');
  const endScreen = $('end-screen');
  const movePanel = $('move-panel');
  const banner = $('banner');
  const hud = $('hud');

  async function showBanner(text, sub, hold) {
    banner.innerHTML =
      '<div class="banner-main">' + text + '</div>' +
      (sub ? '<div class="banner-sub">' + sub + '</div>' : '');
    banner.classList.remove('hidden', 'pop');
    void banner.offsetWidth; // restart the pop animation
    banner.classList.add('pop');
    await wait(hold || 1000);
    banner.classList.add('hidden');
  }

  function updateHUD() {
    const pips = wins => {
      let s = '';
      for (let i = 0; i < match.roundsToWin; i++)
        s += '<span class="pip' + (i < wins ? ' won' : '') + '">◆</span>';
      return s;
    };
    const tokens = left => {
      let s = '';
      for (let i = 0; i < match.blocksMax; i++)
        s += '<span class="tok' + (i < left ? '' : ' spent') + '">守</span>';
      return s;
    };
    $('pips-p1').innerHTML = pips(match.wins[0]);
    $('pips-p2').innerHTML = pips(match.wins[1]);
    $('blocks-p1').innerHTML = tokens(match.blocks[0]);
    $('blocks-p2').innerHTML = tokens(match.blocks[1]);
    $('hud-round').textContent = 'ROUND ' + match.round;
  }

  let blockArmed = false;
  function refreshPanel() {
    const btn = $('btn-block');
    const have = match.blocks[0] > 0;
    btn.disabled = !have;
    btn.classList.toggle('armed', blockArmed);
    btn.querySelector('.bb-label').textContent =
      !have ? 'BLOCK SPENT' : blockArmed ? 'BLOCK ARMED' : 'ADD BLOCK';
  }

  // ---------- match flow ----------
  let match = null;
  let pickEnabled = false;

  async function startMatch() {
    match = Logic.newMatch(2, 1);
    A1 = makeActor(NAMES[0], IMG.p1, P1_HOME, true, true, 'p1');
    A2 = makeActor(NAMES[1], IMG.p2, P2_HOME, false, false, 'p2');
    ghosts.length = 0;
    reveal = null;
    titleScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    updateHUD();

    A1.x = -180;
    A2.x = W + 180;
    FX.drum();
    await Promise.all([
      tween(A1, { x: P1_HOME }, 800, easeOut),
      tween(A2, { x: P2_HOME }, 800, easeOut),
    ]);
    FX.dust(P1_HOME, GROUND, 8);
    FX.dust(P2_HOME, GROUND, 8);
    FX.drum();
    await showBanner('ROUND 1', 'a duel for the lord', 1100);
    beginPick('FIGHT!');
  }

  async function beginPick(callout) {
    if (callout) {
      FX.drum();
      await showBanner(callout, '', 650);
    }
    blockArmed = false;
    refreshPanel();
    movePanel.classList.remove('hidden');
    pickEnabled = true;
  }

  async function onMove(move) {
    if (!pickEnabled) return;
    pickEnabled = false;
    movePanel.classList.add('hidden');
    FX.ui();

    const o = Logic.resolveRound(match, { move, block: blockArmed }, AI.pick(match));
    await playRound(o);
    updateHUD();

    if (match.over) {
      endMatch();
    } else if (o.winner) {
      await resetForNextRound(o);
      beginPick('ROUND ' + match.round);
    } else {
      await recoverAtClash();
      beginPick(o.saved ? 'CLASH AGAIN!' : 'AGAIN!');
    }
  }

  function wastedNote(o) {
    return o.wasted.map(p => ' · ' + NAMES[p - 1] + ' wasted a block').join('');
  }

  async function recoverAtClash() {
    // Draws continue from the meeting point so the next exchange feels like
    // the same duel escalating, rather than a reset to the opening standoff.
    for (const actor of [A1, A2]) {
      actor.state = 'idle_fight';
      actor.idle = false;
    }
    await Promise.all([A1, A2].map(actor =>
      tween(actor, { y: GROUND, rot: 0, sx: 1, sy: 1 }, 190, easeOut)
    ));
    A1.idle = A2.idle = true;
  }

  async function playRound(o) {
    A1.state = A2.state = 'idle_fight';
    await wait(300);
    reveal = { l: pickLabel(o.p1), r: pickLabel(o.p2) };
    FX.whoosh();
    const T = 640;
    const attacks = Promise.all([
      attackAnim(A1, o.p1.move, 1, T, o.p1.block),
      attackAnim(A2, o.p2.move, -1, T, o.p2.block),
    ]);

    // Freeze the final sword convergence for a few frames on contact, then let
    // both attack poses finish their last short follow-through.
    const clashY = GROUND - 150;
    await wait(T - 50);
    FX.flash(0.38);
    FX.shake(12, 260);
    FX.swordClash(CLASH_X, clashY);
    FX.clash();
    triggerImpact(74, 1.045, 310);
    await attacks;

    if (o.winner) {
      const winner = o.winner === 1 ? A1 : A2;
      const loser = o.winner === 1 ? A2 : A1;
      const dir = o.winner === 1 ? 1 : -1; // loser is knocked toward their own side
      const hitY = GROUND - (o[o.winner === 1 ? 'p1' : 'p2'].move === 'crouch' ? 84 : o[o.winner === 1 ? 'p1' : 'p2'].move === 'jump' ? 158 : 126);
      const hitX = loser.x - dir * 24;
      FX.slash();
      FX.bloodSplash(hitX, hitY, dir);
      FX.woundFlash(hitX, hitY);
      FX.flash(0.68);
      FX.shake(19, 360);
      triggerImpact(105, 1.085, 410);
      await wait(125);
      loser.state = 'defeat';
      await Promise.all([
        tween(loser, { x: loser.x + dir * 190, rot: dir * 1.45, y: GROUND, sy: 1 }, 480, easeOut),
        tween(winner, { y: GROUND, rot: 0, sy: 1 }, 320, easeOut),
      ]);
      FX.thud();
      FX.shake(10, 250);
      FX.dust(loser.x, GROUND, 14);
      await wait(700);
      reveal = null;
      if (!match.over) {
        await showBanner(winner.name + ' STRIKES TRUE', 'round to ' + winner.name + wastedNote(o), 1400);
      }
    } else if (o.saved) {
      const saver = o.saved === 1 ? A1 : A2;
      saver.state = 'blockknock';
      FX.clang();
      FX.swordClash(CLASH_X, clashY, '#ffe9a8');
      FX.shake(8, 220);
      await wait(400);
      reveal = null;
      const nm = NAMES[o.saved - 1];
      await showBanner(nm + ' BLOCKS!', 'the strike is turned aside' + wastedNote(o), 1400);
    } else {
      FX.clang();
      await wait(400);
      reveal = null;
      await showBanner('DRAW', 'blades meet — again!' + wastedNote(o), 1100);
    }
  }

  // All three attacks take exactly T ms so both fighters meet mid-screen.
  async function attackAnim(a, move, dir, T, isBlocking) {
    a.idle = false;
    const target = CLASH_X - dir * 80;
    if (move === 'jump') {
      a.state = isBlocking ? 'block' : 'jump_0';
      const [jumpWeight] = phaseDurations(a, ['jump_0', 'jump_mid', 'jump_1'], T);
      const windup = Math.max(80, Math.min(180, jumpWeight * 0.375));
      const airborne = T - windup;
      const [rise, crest, fall] = phaseDurations(a, ['jump_0', 'jump_mid', 'jump_1'], airborne);
      FX.dust(a.x, GROUND, 3);
      await tween(a, { x: a.x - dir * 13, rot: -dir * 0.055 }, windup, easeOut); // readable coil, fixed sprite scale
      a.state = isBlocking ? 'block' : 'jump_0';
      await Promise.all([
        (async () => {
          await tween(a, { y: GROUND - 215 }, rise, easeOut);
          a.state = isBlocking ? 'block' : 'jump_mid';
          await tween(a, { y: GROUND - 242, rot: dir * 0.26 }, crest, easeInOut);
          a.state = isBlocking ? 'block' : 'jump_1';
          if (!isBlocking) spawnAttackSlash(a, dir, 'air', performance.now());
          await tween(a, { y: GROUND - 90, rot: dir * 0.12 }, fall, easeIn);
        })(),
        tween(a, { x: target, rot: dir * 0.22 }, T - 120, linear),
      ]);
      FX.dust(a.x, GROUND, 5);
    } else if (move === 'lunge') {
      const [windup, drive, follow] = phaseDurations(a, ['lunge_0', 'lunge_mid', 'lunge_1'], T - 80);
      a.state = isBlocking ? 'block' : 'lunge_0';
      await tween(a, { x: a.x - dir * 32, rot: -dir * 0.16 }, windup, easeOut); // compress into a readable wind-up
      a.state = isBlocking ? 'block' : 'lunge_mid';
      const trail = (async () => {
        for (let i = 0; i < 6; i++) { spawnGhost(a); await wait(38); }
      })();
      await tween(a, { x: target + dir * 10, rot: dir * 0.20 }, drive, easeIn);
      a.state = isBlocking ? 'block' : 'lunge_1';
      if (!isBlocking) spawnAttackSlash(a, dir, 'high', performance.now());
      await tween(a, { rot: dir * 0.18 }, follow, easeOut);
      await trail;
      await wait(80);
    } else { // crouch
      const [windup, , strike] = phaseDurations(a, ['crouch_0', 'crouch_mid', 'crouch_1'], T * 0.4);
      const drive = T - windup - strike;
      a.state = isBlocking ? 'block' : 'crouch_0';
      await tween(a, { x: a.x - dir * 15, rot: -dir * 0.035 }, windup, easeOut); // lean back into a clear low-attack anticipation
      const midDrive = drive * 0.7;
      a.state = isBlocking ? 'block' : 'crouch_mid';
      await tween(a, { x: CLASH_X - dir * 142, rot: dir * 0.025 }, midDrive, easeIn);
      a.state = isBlocking ? 'block' : 'crouch_1';
      await tween(a, { x: CLASH_X - dir * 130, rot: dir * 0.05 }, drive - midDrive, easeOut);
      if (!isBlocking) { spawnAttackSlash(a, dir, 'low', performance.now()); FX.dust(a.x, GROUND, 4); }
      await wait(strike);
    }
  }

  async function resetForNextRound(o) {
    const loser = o.winner === 1 ? A2 : A1;
    await wait(200);
    await tween(loser, { rot: 0 }, 380, easeOut); // back on their feet
    loser.state = 'idle';
    await returnHome();
  }

  async function returnHome() {
    A1.idle = A2.idle = false;
    A1.state = A2.state = 'idle';
    await Promise.all([
      tween(A1, { x: P1_HOME, y: GROUND, rot: 0, sy: 1, sx: 1 }, 480, easeInOut),
      tween(A2, { x: P2_HOME, y: GROUND, rot: 0, sy: 1, sx: 1 }, 480, easeInOut),
    ]);
    A1.idle = A2.idle = true;
  }

  async function endMatch() {
    const playerWon = match.winner === 1;
    await wait(600);
    FX.jingle(playerWon);
    $('end-title').textContent = playerWon ? 'VICTORY' : 'DEFEAT';
    $('end-jp').textContent = playerWon ? '勝利' : '敗北';
    $('end-sub').textContent = NAMES[match.winner - 1] + ' stands alone on the field';
    $('end-portrait').src = playerWon ? 'assets/clean/tbfg_p1_idle_fwd.png' : 'assets/clean/tbfg_p2_idle_fwd.png';
    $('end-portrait').style.transform = `scale(${animationCalibration.globalScale})`;
    endScreen.classList.remove('hidden');
  }

  // ---------- boot & input ----------
  async function boot() {
    try {
      await loadAssets();
    } catch (e) {
      const err = $('err');
      err.textContent = e.message + ' — if you opened index.html directly, try a local server (e.g. "npx serve").';
      err.classList.remove('hidden');
      return;
    }
    applyTitleCalibration();
    requestAnimationFrame(frame);

    $('btn-vs-ai').addEventListener('click', () => { FX.audio(); FX.ui(); startMatch(); });
    $('btn-rematch').addEventListener('click', () => { FX.ui(); startMatch(); });
    $('btn-title').addEventListener('click', () => {
      FX.ui();
      endScreen.classList.add('hidden');
      hud.classList.add('hidden');
      titleScreen.classList.remove('hidden');
    });
    $('btn-mute').addEventListener('click', () => {
      FX.muted = !FX.muted;
      $('btn-mute').classList.toggle('muted', FX.muted);
    });
    $('btn-block').addEventListener('click', () => {
      if (!pickEnabled || match.blocks[0] <= 0) return;
      blockArmed = !blockArmed;
      FX.ui();
      refreshPanel();
    });
    for (const btn of document.querySelectorAll('.move-btn')) {
      btn.addEventListener('click', () => onMove(btn.dataset.move));
    }
    document.addEventListener('keydown', e => {
      if (!pickEnabled) return;
      if (e.key === '1') onMove('jump');
      else if (e.key === '2') onMove('lunge');
      else if (e.key === '3') onMove('crouch');
      else if (e.key === 'b' || e.key === 'B') $('btn-block').click();
    });
  }

  boot();
})();

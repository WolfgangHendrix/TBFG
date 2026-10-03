'use strict';
(() => {
  const KEY = 'tbfg.animation-calibration.v3';
  const W = 1280, H = 720, GROUND = 650, CHAR_H = 330;
  const $ = id => document.getElementById(id);
  const canvas = $('preview'), ctx = canvas.getContext('2d');
  const controls = ['scale', 'offsetX', 'offsetY', 'duration'];
  const CALIBRATION_DEFAULTS = {
    globalScale: 0.8,
    p1: {
      idle: { scale: 1.33244, offsetX: 0, offsetY: 0, duration: 180 },
      idle_breathe_out: { duration: 1900 }, idle_breathe_in: { duration: 1900 },
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
      idle_fight_breathe_out: { duration: 1650 }, idle_fight_breathe_in: { duration: 1650 },
      blockknock: { scale: 1.04, offsetX: 0, offsetY: 0, duration: 180 },
      lunge_1: { scale: 0.9405, offsetX: 0, offsetY: 0, duration: 140 },
    },
    p2: {
      idle: { scale: 1.33244, offsetX: 0, offsetY: 0, duration: 180 },
      idle_breathe_out: { duration: 1900 }, idle_breathe_in: { duration: 1900 },
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
      idle_fight_breathe_out: { duration: 1650 }, idle_fight_breathe_in: { duration: 1650 },
      blockknock: { scale: 1.0848, offsetX: 0, offsetY: 0, duration: 180 },
      lunge_1: { scale: 0.9928, offsetX: 0, offsetY: 0, duration: 140 },
    },
  };
  const poseDefs = {
    idle: [['idle', 'Side idle']], idle_fight: [['idle_fight', 'Combat idle']], idle_fwd: [['idle_fwd', 'Forward idle']],
    breathing: [['idle_breathe_out', 'Side idle · exhale'], ['idle_breathe_in', 'Side idle · inhale']],
    combat_breathing: [['idle_fight_breathe_out', 'Combat idle · exhale'], ['idle_fight_breathe_in', 'Combat idle · inhale']],
    block: [['block', 'Block']], blockknock: [['blockknock', 'Block knockback']], defeat: [['defeat', 'Defeat']],
    lunge: [['lunge_0', 'Lunge wind-up'], ['lunge_mid', 'Lunge middle'], ['lunge_1', 'Lunge strike']],
    jump: [['jump_0', 'Jump take-off'], ['jump_mid', 'Jump transition'], ['jump_1', 'Jump strike / descent']], crouch: [['crouch_0', 'Crouch anticipation'], ['crouch_mid', 'Crouch low slash'], ['crouch_1', 'Crouch finishing pose']]
  };
  const poseSequences = { idle: 'idle', idle_breathe_out: 'breathing', idle_breathe_in: 'breathing', idle_fight: 'idle_fight', idle_fight_breathe_out: 'combat_breathing', idle_fight_breathe_in: 'combat_breathing', idle_fwd: 'idle_fwd', block: 'block', blockknock: 'blockknock', defeat: 'defeat', lunge_0: 'lunge', lunge_mid: 'lunge', lunge_1: 'lunge', jump_0: 'jump', jump_mid: 'jump', jump_1: 'jump', crouch_0: 'crouch', crouch_mid: 'crouch', crouch_1: 'crouch' };
  const files = {
    idle: 'idle.png', idle_breathe_out: 'idle_breathe_out.png', idle_breathe_in: 'idle_breathe_in.png', idle_fight: 'idle_fight.png', idle_fight_breathe_out: 'idle_fight_breathe_out.png', idle_fight_breathe_in: 'idle_fight_breathe_in.png', idle_fwd: 'idle_fwd.png', block: 'block_00.png', blockknock: 'blockknockback_00.png', defeat: 'defeated_00.png',
    lunge_0: 'lunge_windup_v2.png', lunge_mid: 'lunge_drive_v2.png', lunge_1: 'lunge_follow_v2.png', jump_0: 'jump_00.png', jump_mid: 'jump_mid_v1.png', jump_1: 'jump_01.png', crouch_0: 'crouch_00.png', crouch_mid: 'crouch_mid_v1.png', crouch_1: 'crouch_01.png'
  };
  const images = { p1: {}, p2: {} };
  const alphaBoundsCache = new WeakMap();
  const background = new Image(), cloudsFar = new Image(), cloudsNear = new Image();
  background.src = '../assets/images/tbfg_bg_cloudless_sky_v3.png';
  cloudsFar.src = '../assets/images/tbfg_clouds_far_v2.png';
  cloudsNear.src = '../assets/images/tbfg_clouds_near_v2.png';
  let calibration = readCalibration(), selectedPose = 'idle_fight', playTimer = null, frameIndex = 0;

  function readCalibration() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (_) { saved = {}; }
    return {
      globalScale: Number.isFinite(saved.globalScale) ? saved.globalScale : CALIBRATION_DEFAULTS.globalScale,
      p1: { ...CALIBRATION_DEFAULTS.p1, ...(saved.p1 || {}) },
      p2: { ...CALIBRATION_DEFAULTS.p2, ...(saved.p2 || {}) },
    };
  }
  function cleanEntry(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function entry() {
    const byPlayer = calibration[$('fighter').value] || {};
    const breathPose = selectedPose.endsWith('_breathe_in') || selectedPose.endsWith('_breathe_out');
    if (breathPose) {
      const parent = selectedPose.startsWith('idle_fight_') ? 'idle_fight' : 'idle';
      return { ...CALIBRATION_DEFAULTS[$('fighter').value][parent], ...(byPlayer[parent] || {}), duration: byPlayer[selectedPose]?.duration ?? CALIBRATION_DEFAULTS[$('fighter').value][selectedPose]?.duration ?? 180 };
    }
    return byPlayer[selectedPose] || CALIBRATION_DEFAULTS[$('fighter').value][selectedPose] || { scale: 1, offsetX: 0, offsetY: 0, duration: 180 };
  }
  function loadSprites() {
    for (const fighter of ['p1', 'p2']) for (const [pose, filename] of Object.entries(files)) {
      const image = new Image();
      image.onload = render;
      image.src = `../assets/clean/tbfg_${fighter}_${filename}`;
      images[fighter][pose] = image;
    }
  }
  function currentSequence() { return poseDefs[$('sequence').value] || poseDefs.idle_fight; }
  function updateFrameOptions() {
    const sequence = currentSequence();
    $('pose').innerHTML = sequence.map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
    const seq = poseSequences[selectedPose];
    $('sequence').value = seq;
    $('pose').value = selectedPose;
    const selected = sequence.findIndex(([key]) => key === selectedPose);
    frameIndex = Math.max(0, selected);
    $('timeline').max = String(sequence.length - 1); $('timeline').value = String(frameIndex);
    updateFrameLabel(); updateControls(); render();
  }
  function updateFrameLabel() { $('frameLabel').textContent = `${frameIndex + 1} / ${currentSequence().length}`; }
  function updateControls() {
    const v = entry();
    const breathPose = selectedPose.endsWith('_breathe_in') || selectedPose.endsWith('_breathe_out');
    $('globalScale').value = String(calibration.globalScale);
    $('globalScaleValue').textContent = `${Math.round(calibration.globalScale * 100)}%`;
    for (const id of controls) {
      $(id).disabled = breathPose && id !== 'duration';
      const defaultValue = id === 'scale' ? 1 : id === 'duration' ? 180 : 0;
      $(id).value = String(Number.isFinite(Number(v[id])) ? v[id] : defaultValue);
      $(`${id}Value`) && ($(`${id}Value`).textContent = id === 'scale' ? Number($(id).value).toFixed(2) : `${Number($(id).value) > 0 && id !== 'scale' ? '+' : ''}${$(id).value}px`);
    }
  }
  function setFrame(index) {
    const seq = currentSequence(); frameIndex = (index + seq.length) % seq.length;
    selectedPose = seq[frameIndex][0]; $('pose').value = selectedPose;
    $('timeline').value = String(frameIndex); updateFrameLabel(); updateControls(); render();
  }
  function drawSprite(image, pose, alpha, adjustment) {
    if (!image || !image.complete || !image.naturalWidth) return;
    const idle = images[$('fighter').value].idle;
    const base = idle && idle.naturalHeight ? CHAR_H / idle.naturalHeight : CHAR_H / image.naturalHeight;
    const scale = base * calibration.globalScale * (adjustment.scale || 1);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(W / 2 + (adjustment.offsetX || 0), GROUND + (adjustment.offsetY || 0));
    ctx.scale(scale, scale); ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight);
    ctx.restore();
  }
  function alphaBounds(image) {
    if (!image || !image.complete || !image.naturalWidth) return null;
    if (alphaBoundsCache.has(image)) return alphaBoundsCache.get(image);
    const probe = document.createElement('canvas');
    probe.width = image.naturalWidth; probe.height = image.naturalHeight;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    probeCtx.drawImage(image, 0, 0);
    const pixels = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
    let top = probe.height, bottom = -1;
    for (let y = 0; y < probe.height; y++) {
      const row = y * probe.width * 4;
      for (let x = 0; x < probe.width; x++) {
        if (pixels[row + x * 4 + 3] > 16) { top = Math.min(top, y); bottom = y; break; }
      }
    }
    const bounds = bottom < top ? null : { top, bottom, height: bottom - top + 1 };
    alphaBoundsCache.set(image, bounds);
    return bounds;
  }
  function updateMeasurement() {
    const label = $('measurement');
    const fighter = $('fighter').value;
    const image = images[fighter][selectedPose];
    const idle = images[fighter].idle;
    const combat = images[fighter].idle_fight;
    const bounds = alphaBounds(image);
    const idleBounds = alphaBounds(idle);
    const combatBounds = alphaBounds(combat);
    if (!label || !bounds || !idleBounds || !combatBounds) {
      if (label) label.textContent = 'Rendered art bounds: loading frame…';
      return;
    }
    const base = CHAR_H / idle.naturalHeight;
    const currentHeight = bounds.height * base * calibration.globalScale * (entry().scale || 1);
    const combatScale = calibration[fighter]?.idle_fight?.scale ?? CALIBRATION_DEFAULTS[fighter].idle_fight.scale;
    const referenceHeight = combatBounds.height * base * calibration.globalScale * combatScale;
    const difference = (currentHeight / referenceHeight - 1) * 100;
    label.textContent = `Rendered art bounds: ${currentHeight.toFixed(1)} px high · ${difference >= 0 ? '+' : ''}${difference.toFixed(1)}% vs combat idle. Feet share the same bottom anchor.`;
  }
  function drawLoopingCloudLayer(image, t, speed, alpha, y, width, height) {
    if (!image.complete || !image.naturalWidth) return;
    const cycle = width * 2, offset = (t * speed) % cycle;
    ctx.save(); ctx.globalAlpha = alpha;
    for (let base = -cycle; base < W + cycle; base += cycle) {
      const x = base - offset;
      ctx.drawImage(image, x, y, width, height);
      ctx.save(); ctx.translate(x + cycle, 0); ctx.scale(-1, 1);
      ctx.drawImage(image, 0, y, width, height); ctx.restore();
    }
    ctx.restore();
  }
  function render(t = performance.now()) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (background.complete && background.naturalWidth) ctx.drawImage(background, 0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 410); ctx.clip();
    drawLoopingCloudLayer(cloudsFar, t, 0.012, 0.22, -95, 1500, 566);
    drawLoopingCloudLayer(cloudsNear, t, 0.025, 0.30, -105, 1680, 572);
    ctx.restore();
    const sunX = 836 + Math.sin(t / 5200) * 10;
    const sunGlow = ctx.createRadialGradient(sunX, 270, 8, sunX, 270, 260);
    sunGlow.addColorStop(0, 'rgba(255,226,152,.075)'); sunGlow.addColorStop(1, 'rgba(255,184,91,0)');
    ctx.fillStyle = sunGlow; ctx.fillRect(600, 40, 470, 460);
    const grad = ctx.createLinearGradient(0, 400, 0, H); grad.addColorStop(0, 'rgba(245,185,99,0)'); grad.addColorStop(1, 'rgba(20,13,8,.22)'); ctx.fillStyle = grad; ctx.fillRect(0, 400, W, 320);
    for (let i = 0; i < 72; i++) {
      const x = (i * 89 + 21) % W, depth = i % 3, baseY = 636 + depth * 9;
      const height = 7 + (i * 13) % 15, sway = Math.sin(t / (780 + depth * 160) + i * 1.7) * (5 + depth * 2);
      ctx.strokeStyle = `rgba(${depth === 0 ? '230,181,96' : '115,102,52'},${0.18 + depth * 0.045})`;
      ctx.lineWidth = depth === 2 ? 2 : 1; ctx.beginPath(); ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + sway * 0.4, baseY - height * 0.55, x + sway, baseY - height); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,239,203,.55)'; ctx.setLineDash([7, 8]); ctx.beginPath(); ctx.moveTo(100, GROUND); ctx.lineTo(1180, GROUND); ctx.stroke(); ctx.setLineDash([]);
    const fighter = $('fighter').value;
    if ($('compare').checked && selectedPose !== 'idle_fight') drawSprite(images[fighter].idle_fight, 'idle_fight', 0.26, { scale: 1, offsetX: 0, offsetY: 0 });
    drawSprite(images[fighter][selectedPose], selectedPose, 1, entry());
    ctx.fillStyle = 'rgba(20,14,8,.72)'; ctx.fillRect(14, 14, 280, 52);
    ctx.fillStyle = '#f4d69d'; ctx.font = '20px Georgia'; ctx.fillText(`${fighter.toUpperCase()}  /  ${selectedPose}`, 27, 47);
    updateMeasurement();
  }
  function saveEntryFromControls() {
    calibration[$('fighter').value] ||= {};
    const breathPose = selectedPose.endsWith('_breathe_in') || selectedPose.endsWith('_breathe_out');
    calibration[$('fighter').value][selectedPose] = breathPose
      ? { duration: Math.max(40, cleanEntry($('duration').value)) }
      : { scale: cleanEntry($('scale').value), offsetX: cleanEntry($('offsetX').value), offsetY: cleanEntry($('offsetY').value), duration: Math.max(40, cleanEntry($('duration').value)) };
    updateControls(); render();
  }
  function stop() { if (playTimer) clearTimeout(playTimer); playTimer = null; $('play').textContent = '▶ Play'; }

  $('sequence').innerHTML = Object.keys(poseDefs).map(key => `<option value="${key}">${key.replace('_', ' ')}</option>`).join('');
  const previewParams = new URLSearchParams(window.location.search);
  const requestedFighter = previewParams.get('fighter');
  if (requestedFighter === 'p1' || requestedFighter === 'p2') $('fighter').value = requestedFighter;
  const requestedSequence = previewParams.get('sequence');
  if (requestedSequence && poseDefs[requestedSequence]) {
    const requestedFrame = Math.max(0, Math.min(poseDefs[requestedSequence].length - 1, Number.parseInt(previewParams.get('frame') || '0', 10) || 0));
    selectedPose = poseDefs[requestedSequence][requestedFrame][0];
  }
  $('sequence').value = poseSequences[selectedPose];
  $('sequence').addEventListener('change', () => { stop(); setFrame(0); });
  $('pose').addEventListener('change', () => { stop(); selectedPose = $('pose').value; updateFrameOptions(); });
  $('fighter').addEventListener('change', () => { updateControls(); render(); });
  $('globalScale').addEventListener('input', () => {
    calibration.globalScale = Number($('globalScale').value);
    $('globalScaleValue').textContent = `${Math.round(calibration.globalScale * 100)}%`;
    render();
  });
  $('timeline').addEventListener('input', () => { stop(); setFrame(Number($('timeline').value)); });
  $('prev').addEventListener('click', () => setFrame(frameIndex - 1)); $('next').addEventListener('click', () => setFrame(frameIndex + 1));
  $('play').addEventListener('click', () => {
    if (playTimer) { stop(); return; }
    $('play').textContent = '❚❚ Pause';
    const advance = () => {
      const delay = Math.max(40, Number(entry().duration) || 180);
      playTimer = setTimeout(() => {
        const seq = currentSequence();
        setFrame(frameIndex + 1 >= seq.length ? 0 : frameIndex + 1);
        advance();
      }, delay);
    };
    advance();
  });
  for (const id of controls) $(id).addEventListener('input', saveEntryFromControls);
  $('compare').addEventListener('change', render);
  $('save').addEventListener('click', () => {
    calibration.globalScale = Number($('globalScale').value);
    saveEntryFromControls(); localStorage.setItem(KEY, JSON.stringify(calibration)); $('status').textContent = 'Saved. The open game will update as soon as it redraws.';
  });
  $('resetPose').addEventListener('click', () => { if (calibration[$('fighter').value]) delete calibration[$('fighter').value][selectedPose]; updateControls(); render(); $('status').textContent = 'Pose values reset. Save to game to publish.'; });
  $('resetAll').addEventListener('click', () => { calibration = JSON.parse(JSON.stringify(CALIBRATION_DEFAULTS)); updateControls(); render(); $('status').textContent = 'All values reset to project defaults.'; });
  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(calibration, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'tbfg-animation-calibration.json'; a.click(); URL.revokeObjectURL(url);
  });
  $('import').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text()); if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
      calibration = {
        globalScale: Number.isFinite(data.globalScale) ? data.globalScale : CALIBRATION_DEFAULTS.globalScale,
        p1: { ...CALIBRATION_DEFAULTS.p1, ...(data.p1 || {}) },
        p2: { ...CALIBRATION_DEFAULTS.p2, ...(data.p2 || {}) },
      };
      updateControls(); render(); $('status').textContent = 'Imported. Save to game to publish.';
    }
    catch (_) { $('status').textContent = 'Could not read that calibration file.'; }
    event.target.value = '';
  });
  window.addEventListener('storage', event => { if (event.key === KEY) { calibration = readCalibration(); updateControls(); render(); } });
  function animatePreview(t) { render(t); requestAnimationFrame(animatePreview); }
  loadSprites(); updateFrameOptions(); requestAnimationFrame(animatePreview);
})();

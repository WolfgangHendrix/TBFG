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

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  // ---------- assets ----------
  const IMG = { p1: {}, p2: {} };
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
      ['bg', 'assets/images/tbfg_bg_00.png'],
      ['p1_idle', 'assets/images/tbfg_p1_idle.png'],
      ['p1_idle_fight', 'assets/images/tbfg_p1_idle_fight.png'],
      ['p1_idle_fwd', 'assets/images/tbfg_p1_idle_fwd.png'],
      ['p1_block', 'assets/images/tbfg_p1_block_00.png'],
      ['p1_blockknock', 'assets/images/tbfg_p1_blockknockback_00.png'],
      ['p1_defeat', 'assets/images/tbfg_p1_defeated_00.png'],
      ['p1_lunge_0', 'assets/images/tbfg_p1_forwardlunge_00.png'],
      ['p1_lunge_1', 'assets/images/tbfg_p1_forwardlunge_01.png'],
      ['p1_jump_0', 'assets/images/tbfg_p1_jump_00.png'],
      ['p1_jump_1', 'assets/images/tbfg_p1_jump_01.png'],
      ['p1_crouch_0', 'assets/images/tbfg_p1_crouch_00.png'],
      ['p1_crouch_1', 'assets/images/tbfg_p1_crouch_01.png'],
      ['p2_idle', 'assets/images/tbfg_p2_idle.png'],
      ['p2_idle_fight', 'assets/images/tbfg_p2_idle_fight.png'],
      ['p2_idle_fwd', 'assets/images/tbfg_p2_idle_fwd.png'],
      ['p2_block', 'assets/images/tbfg_p2_block_00.png'],
      ['p2_blockknock', 'assets/images/tbfg_p2_blockknockback_00.png'],
      ['p2_defeat', 'assets/images/tbfg_p2_defeated_00.png'],
      ['p2_lunge_0', 'assets/images/tbfg_p2_forwardlunge_00.png'],
      ['p2_lunge_1', 'assets/images/tbfg_p2_forwardlunge_01.png'],
      ['p2_jump_0', 'assets/images/tbfg_p2_jump_00.png'],
      ['p2_jump_1', 'assets/images/tbfg_p2_jump_01.png'],
      ['p2_crouch_0', 'assets/images/tbfg_p2_crouch_00.png'],
      ['p2_crouch_1', 'assets/images/tbfg_p2_crouch_01.png'],
      ];
    const imgs = await Promise.all(list.map(item => loadImage(item[1])));
    list.forEach((item, i) => {
      const k = item[0];
      if (k === 'bg') IMG.bg = imgs[i];
      else if (k.startsWith('p1_')) IMG.p1[k.slice(3)] = imgs[i];
      else if (k.startsWith('p2_')) IMG.p2[k.slice(3)] = imgs[i];
    });
  }

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
  function makeActor(name, imgs, homeX, faceRight, nativeFaceRight) {
    return {
      name, imgs, homeX, faceRight, nativeFaceRight: !!nativeFaceRight,
      x: homeX, y: GROUND,
      sx: 1, sy: 1, rot: 0, alpha: 1,
      idle: true, idlePhase: Math.random() * 6,
      state: 'idle',
    };
  }
  let A1 = null, A2 = null;

  const ghosts = []; // lunge afterimages
  function spawnGhost(a) {
    const img = a.imgs[a.state] || a.imgs.idle;
    ghosts.push({ img, x: a.x, y: a.y, faceRight: a.faceRight, nativeFaceRight: a.nativeFaceRight, sx: a.sx, sy: a.sy, rot: a.rot, alpha: 0.4 });
  }

  function drawActor(a, t) {
    if (a.alpha <= 0) return;
    const img = a.img || a.imgs[a.state] || a.imgs.idle;
    const s = CHAR_H / img.height;
    let sy = a.sy;
    if (a.idle) sy *= 1 + Math.sin(t / 480 + a.idlePhase) * 0.012;
    const flip = a.faceRight === a.nativeFaceRight ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.scale(flip * s * a.sx, s * sy);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  function drawShadow(a) {
    const lift = GROUND - a.y;
    const k = Math.max(0.35, 1 - lift / 500);
    ctx.save();
    ctx.globalAlpha = 0.3 * k * a.alpha;
    ctx.fillStyle = '#100c06';
    ctx.beginPath();
    ctx.ellipse(a.x, GROUND + 10, 85 * k, 16 * k, 0, 0, 7);
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
      const y = Math.max(46, a.y - CHAR_H * a.sy - 30);
      ctx.strokeText(text, a.x, y);
      ctx.fillText(text, a.x, y);
    }
    ctx.restore();
  }

  // ---------- render loop ----------
  let last = 0;
  function frame(ts) {
    const dt = Math.min(50, ts - (last || ts));
    last = ts;
    updateTimers(dt);
    updateTweens(dt);
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
    ctx.drawImage(IMG.bg, 0, 0, W, H);
    if (A1 && A2) {
      drawShadow(A2);
      drawShadow(A1);
      for (const g of ghosts) drawActor(g, t);
      drawActor(A2, t);
      drawActor(A1, t);
      FX.draw(ctx);
      if (reveal) drawReveal();
    }
    ctx.restore();
    FX.drawFlash(ctx, W, H);
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
    A1 = makeActor(NAMES[0], IMG.p1, P1_HOME, true, true);
    A2 = makeActor(NAMES[1], IMG.p2, P2_HOME, false, false);
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
      await returnHome();
      beginPick('AGAIN!');
    }
  }

  function wastedNote(o) {
    return o.wasted.map(p => ' · ' + NAMES[p - 1] + ' wasted a block').join('');
  }

  async function playRound(o) {
    A1.state = A2.state = 'idle_fight';
    await wait(300);
    reveal = { l: pickLabel(o.p1), r: pickLabel(o.p2) };
    FX.whoosh();
    const T = 640;
    await Promise.all([
      attackAnim(A1, o.p1.move, 1, T, o.p1.block),
      attackAnim(A2, o.p2.move, -1, T, o.p2.block),
    ]);

    // the clash
    const clashY = GROUND - 150;
    FX.flash(0.75);
    FX.shake(14, 320);
    FX.sparks(CLASH_X, clashY, 26);
    FX.clash();
    await wait(260); // hit-stop

    if (o.winner) {
      const winner = o.winner === 1 ? A1 : A2;
      const loser = o.winner === 1 ? A2 : A1;
      const dir = o.winner === 1 ? 1 : -1; // loser is knocked toward their own side
      loser.state = 'defeat';
      FX.slash();
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
      FX.sparks(CLASH_X, clashY, 42, '#ffe9a8');
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
      await tween(a, { sy: 0.82 }, 120, easeOut); // crouch wind-up
      a.state = isBlocking ? 'block' : 'jump_0';
      const rise = (T - 120) * 0.55, fall = (T - 120) * 0.45;
      await Promise.all([
        tween(a, { y: GROUND - 215, sy: 1.04 }, rise, easeOut)
          .then(() => { a.state = isBlocking ? 'block' : 'jump_1'; return tween(a, { y: GROUND - 90 }, fall, easeIn); }),
        tween(a, { x: target, rot: dir * 0.22 }, T - 120, linear),
      ]);
    } else if (move === 'lunge') {
      a.state = isBlocking ? 'block' : 'lunge_0';
      await tween(a, { x: a.x - dir * 35, rot: -dir * 0.10 }, 200, easeOut); // lean back
      a.state = isBlocking ? 'block' : 'lunge_1';
      const trail = (async () => {
        for (let i = 0; i < 6; i++) { spawnGhost(a); await wait(38); }
      })();
      await tween(a, { x: target + dir * 10, rot: dir * 0.16 }, T - 320, easeOut);
      await trail;
      a.state = isBlocking ? 'block' : 'lunge_0';
      await wait(120);
    } else { // crouch
      a.state = isBlocking ? 'block' : 'crouch_0';
      await tween(a, { sy: 1.0 }, 170, easeOut); // Reset any scaling
      await tween(a, { x: CLASH_X - dir * 130 }, T - 290, easeInOut);
      a.state = isBlocking ? 'block' : 'crouch_1';
      await wait(120);
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
    $('end-portrait').src = playerWon ? 'assets/images/tbfg_p1_idle_fwd.png' : 'assets/images/tbfg_p2_idle_fwd.png';
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

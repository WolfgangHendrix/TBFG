// Juice: synthesized sound effects (WebAudio — no audio files needed),
// particles (sparks, dust), screen shake, and white impact flash.
'use strict';
(function () {
  const FX = {
    // ---------- audio ----------
    muted: false,
    ctx: null,
    master: null,
    noiseBuf: null,

    // Lazily creates the AudioContext; must first be called from a user
    // gesture (browser autoplay policy). Returns null when muted.
    audio() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!this.ctx) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.muted ? null : this.ctx;
    },

    osc(type, f0, f1, dur, vol) {
      const c = this.audio();
      if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    noise(dur, vol, filterType, f0, f1, q) {
      const c = this.audio();
      if (!c) return;
      if (!this.noiseBuf) {
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = c.currentTime;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = filterType || 'bandpass';
      f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0 || 1000, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t);
      s.stop(t + dur + 0.02);
    },

    whoosh() { this.noise(0.26, 0.5, 'bandpass', 2600, 280, 1.4); },
    slash()  { this.noise(0.14, 0.6, 'highpass', 1400, 4200); },
    clash()  {
      this.noise(0.09, 0.7, 'highpass', 2600);
      this.osc('triangle', 2350, 2350, 0.28, 0.22);
      this.osc('triangle', 3520, 3520, 0.20, 0.12);
    },
    clang()  {
      this.osc('triangle', 880, 870, 0.40, 0.30);
      this.osc('triangle', 1318, 1300, 0.30, 0.18);
      this.noise(0.06, 0.4, 'highpass', 3000);
    },
    thud()   { this.osc('sine', 120, 42, 0.28, 0.9); this.noise(0.09, 0.5, 'lowpass', 380); },
    drum()   { this.osc('sine', 96, 50, 0.34, 0.9); this.noise(0.04, 0.4, 'lowpass', 500); },
    ui()     { this.osc('square', 620, 620, 0.06, 0.10); },
    jingle(won) {
      const seq = won ? [392, 523, 659, 784] : [330, 262, 220, 165];
      seq.forEach((f, i) => setTimeout(() => this.osc('triangle', f, f, 0.35, 0.22), i * 170));
    },

    // ---------- particles ----------
    parts: [],
    impactFlares: [],

    swordClash(x, y, col) {
      const color = col || '#ffcf70';
      this.sparks(x, y, 38, color);
      this.impactFlares.push({ type: 'clash', x, y, life: 0, max: 210, col: color });
    },

    woundFlash(x, y) {
      this.impactFlares.push({ type: 'wound', x, y, life: 0, max: 170, col: '#fff0dc' });
    },

    bloodSplash(x, y, dir) {
      // A forceful, directional spray with a few broad droplets and fine mist.
      for (let i = 0; i < 42; i++) {
        const spread = (Math.random() - 0.5) * 2.25;
        const speed = 145 + Math.random() * (i < 14 ? 420 : 245);
        const angle = spread - 0.18;
        this.parts.push({
          type: 'b', x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 14,
          vx: dir * Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 95 - Math.random() * 130,
          life: 0, max: 420 + Math.random() * 420, r: 2.6 + Math.random() * (i < 12 ? 5.6 : 3.0),
          col: i % 4 === 0 ? '#a30f20' : i % 3 === 0 ? '#d52a32' : '#72101a',
        });
      }
      this.impactFlares.push({ type: 'blood', x, y, life: 0, max: 240, col: '#d52a32' });
    },

    sparks(x, y, n, col) {
      n = n || 18;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 180 + Math.random() * 520;
        this.parts.push({
          type: 's', x, y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
          life: 0, max: 320 + Math.random() * 280,
          col: col || '#ffce6b',
        });
      }
    },

    dust(x, y, n) {
      n = n || 10;
      for (let i = 0; i < n; i++) {
        this.parts.push({
          type: 'd',
          x: x + (Math.random() - 0.5) * 70, y: y - Math.random() * 12,
          vx: (Math.random() - 0.5) * 130, vy: -30 - Math.random() * 70,
          life: 0, max: 500 + Math.random() * 400,
          r: 6 + Math.random() * 9,
        });
      }
    },

    update(dt) {
      const s = dt / 1000;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
        if (p.type === 's') p.vy += 1500 * s;
        else if (p.type === 'b') { p.vy += 980 * s; p.vx *= 0.992; }
        else { p.vx *= 0.98; p.vy *= 0.97; }
        p.x += p.vx * s;
        p.y += p.vy * s;
      }
      for (let i = this.impactFlares.length - 1; i >= 0; i--) {
        const flare = this.impactFlares[i];
        flare.life += dt;
        if (flare.life >= flare.max) this.impactFlares.splice(i, 1);
      }
      if (this.shakeT > 0) this.shakeT -= dt;
      if (this.flashA > 0) this.flashA -= dt * 0.003;
    },

    draw(ctx) {
      for (const p of this.parts) {
        const k = 1 - p.life / p.max;
        if (p.type === 's') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.col;
          ctx.globalAlpha = k;
          ctx.lineWidth = 1.4 + k * 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === 'b') {
          ctx.save();
          ctx.globalAlpha = Math.min(0.96, k * 1.5);
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * 0.72, p.r * 1.3, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = '#8a7a5c';
          ctx.globalAlpha = 0.35 * k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (2 - k), 0, 7);
          ctx.fill();
        }
      }
      for (const flare of this.impactFlares) {
        const p = flare.life / flare.max;
        const fade = 1 - p;
        ctx.save();
        ctx.globalCompositeOperation = flare.type === 'clash' ? 'lighter' : 'source-over';
        if (flare.type === 'clash') {
          const radius = 12 + p * 70;
          const glow = ctx.createRadialGradient(flare.x, flare.y, 0, flare.x, flare.y, radius);
          glow.addColorStop(0, `rgba(255,250,225,${0.95 * fade})`);
          glow.addColorStop(0.18, `rgba(255,205,102,${0.72 * fade})`);
          glow.addColorStop(1, 'rgba(255,142,37,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(flare.x - radius, flare.y - radius, radius * 2, radius * 2);
          ctx.globalAlpha = fade;
          ctx.strokeStyle = '#fff4cf';
          ctx.lineWidth = 2 + fade * 2;
          ctx.beginPath();
          ctx.moveTo(flare.x - 23, flare.y + 19);
          ctx.lineTo(flare.x + 20, flare.y - 17);
          ctx.moveTo(flare.x - 16, flare.y - 20);
          ctx.lineTo(flare.x + 15, flare.y + 20);
          ctx.stroke();
        } else {
          const radius = flare.type === 'wound' ? 52 * fade : 22 + p * 55;
          const glow = ctx.createRadialGradient(flare.x, flare.y, 0, flare.x, flare.y, Math.max(1, radius));
          glow.addColorStop(0, `rgba(255,247,229,${(flare.type === 'wound' ? 0.82 : 0.4) * fade})`);
          glow.addColorStop(0.32, `rgba(213,42,50,${(flare.type === 'wound' ? 0.44 : 0.3) * fade})`);
          glow.addColorStop(1, 'rgba(150,12,24,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(flare.x - radius, flare.y - radius, radius * 2, radius * 2);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    // ---------- screen shake & flash ----------
    shakeT: 0, shakeDur: 1, shakeMag: 0,
    shake(mag, dur) { this.shakeMag = mag; this.shakeT = this.shakeDur = dur; },
    shakeOffset() {
      if (this.shakeT <= 0) return { x: 0, y: 0 };
      const k = (this.shakeT / this.shakeDur) * this.shakeMag;
      return { x: (Math.random() - 0.5) * 2 * k, y: (Math.random() - 0.5) * 2 * k };
    },

    flashA: 0,
    flash(a) { this.flashA = Math.max(this.flashA, a); },
    drawFlash(ctx, W, H) {
      if (this.flashA <= 0) return;
      ctx.fillStyle = 'rgba(255,250,235,' + Math.min(1, this.flashA) + ')';
      ctx.fillRect(0, 0, W, H);
    },
  };

  window.FX = FX;
})();

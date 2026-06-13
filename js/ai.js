// Opponent AI. Predicts the player's next move from recency-weighted
// frequencies of their past moves, then counters the prediction —
// with enough randomness that it can't be reliably exploited.
'use strict';
(function () {
  const MOVES = ['jump', 'lunge', 'crouch'];
  // COUNTER[m] is the move that kills m.
  const COUNTER = { crouch: 'jump', jump: 'lunge', lunge: 'crouch' };

  function randomMove() {
    return MOVES[(Math.random() * 3) | 0];
  }

  function predictPlayer(history) {
    const w = { jump: 1, lunge: 1, crouch: 1 };
    let decay = 1.6;
    for (let i = history.length - 1; i >= 0 && decay > 0.05; i--) {
      w[history[i].p1.move] += decay;
      decay *= 0.75;
    }
    let r = Math.random() * (w.jump + w.lunge + w.crouch);
    for (const m of MOVES) {
      r -= w[m];
      if (r <= 0) return m;
    }
    return 'jump';
  }

  function chooseMove(match) {
    if (match.history.length === 0 || Math.random() < 0.3) return randomMove();
    return COUNTER[predictPlayer(match.history)];
  }

  function chooseBlock(match) {
    if (match.blocks[1] <= 0) return false;
    // Far more likely to spend the token when one loss ends the match.
    const facingMatchPoint = match.wins[0] === match.roundsToWin - 1;
    return Math.random() < (facingMatchPoint ? 0.55 : 0.12);
  }

  function pick(match) {
    return { move: chooseMove(match), block: chooseBlock(match) };
  }

  const api = { pick, chooseMove, chooseBlock };
  if (typeof window !== 'undefined') window.AI = api;
  if (typeof module !== 'undefined') module.exports = api;
})();

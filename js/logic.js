// Pure game rules — no DOM, no rendering, no randomness.
// Kept side-effect free so a future multiplayer server can run the same code.
'use strict';
(function () {
  const MOVES = ['jump', 'lunge', 'crouch'];
  // Each move kills the move it points to.
  const BEATS = { jump: 'crouch', crouch: 'lunge', lunge: 'jump' };

  // 0 = draw, 1 = first move kills, 2 = second move kills
  function duel(m1, m2) {
    if (m1 === m2) return 0;
    return BEATS[m1] === m2 ? 1 : 2;
  }

  function newMatch(roundsToWin, blocksPerPlayer) {
    const blocks = blocksPerPlayer === undefined ? 1 : blocksPerPlayer;
    return {
      roundsToWin: roundsToWin || 2,
      blocksMax: blocks,
      wins: [0, 0],          // [p1, p2]
      blocks: [blocks, blocks],
      round: 1,
      history: [],           // outcomes, in order
      over: false,
      winner: 0,
    };
  }

  // pick = { move: 'jump'|'lunge'|'crouch', block: bool }
  // A committed block is always consumed. It converts a loss into a draw
  // (the round replays); on a win or draw it is simply wasted.
  function resolveRound(match, pick1, pick2) {
    const p1 = { move: pick1.move, block: !!pick1.block && match.blocks[0] > 0 };
    const p2 = { move: pick2.move, block: !!pick2.block && match.blocks[1] > 0 };
    if (p1.block) match.blocks[0]--;
    if (p2.block) match.blocks[1]--;

    const struck = duel(p1.move, p2.move);
    let winner = 0, saved = 0;
    const wasted = [];
    if (struck === 1) {
      if (p2.block) saved = 2; else winner = 1;
      if (p1.block) wasted.push(1);
    } else if (struck === 2) {
      if (p1.block) saved = 1; else winner = 2;
      if (p2.block) wasted.push(2);
    } else {
      if (p1.block) wasted.push(1);
      if (p2.block) wasted.push(2);
    }

    const outcome = { p1, p2, struck, winner, saved, wasted, draw: struck === 0 };
    match.history.push(outcome);
    if (winner) {
      match.wins[winner - 1]++;
      if (match.wins[winner - 1] >= match.roundsToWin) {
        match.over = true;
        match.winner = winner;
      } else {
        match.round++;
      }
    }
    return outcome;
  }

  const api = { MOVES, BEATS, duel, newMatch, resolveRound };
  if (typeof window !== 'undefined') window.Logic = api;
  if (typeof module !== 'undefined') module.exports = api;
})();

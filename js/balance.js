// Holds the loaded data/balance.json so engine modules can read it without passing it everywhere.
export let B = null;
export function setBalance(b) { B = b; }

// Total rounds in a (non-endless) run: antes x blinds when an antes structure is configured, else `rounds`.
export function totalRounds() {
  if (B.antes) return B.antes.base.length * B.antes.blinds.length;
  return B.rounds;
}

// Target, reward and label for round n (1-based). Rounds past the run length are endless rounds.
export function roundInfo(n) {
  const R = totalRounds();
  if (n <= R) {
    if (B.antes) {
      const k = B.antes.blinds.length, ante = Math.floor((n - 1) / k), bl = B.antes.blinds[(n - 1) % k];
      return { n, target: round5(B.antes.base[ante] * bl.mult), reward: bl.reward, label: `Ante ${ante + 1} · ${bl.name}`, endless: false };
    }
    return { n, target: B.targets[n - 1], reward: B.rewards[n - 1], label: `Round ${n} of ${R}`, endless: false };
  }
  // Endless: linear +step per round (Luck be a Landlord style), step itself growing gently.
  const last = roundInfo(R).target, e = n - R, E = B.endless;
  let t = last, step = E.step;
  for (let i = 0; i < e; i++) { t += step; step *= E.stepGrowth; }
  return { n, target: round5(t), reward: E.reward, label: `Endless ${e}`, endless: true };
}

const round5 = x => Math.round(x / 5) * 5;

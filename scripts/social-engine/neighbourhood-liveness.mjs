// Observe the authoritative world; keep these probes outside the simulation.
export function observeLocalDay(world) {
  const positions = new Map(), moved = new Set(), meals = new Set(), startTick = world.tick;
  let hungryWithMeans = 0, samples = 0;
  function sample() {
    const drivers = new Set(world.vehicles.map(v => v.driverId));
    const market = world.businesses.find(b => b.id === "market");
    let eligible = 0;
    for (const p of world.npcs) {
      if (!p.local || !p.alive || drivers.has(p.id)) continue;
      const pos = p.location, prev = positions.get(p.id);
      if (prev && (pos.scene !== prev.scene || Math.hypot(pos.x-prev.x, pos.y-prev.y) > .05)) moved.add(p.id);
      positions.set(p.id, { ...pos });
      if (market?.stock.simit > 0 && p.goal === "eat" && p.hunger > 75 && p.age >= 18 && world.accounts[p.id] >= market.prices.simit) eligible++;
    }
    if (eligible > 0) hungryWithMeans++;
    for (const e of world.ledger) if (e.tick > startTick && e.reason === "food" && e.to === "business:market" && positions.has(e.from)) meals.add(e.id);
    samples++;
  }
  sample();
  return { sample, result() {
    return { samples, pedestrians: positions.size, distinctMoving: moved.size, distinctMealsObserved: meals.size, hungryWithMeans,
      stalled: samples >= 25 && positions.size > 0 && (moved.size === 0 || (hungryWithMeans * 2 >= samples && meals.size === 0)) };
  }};
}

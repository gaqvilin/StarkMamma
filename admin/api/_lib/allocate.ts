// Förslag på fördelning av anmälningar till en ny omgång.
// Ordning: nuvarande deltagare som anmält sig inom förtursfönstret först, sedan exakt anmälningstid.
// Varje pass/vecka får förstahandsvalet om det finns plats, annars andrahandsvalet, annars inget.

export interface AllocGroup {
  id: string;
  capacity: number;
  filled: number;
}

export interface AllocRegistration {
  id: string;
  priority: boolean;
  created_at: string;
  choices: { slot: number; rank: number; group_id: string }[];
  per_week: number;
}

export interface Allocation {
  id: string;
  groupIds: (string | null)[];
  complete: boolean;
}

export function allocate(groups: AllocGroup[], regs: AllocRegistration[]): { allocations: Allocation[]; fill: Record<string, number> } {
  const fill: Record<string, number> = Object.fromEntries(groups.map((g) => [g.id, g.filled]));
  const cap: Record<string, number> = Object.fromEntries(groups.map((g) => [g.id, g.capacity]));
  const order = [...regs].sort(
    (a, b) => Number(b.priority) - Number(a.priority) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  const allocations = order.map((r) => {
    const taken = new Set<string>();
    const groupIds = Array.from({ length: r.per_week }, (_, slot) => {
      const options = r.choices.filter((c) => c.slot === slot).sort((a, b) => a.rank - b.rank);
      for (const o of options) {
        if (!taken.has(o.group_id) && cap[o.group_id] !== undefined && fill[o.group_id] < cap[o.group_id]) {
          fill[o.group_id] += 1;
          taken.add(o.group_id);
          return o.group_id;
        }
      }
      return null;
    });
    return { id: r.id, groupIds, complete: groupIds.every(Boolean) };
  });
  return { allocations, fill };
}

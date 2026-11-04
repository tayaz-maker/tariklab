import type { Person, Relation, SocietyEvent, WorldState } from "../domain/types.ts";
import { clamp } from "./random.ts";

export function notify(state: WorldState, message: string): void {
  state.notices.push(message);
  if (state.notices.length > 8) state.notices.splice(0, state.notices.length - 8);
}
export function remember(person: Person, id: string): void {
  if (!person.memories.includes(id)) person.memories.push(id);
  if (person.memories.length > 48) person.memories.shift();
}
export function emit(
  state: WorldState,
  kind: string,
  text: string,
  actors: string[] = [],
  targetId: string | null = null,
  visibility: SocietyEvent["visibility"] = "public",
  witnesses: string[] = [],
  causeId: string | null = null,
): SocietyEvent {
  const event: SocietyEvent = {
    id: `e${state.nextId++}`,
    tick: state.tick,
    minute: state.minute,
    kind,
    text,
    actors,
    targetId,
    visibility,
    witnesses,
    causeId,
  };
  state.events.push(event);
  state.eventCount++;
  const observers = new Set([...actors, ...witnesses]);
  for (const id of observers) {
    const person = id === "player" ? state.player : state.npcs.find((n) => n.id === id);
    if (person?.alive) remember(person, event.id);
  }
  // Persistent journal stores all domain events. Routine economic entries stay in the ledger.
  return event;
}
export function relation(state: WorldState, from: string, to: string): Relation {
  let edge = state.relations.find((item) => item.from === from && item.to === to);
  if (!edge) {
    edge = { from, to, trust: 0, affection: 0, fear: 0, resentment: 0, lastContact: state.minute };
    state.relations.push(edge);
  }
  return edge;
}
export function adjustRelation(
  state: WorldState,
  from: string,
  to: string,
  trust: number,
  affection = 0,
  fear = 0,
  resentment = 0,
): Relation {
  const edge = relation(state, from, to);
  edge.trust = clamp(edge.trust + trust, -100, 100);
  edge.affection = clamp(edge.affection + affection, -100, 100);
  edge.fear = clamp(edge.fear + fear, 0, 100);
  edge.resentment = clamp(edge.resentment + resentment, 0, 100);
  edge.lastContact = state.minute;
  return edge;
}

export type ItemInstance = { id: string; kind: string; acquiredTick: number; sourceId: string };
export type ProgressionState = {
  version: 1;
  updatedTick: number;
  day: number;
  gainedToday: number;
  lastSkills: Record<string, number>;
  perks: string[];
  items: Record<string, ItemInstance[]>;
  retired: boolean;
  retiredAt: number | null;
};
export type ProgressionView = {
  day: number;
  gainedToday: number;
  dailyLimit: number;
  slotLimit: number;
  slotsUsed: number;
  items: Record<string, ItemInstance[]>;
  perks: { id: string; name: string; effect: string }[];
  retired: boolean;
  retiredAt: number | null;
  shiftsCompleted: number;
};

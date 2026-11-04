import type { Location } from "./types.ts";
export type Attendance = {
  personId: string;
  businessId: string;
  minutes: number;
  since: number | null;
  day: number;
};
export type BackgroundTrip = {
  id: string;
  personId: string;
  from: Location;
  to: Location;
  goal: string;
  departedAt: number;
  arrivalAt: number;
};
export type ShockKind =
  "strike" | "public-works" | "shortage" | "recession" | "bankruptcy" | "migration" | "rent";
export type EconomicShock = {
  id: string;
  kind: ShockKind;
  businessId: string | null;
  startedAt: number;
  endsAt: number;
  severity: number;
  budget: number;
  status: "active" | "ended";
  sourceEventId: string | null;
};
export type ServiceDesk = {
  id: string;
  schemaVersion: 1;
  updatedTick: number;
  servedMinute: number;
  served: number;
  queue: { id: string; personId: string; joinedAt: number; expiresAt: number }[];
};
export type EconomyState = {
  services: Record<string, ServiceDesk>;
  version: 1;
  attendance: Record<string, Attendance>;
  activeWork: Record<string, string>;
  travel: Record<string, BackgroundTrip>;
  arrivals: { personId: string; tripId: string; minute: number }[];
  arrivalSortNeeded: boolean;
  inputs: Record<string, Record<string, number>>;
  wholesaler: Record<string, number>;
  produced: Record<string, number>;
  consumedInputs: Record<string, number>;
  tax: { businessId: string; salesAssessed: number; paid: number; arrears: number }[];
  shocks: EconomicShock[];
  cooldowns: Record<string, number>;
  eventCursor: number;
  lastDailyAt: number;
  lastPayroll: { personId: string; businessId: string; minutes: number; amount: number }[];
  lastDemand: Record<string, number>;
};
export type EconomyView = {
  services: { businessId: string; opens: number; closes: number; open: boolean; waiting: number }[];
  unemployment: number;
  averageWage: number;
  priceIndex: number;
  sales: number;
  taxPaid: number;
  taxArrears: number;
  traveling: number;
  attendedMinutes: number;
  shocks: EconomicShock[];
  wholesaleUnits: number;
  producedUnits: number;
};

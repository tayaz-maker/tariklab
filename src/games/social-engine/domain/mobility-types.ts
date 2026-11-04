import type { Point, Location } from "./types.ts";
export type WeatherKind = "clear" | "cloudy" | "rain" | "wind";
export type TimeSpeed = 0.5 | 1 | 2;
export type TransitTrip = {
  id: string;
  fromStop: string;
  toStop: string;
  arrivalTick: number;
  fare: number;
  startedTick: number;
};
export type Rental = {
  id: string;
  vehicleId: string;
  renterId: string | null;
  startTick: number;
  endTick: number;
  deposit: number;
  status: "available" | "active" | "overdue";
};
export type MobilityState = {
  version: 1;
  weather: { kind: WeatherKind; day: number };
  speed: TimeSpeed;
  parking: { id: string; capacity: number; vehicleIds: string[] }[];
  rentals: Rental[];
  trip: TransitTrip | null;
};
export type MobilityView = {
  speed: TimeSpeed;
  weather: {
    kind: WeatherKind;
    day: number;
    label: string;
    speedFactor: number;
    needFactor: number;
  };
  stops: {
    id: string;
    name: string;
    point: Point;
    fare: number;
    minutes: number;
    nearby: boolean;
  }[];
  parking: {
    id: string;
    name: string;
    point: Point;
    capacity: number;
    occupied: number;
    available: number;
  }[];
  rentals: {
    id: string;
    vehicleId: string;
    location: Location;
    name: string;
    dailyFee: number;
    deposit: number;
    status: Rental["status"];
    endsAt: number | null;
    parkedAt: string | null;
  }[];
  trip: (TransitTrip & { remainingMinutes: number }) | null;
  starterVehicleId: string;
};

export type FactionId = "dock" | "hill" | "night";
export type TerritoryId = "shore" | "market" | "hill";
export type SocialMember = {
  personId: string;
  role: "leader" | "officer" | "member";
  loyalty: number;
  joinedAt: number;
  lastServiceAt: number;
  services: number;
};
export type Faction = {
  id: FactionId;
  name: string;
  treasuryAccount: string;
  members: SocialMember[];
  rivals: FactionId[];
  heat: number;
};
export type Territory = {
  id: TerritoryId;
  name: string;
  buildingId: string;
  influence: Record<FactionId, number>;
  lastChangedAt: number;
};
export type KnowledgeMemory = {
  eventId: string;
  ownerId: string;
  sourceId: string;
  mode: "direct" | "rumor";
  confidence: number;
  salience: number;
  critical: boolean;
  learnedAt: number;
  lastDecayDay: number;
  chain: string[];
};
export type Testimony = {
  id: string;
  crimeId: string;
  speakerId: string;
  accusedId: string;
  basis: "direct" | "hearsay" | "unsupported";
  confidence: number;
  submittedAt: number;
  status: "unverified" | "corroborated" | "contradicted";
  reviewedAt: number | null;
};
export type StudyClubMember = {
  personId: string;
  standing: number;
  role: "newcomer" | "member" | "mentor";
};
export type SocialBond = {
  from: string;
  to: string;
  familiarity: number;
  loyalty: number;
  updatedAt: number;
};
export type PoliceCase = {
  id: string;
  crimeId: string;
  knownSuspectId: string | null;
  knownEvidence: string[];
  testimonyIds: string[];
  status: "queued" | "investigating" | "pursuit" | "custody" | "acquitted" | "fined";
  openedAt: number;
  updatedAt: number;
  outcome: string | null;
};
export type PoliceState = {
  dispatchCapacity: 2;
  cases: PoliceCase[];
  custody: { caseId: string; personId: string; startedAt: number; releaseAt: number } | null;
};
export type PoliceView = {
  capacity: 2;
  activeDispatches: number;
  cases: (PoliceCase & { knownSuspectName: string | null })[];
  custody: PoliceState["custody"];
};
export type SocialState = {
  police: PoliceState;
  version: 1;
  updatedTick: number;
  factions: Faction[];
  territories: Territory[];
  knowledge: Record<string, KnowledgeMemory[]>;
  bonds: SocialBond[];
  eventCursor: number;
  lastDay: number;
  lastRumorAt: Record<string, number>;
  factionChangedAt: Record<string, number>;
  testimonies: Testimony[];
  club: {
    id: "study-circle";
    name: string;
    leaderId: string;
    members: StudyClubMember[];
    activity: { personId: string; endsAt: number; startedAt: number } | null;
    lastSessionAt: Record<string, number>;
  };
};
export type SocialView = {
  police: PoliceView;
  factions: {
    id: FactionId;
    name: string;
    leaderName: string;
    memberCount: number;
    treasury: number;
    heat: number;
    rivals: FactionId[];
    membership: SocialMember | null;
  }[];
  territories: Territory[];
  bonds: SocialBond[];
  memories: (KnowledgeMemory & { text: string; kind: string })[];
  testimonies: Testimony[];
  club: {
    name: string;
    leaderName: string;
    memberCount: number;
    membership: StudyClubMember | null;
    activity: SocialState["club"]["activity"];
  };
};

/** Schema 4: housing, adult family decisions, education and recovery. Money is integer kuruş. */
export type LifeProperty = {
  id: string;
  name: string;
  buildingId: string;
  capacity: number;
  ownerId: string;
  askingPrice: number;
  weeklyRent: number;
  occupantHouseholdId: string | null;
  reservation: { householdId: string; expiresAt: number } | null;
};
export type Lease = {
  id: string;
  householdId: string;
  propertyId: string;
  payerId: string;
  landlordId: string;
  rent: number;
  deposit: number;
  depositAccount: string;
  startsAt: number;
  nextDueAt: number;
  arrears: number;
  status: "active" | "ended";
};
export type HouseholdBudget = {
  householdId: string;
  accountId: string;
  shares: Record<string, number>;
};
export type MutualConsent = {
  id: string;
  from: string;
  to: string;
  purpose: "date" | "marriage" | "parenthood";
  accepted: boolean;
  minute: number;
};
export type Partnership = {
  id: string;
  a: string;
  b: string;
  status: "dating" | "married" | "separated" | "widowed";
  startedAt: number;
  marriedAt: number | null;
  endedAt: number | null;
  previousHouseholdId: string;
  previousHomeId: string;
};
export type CourseDefinition = {
  id: string;
  name: string;
  fee: number;
  skill: string;
  minimumSkill: number;
  requiredSessions: number;
  sessionMinutes: number;
  unlocks: string[];
};
export type Enrollment = {
  id: string;
  personId: string;
  courseId: string;
  status: "enrolled" | "completed" | "cancelled";
  enrolledAt: number;
  attended: number;
  missed: number;
  nextSessionAt: number;
  activeUntil: number | null;
  certificateId: string | null;
};
export type CourseCertificate = {
  id: string;
  personId: string;
  courseId: string;
  issuedAt: number;
  enrollmentId: string;
};
export type LifeState = {
  version: 2;
  guardians: Record<string, string[]>;
  births: BirthRecord[];
  deaths: DeathRecord[];
  estates: EstateRecord[];
  demography: {
    initialPopulation: number;
    maxBirths: number;
    lastDailyAt: number;
    lastAgingYear: number;
    parenthoodAt: Record<string, number>;
  };
  properties: LifeProperty[];
  leases: Lease[];
  budgets: HouseholdBudget[];
  parentage: Record<string, string[]>;
  consents: MutualConsent[];
  partnerships: Partnership[];
  enrollments: Enrollment[];
  certificates: CourseCertificate[];
  aidLastAt: Record<string, number>;
  archivedHouseholds: string[];
  lastDailyAt: number;
};
export type LifeView = {
  children: { id: string; name: string; age: number; guardianNames: string[] }[];
  familyEvents: string[];
  estates: {
    id: string;
    personName: string;
    status: string;
    receivedCash: number;
    assetIds: string[];
  }[];
  birthsRemaining: number;
  canRequestChild: boolean;
  properties: LifeProperty[];
  household: {
    id: string;
    homeId: string;
    homeName: string;
    memberNames: string[];
    funds: number;
    ownContribution: number;
    rent: number;
    arrears: number;
    nextDueAt: number | null;
  };
  partnership: (Partnership & { partnerName: string }) | null;
  courses: (CourseDefinition & { enrollment: Enrollment | null; certified: boolean })[];
  aidAvailableAt: number;
  eligibleForAid: boolean;
  certificateNames: string[];
};

export type BirthRecord = {
  id: string;
  childId: string;
  parentIds: [string, string];
  householdId: string;
  minute: number;
};
export type DeathRecord = {
  id: string;
  personId: string;
  minute: number;
  cause: "natural" | "validated";
};
export type EstateDebt = {
  creditor: string;
  amount: number;
  paid: number;
  writtenOff: number;
  kind: "loan" | "rent";
  leaseId?: string;
};
export type EstateRecord = {
  id: string;
  personId: string;
  accountId: string;
  heirIds: string[];
  openedAt: number;
  settledAt: number | null;
  status: "settling" | "settled" | "public-custody";
  assets: string[];
  executorId: string;
  assetBeneficiaries: Record<string, string>;
  debts: EstateDebt[];
  distributions: { recipient: string; amount: number; assetIds: string[] }[];
};

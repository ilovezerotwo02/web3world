import { courseRoute } from "./course-data";

export type CoursePlotId = (typeof courseRoute)[number]["id"];
export type CoursePlotStatus = "active" | "harvested" | "unlocked" | "locked" | "reserved";
export type CourseGridSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const COURSE_PLOTS = courseRoute.map(({ id, order, title, seed, crop }) => ({
  id,
  order,
  title,
  seed,
  crop,
}));

export const COURSE_GRID_SLOTS: CourseGridSlot[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function coursePlotStatuses(
  web3Harvested: boolean,
  monadStarted = false,
  monadHarvested = false,
  contractStarted = false,
  contractHarvested = false,
): Record<CoursePlotId, CoursePlotStatus> {
  return {
    web3: web3Harvested ? "harvested" : "active",
    monad: monadHarvested ? "harvested" : monadStarted ? "active" : web3Harvested ? "unlocked" : "locked",
    contract: contractHarvested ? "harvested" : contractStarted ? "active" : monadHarvested ? "unlocked" : "locked",
  };
}

export function courseGridSlots(
  web3Harvested: boolean,
  monadStarted = false,
  monadHarvested = false,
  contractStarted = false,
  contractHarvested = false,
) {
  const statuses = coursePlotStatuses(web3Harvested, monadStarted, monadHarvested, contractStarted, contractHarvested);
  return COURSE_GRID_SLOTS.map((slot) => {
    const course = COURSE_PLOTS[slot - 1] ?? null;
    return {
      slot,
      course,
      status: course ? statuses[course.id] : "reserved" as const,
    };
  });
}

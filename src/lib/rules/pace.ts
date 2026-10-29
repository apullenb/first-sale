// Plain code: whether the owner's remaining time fits before launch day.
// The pace is about an hour of the owner's own time a day; waits on offices are never counted.

export const MINUTES_A_DAY = 60;
// Less spare time than this before launch day reads as tight
export const SPARE_DAYS_ON_TRACK = 7;

export interface LaunchPace {
  // Days of work left at about an hour a day
  workDays: number;
  // Days left before launch day after that work; negative when it doesn't fit
  spareDays: number;
  onTrack: boolean;
}

export function launchPace(minutesLeft: number, daysLeft: number): LaunchPace {
  const workDays = Math.ceil(Math.max(0, minutesLeft) / MINUTES_A_DAY);
  const spareDays = daysLeft - workDays;
  return { workDays, spareDays, onTrack: workDays === 0 || spareDays >= SPARE_DAYS_ON_TRACK };
}

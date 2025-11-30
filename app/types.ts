// types.ts
export type Matchup = {
  eventId: string | null;
  awayTeam: string | null;
  homeTeam: string | null;
  awayAbbr: string | null;
  homeAbbr: string | null;
  awayScore: number | null;
  homeScore: number | null;
  clock: string | null;
  period: number | null;
  detailedStatus: string | null;
  date: string | null;
  status: string | null;
  awayLogo?: string | null;
  homeLogo?: string | null;
  awayStanding?: string | null;
  homeStanding?: string | null;
};

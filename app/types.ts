// types.ts
export type Matchup = {
  eventId: string | null;
  awayTeam: string | null;
  homeTeam: string | null;
  awayAbbr: string | null;
  homeAbbr: string | null;
  awayScore: number | null;
  homeScore: number | null;
  clock: string | null;           // display clock (time remaining)
  period: number | null;          // quarter
  detailedStatus: string | null;  // e.g. "IN_PROGRESS","FINAL","SCHEDULED"
  date: string | null;
  status: string | null;

  // extras (optional)
  awayLogo?: string | null;
  homeLogo?: string | null;
  awayStanding?: string | null;
  homeStanding?: string | null;

  // situation extras
  possession?: string | null;     // team abbreviation that currently has the ball
  down?: number | null;           // current down (1,2,3,4) if available
  yardsToGo?: number | null;      // yards to go for first down
  ballOn?: string | null;         // e.g. "DEN 35" or numeric yardline representation
  lastPlayText?: string | null;   // last play description text (if present)
    // ✅ NEW — add these
  isFinal?: boolean
  gameTime?: string
  
};

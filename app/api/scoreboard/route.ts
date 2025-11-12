// app/api/scoreboard/route.ts
import { NextResponse } from "next/server";

type ResultArray = (string | null)[];
type Matchup = {
  eventId: string | null;
  awayTeam: string | null;
  homeTeam: string | null;
  awayAbbr: string | null;
  homeAbbr: string | null;
  date: string | null;
  status: string | null;
};

// Week 11 expectedMatchups (copy/paste into route.ts)
const expectedMatchups: { away: string; home: string }[] = [
  // Thursday Nov 13
  { away: "NYJ", home: "NE" },   // NY Jets at New England

  // Sunday Nov 16 (in the order on your PDF)
  { away: "WSH", home: "MIA" },  // Washington at Miami
  { away: "CAR", home: "ATL" },  // Carolina at Atlanta
  { away: "TB",  home: "BUF" },  // Tampa Bay at Buffalo
  { away: "HOU", home: "TEN" },  // Houston at Tennessee
  { away: "CHI", home: "MIN" },  // Chicago at Minnesota
  { away: "GB",  home: "NYG" },  // Green Bay at NY Giants
  { away: "CIN", home: "PIT" },  // Cincinnati at Pittsburgh
  { away: "LAC", home: "JAX" },  // LA Chargers at Jacksonville
  { away: "SEA", home: "LAR" },  // Seattle at LA Rams
  { away: "SF",  home: "ARI" },  // San Francisco at Arizona
  { away: "BAL", home: "CLE" },  // Baltimore at Cleveland
  { away: "KC",  home: "DEN" },  // Kansas City at Denver
  { away: "DET", home: "PHI" },  // Detroit at Philadelphia

  // Monday Nov 17
  { away: "DAL", home: "LV" },   // Dallas at Las Vegas
];

let cached: { ts: number; data: { results: ResultArray; matchups: Matchup[] } } | null = null;
const CACHE_TTL = 1000 * 60 * 6; // 6 minutes

function normalizeTeamAbbr(abbr: any): string | null {
  if (!abbr) return null;
  return String(abbr).toUpperCase();
}

function makeKey(away: string | undefined, home: string | undefined) {
  if (!away || !home) return null;
  return `${away.toUpperCase()}@${home.toUpperCase()}`;
}

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ source: "cache", ...cached.data, fetchedAt: cached.ts });
  }

  try {
    const scoreboardUrl = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
    const resp = await fetch(scoreboardUrl);
    if (!resp.ok) {
      return NextResponse.json({ source: "espn-error", status: resp.status, statusText: resp.statusText });
    }
    const json = await resp.json();
    const events = Array.isArray(json?.events) ? json.events : [];

    // map of eventKey -> winnerAbbr|null
    const eventWinnerMap = new Map<string, string | null>();

    // also build the raw matchups list from ESPN events
    const rawMatchups: Matchup[] = events.map((ev: any) => {
      try {
        const comp = ev?.competitions?.[0];
        const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home");
        const away = competitors.find((c: any) => c?.homeAway === "away");
        const homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation ?? home?.team?.shortDisplayName);
        const awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation ?? away?.team?.shortDisplayName);

        // determine winner if available
        const winner = competitors.find((c: any) => c?.winner === true);
        let winnerAbbr: string | null = null;
        if (winner?.team?.abbreviation) winnerAbbr = normalizeTeamAbbr(winner.team.abbreviation);
        else {
          // fallback compare scores if final
          const statusName = String(comp?.status?.type?.name || "").toLowerCase();
          const homeScore = parseInt(home?.score ?? "-1", 10);
          const awayScore = parseInt(away?.score ?? "-1", 10);
          if (statusName.includes("final")) {
            if (homeScore > awayScore) winnerAbbr = homeAbbr;
            else if (awayScore > homeScore) winnerAbbr = awayAbbr;
            else winnerAbbr = null;
          } else {
            winnerAbbr = null;
          }
        }

        // register winner in map under several key formats (away@home and reverse)
        const key = makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined);
        if (key) {
          eventWinnerMap.set(key, winnerAbbr);
          eventWinnerMap.set(`${homeAbbr}@${awayAbbr}`, winnerAbbr);
        }

        return {
          eventId: ev?.id ?? null,
          awayTeam: away?.team?.displayName ?? away?.team?.shortDisplayName ?? null,
          homeTeam: home?.team?.displayName ?? home?.team?.shortDisplayName ?? null,
          awayAbbr,
          homeAbbr,
          date: ev?.date ?? null,
          status: comp?.status?.type?.name ?? null,
        } as Matchup;
      } catch {
        return {
          eventId: ev?.id ?? null,
          awayTeam: null,
          homeTeam: null,
          awayAbbr: null,
          homeAbbr: null,
          date: null,
          status: null,
        } as Matchup;
      }
    });

    // Build ordered results array (aligned with expectedMatchups)
    const results: ResultArray = expectedMatchups.map((m) => {
      const key = makeKey(m.away, m.home);
      if (key && eventWinnerMap.has(key)) return eventWinnerMap.get(key) ?? null;
      const reverseKey = makeKey(m.home, m.away);
      if (reverseKey && eventWinnerMap.has(reverseKey)) return eventWinnerMap.get(reverseKey) ?? null;
      // Try to find a rawMatchups entry that matches tokens loosely
      const found = rawMatchups.find((r) => {
        const a = (r.awayAbbr ?? r.awayTeam ?? "").toString().toUpperCase();
        const h = (r.homeAbbr ?? r.homeTeam ?? "").toString().toUpperCase();
        return a.includes(m.away.toUpperCase()) && h.includes(m.home.toUpperCase());
      });
      if (found) {
        // key based on found entry
        const foundKey = makeKey(found.awayAbbr ?? undefined, found.homeAbbr ?? undefined);
        if (foundKey && eventWinnerMap.has(foundKey)) return eventWinnerMap.get(foundKey) ?? null;
      }
      return null;
    });

    // Build "matchups" normalized in the same order as expectedMatchups (so UI ordering is deterministic)
    const matchups: Matchup[] = expectedMatchups.map((m) => {
      // try to find a matching raw matchup entry (by tokens or by abbreviations)
      const match = rawMatchups.find((r) => {
        const aTokens = `${r.awayAbbr ?? r.awayTeam ?? ""}`.toUpperCase();
        const hTokens = `${r.homeAbbr ?? r.homeTeam ?? ""}`.toUpperCase();
        // direct tokens or reverse allowed
        return (aTokens.includes(m.away.toUpperCase()) && hTokens.includes(m.home.toUpperCase())) ||
               (aTokens.includes(m.home.toUpperCase()) && hTokens.includes(m.away.toUpperCase()));
      });

      if (match) return match;
      // fallback: empty placeholder if not found for that slot
      return {
        eventId: null,
        awayTeam: m.away,
        homeTeam: m.home,
        awayAbbr: m.away,
        homeAbbr: m.home,
        date: null,
        status: null,
      } as Matchup;
    });

    cached = { ts: Date.now(), data: { results, matchups } };
    return NextResponse.json({ source: "espn-mapped", results, matchups, fetchedAt: cached.ts });
  } catch (error: any) {
    console.error("scoreboard error:", error);
    if (cached) {
      return NextResponse.json({
        source: "cache-stale",
        results: cached.data.results,
        matchups: cached.data.matchups,
        fetchedAt: cached.ts,
        error: String(error),
      });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

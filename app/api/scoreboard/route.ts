// app/api/scoreboard/route.ts
import { NextResponse } from "next/server";

type ResultArray = (string | null)[];

// --- EDIT THIS: expectedMatchups must match your Pick'em column order (G1..G14) ---
// Put each matchup in the same order as your picks table columns.
// Format: { away: "LV", home: "DEN" } meaning LV @ DEN.
const expectedMatchups: { away: string; home: string }[] = [
  { away: "LV", home: "DEN" }, // G1  -> LV @ DEN
  { away: "ATL", home: "IND" }, // G2 -> ATL @ IND
  { away: "NYG", home: "CHI" }, // G3 -> NYG @ CHI
  { away: "BUF", home: "MIA" }, // G4 -> BUF @ MIA
  { away: "BAL", home: "MIN" }, // G5 -> BAL @ MIN
  { away: "CLE", home: "NYJ" }, // G6 -> CLE @ NYJ
  { away: "NE", home: "TB" },   // G7 -> NE @ TB
  { away: "NO", home: "CAR" },  // G8 -> NO @ CAR
  { away: "JAX", home: "HOU" }, // G9 -> JAC @ HOU
  { away: "ARI", home: "SEA" }, // G10 -> ARI @ SEA
  { away: "LAR", home: "SF" },  // G11 -> LAR @ SF
  { away: "DET", home: "WSH" }, // G12 -> DET @ WAS
  { away: "PIT", home: "LAC" }, // G13 -> PIT @ LAC
  { away: "PHI", home: "GB" },  // G14 -> PHI @ GB (MNF; will be null until final)
];
// -------------------------------------------------------------------------------

let cached: { ts: number; data: ResultArray } | null = null;
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
  // return cache quickly if present
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ source: "cache", results: cached.data, fetchedAt: cached.ts });
  }

  try {
    const scoreboardUrl = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
    const resp = await fetch(scoreboardUrl);
    if (!resp.ok) {
      return NextResponse.json({ source: "espn-error", status: resp.status, statusText: resp.statusText });
    }
    const json = await resp.json();
    const events = Array.isArray(json?.events) ? json.events : [];

    // prepare a map of ESPN eventKey -> winnerAbbr OR null if not final
    const eventWinnerMap = new Map<string, string | null>();

    events.forEach((ev: any) => {
      try {
        const comp = ev?.competitions?.[0];
        if (!comp) return;
        const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home");
        const away = competitors.find((c: any) => c?.homeAway === "away");

        const homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation);
        const awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation);
        const key = makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined);
        if (!key) return;

        // pick winner if flagged
        const winner = competitors.find((c: any) => c?.winner === true);
        if (winner?.team?.abbreviation) {
          eventWinnerMap.set(key, normalizeTeamAbbr(winner.team.abbreviation));
          return;
        }

        // fallback: if status final, use scores
        const statusName = String(comp?.status?.type?.name || "").toLowerCase();
        if (statusName.includes("final")) {
          const homeScore = parseInt(home?.score ?? "-1", 10);
          const awayScore = parseInt(away?.score ?? "-1", 10);
          if (homeScore > awayScore) {
            eventWinnerMap.set(key, homeAbbr);
          } else if (awayScore > homeScore) {
            eventWinnerMap.set(key, awayAbbr);
          } else {
            eventWinnerMap.set(key, null); // tie/unknown
          }
          return;
        }

        // not final
        eventWinnerMap.set(key, null);
      } catch {
        // ignore malformed event
      }
    });

    // Build results array in the order of expectedMatchups
    const results: ResultArray = expectedMatchups.map((m) => {
      const key = makeKey(m.away, m.home);
      // If the exact key exists in the map, return it.
      if (key && eventWinnerMap.has(key)) return eventWinnerMap.get(key) ?? null;
      // If not, try reverse (maybe ESPN used swapped home/away notation)
      const reverseKey = makeKey(m.home, m.away);
      if (reverseKey && eventWinnerMap.has(reverseKey)) return eventWinnerMap.get(reverseKey) ?? null;
      // Not found — return null (no data)
      return null;
    });

    cached = { ts: Date.now(), data: results };
    return NextResponse.json({ source: "espn-mapped", results, fetchedAt: cached.ts });
  } catch (error: any) {
    console.error("scoreboard error:", error);
    if (cached) {
      return NextResponse.json({
        source: "cache-stale",
        results: cached.data,
        fetchedAt: cached.ts,
        error: String(error),
      });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

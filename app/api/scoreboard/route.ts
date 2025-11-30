// app/api/scoreboard/route.ts
// Hard-coded weekly order for Week 13 (editorial pick-sheet order)

import { NextResponse } from "next/server";
// at the top of app/api/scoreboard/route.ts
import type { Matchup } from "../../types"; // <-- adjust path as needed

type ResultArray = (string | null)[];

// --------------------------- HARD-CODED expectedMatchups (Week 13) ---------------------------
const expectedMatchups: { away: string; home: string }[] = [
  { away: "HOU", home: "IND" },
  { away: "MIA", home: "NO" },
  { away: "ATL", home: "NYJ" },
  { away: "ARI", home: "TB" },
  { away: "LAR", home: "CAR" },
  { away: "MIN", home: "SEA" },
  { away: "BUF", home: "PIT" },
  { away: "LAC", home: "LV" },
  { away: "DEN", home: "WAS" },
  { away: "NYG", home: "NE" },
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

// --------------------------- LOGOS & STANDINGS ---------------------------
async function fetchTeamsLogoMap() {
  try {
    const teamsResp = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    if (!teamsResp.ok) return {};
    const teamsJson = await teamsResp.json();
    const arr = Array.isArray(teamsJson?.teams) ? teamsJson.teams : (teamsJson?.sports?.[0]?.leagues?.[0]?.teams ?? []);
    const map: Record<string, string | null> = {};
    for (const t of arr) {
      const teamObj = t?.team ?? t;
      if (!teamObj) continue;
      const abbr = (teamObj.abbreviation || teamObj.shortName || teamObj.displayName || "").toString().toUpperCase();
      let logo: string | null = null;
      if (Array.isArray(teamObj.logos) && teamObj.logos.length > 0) {
        logo = teamObj.logos[0]?.href ?? null;
      } else if (teamObj.logo) {
        logo = teamObj.logo;
      }
      if (abbr) map[abbr] = logo;
    }
    return map;
  } catch (e) {
    console.warn("teams fetch failed", e);
    return {};
  }
}

async function fetchStandingsMap() {
  try {
    const sResp = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings");
    if (!sResp.ok) return {};
    const sJson = await sResp.json();
    const map: Record<string, string | null> = {};
    const entries = (sJson?.records ?? []).flatMap((r: any) => r?.teamRecords ?? []) || [];
    for (const rec of entries) {
      const abbr = (rec?.team?.abbreviation || rec?.team?.shortDisplayName || "").toString().toUpperCase();
      const summary = rec?.summary ?? `${rec?.wins}-${rec?.losses}${rec?.ties ? `-${rec.ties}` : ""}`;
      map[abbr] = summary ?? null;
    }
    return map;
  } catch (e) {
    console.warn("standings fetch failed", e);
    return {};
  }
}

// --------------------------- ROUTE HANDLER ---------------------------
export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ source: "cache", ...cached.data, fetchedAt: cached.ts });
  }

  try {
    const scoreboardUrl = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
    const resp = await fetch(scoreboardUrl);
    if (!resp.ok) return NextResponse.json({ source: "espn-error", status: resp.status, statusText: resp.statusText });
    const json = await resp.json();
    const events = Array.isArray(json?.events) ? json.events : [];

    const eventWinnerMap = new Map<string, string | null>();
    const rawMatchups: Matchup[] = events.map((ev: any) => {
  let awayAbbr: string | null = null;
  let homeAbbr: string | null = null;
  try {
    const comp = ev?.competitions?.[0];
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const home = competitors.find((c: any) => c?.homeAway === "home");
    const away = competitors.find((c: any) => c?.homeAway === "away");
    homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation ?? home?.team?.shortDisplayName);
    awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation ?? away?.team?.shortDisplayName);

    const homeScoreNum = home?.score != null && home?.score !== "" ? parseInt(String(home.score), 10) : null;
    const awayScoreNum = away?.score != null && away?.score !== "" ? parseInt(String(away.score), 10) : null;

    const clock = comp?.status?.displayClock ?? null;
    const period = comp?.status?.period != null
      ? (typeof comp.status.period === "number" ? comp.status.period : parseInt(String(comp.status.period), 10))
      : null;
    const detailedStatus = comp?.status?.type?.state ?? comp?.status?.type?.name ?? null;
    const statusName = comp?.status?.type?.name ?? null;

    const winner = competitors.find((c: any) => c?.winner === true);
    let winnerAbbr: string | null = winner?.team?.abbreviation ? normalizeTeamAbbr(winner.team.abbreviation) : null;
    if (!winnerAbbr) {
      const sname = String(statusName || "").toLowerCase();
      const hs = homeScoreNum != null ? homeScoreNum : -1;
      const as = awayScoreNum != null ? awayScoreNum : -1;
      if (sname.includes("final")) {
        if (hs > as) winnerAbbr = homeAbbr;
        else if (as > hs) winnerAbbr = awayAbbr;
        else winnerAbbr = null;
      } else winnerAbbr = null;
    }

    const key = makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined);
    if (key) {
      eventWinnerMap.set(key, winnerAbbr);
      eventWinnerMap.set(makeKey(homeAbbr ?? undefined, awayAbbr ?? undefined)!, winnerAbbr);
    }

    return {
      eventId: ev?.id ?? null,
      awayTeam: away?.team?.displayName ?? away?.team?.shortDisplayName ?? null,
      homeTeam: home?.team?.displayName ?? home?.team?.shortDisplayName ?? null,
      awayAbbr,
      homeAbbr,
      awayScore: awayScoreNum,
      homeScore: homeScoreNum,
      clock,
      period,
      detailedStatus,
      date: ev?.date ?? null,
      status: statusName ?? null,
    } as Matchup;
  } catch {
    // fallback ensures variables exist
    return {
      eventId: ev?.id ?? null,
      awayTeam: null,
      homeTeam: null,
      awayAbbr,
      homeAbbr,
      awayScore: null,
      homeScore: null,
      clock: null,
      period: null,
      detailedStatus: null,
      date: null,
      status: null,
    } as Matchup;
  }
});


    // Fetch logos & standings
    const logoMap = await fetchTeamsLogoMap();
    const standingsMap = await fetchStandingsMap();

    const results: ResultArray = expectedMatchups.map((m) => {
      const key = makeKey(m.away, m.home);
      if (key && eventWinnerMap.has(key)) return eventWinnerMap.get(key) ?? null;
      const reverseKey = makeKey(m.home, m.away);
      if (reverseKey && eventWinnerMap.has(reverseKey)) return eventWinnerMap.get(reverseKey) ?? null;
      const found = rawMatchups.find((r) => {
        const a = (r.awayAbbr ?? r.awayTeam ?? "").toString().toUpperCase();
        const h = (r.homeAbbr ?? r.homeTeam ?? "").toString().toUpperCase();
        return a.includes(m.away.toUpperCase()) && h.includes(m.home.toUpperCase());
      });
      if (found) {
        const foundKey = makeKey(found.awayAbbr ?? undefined, found.homeAbbr ?? undefined);
        if (foundKey && eventWinnerMap.has(foundKey)) return eventWinnerMap.get(foundKey) ?? null;
      }
      return null;
    });

    const matchups: Matchup[] = expectedMatchups.map((m) => {
      const match = rawMatchups.find((r) => {
        const aTokens = `${r.awayAbbr ?? r.awayTeam ?? ""}`.toUpperCase();
        const hTokens = `${r.homeAbbr ?? r.homeTeam ?? ""}`.toUpperCase();
        return (aTokens.includes(m.away.toUpperCase()) && hTokens.includes(m.home.toUpperCase())) ||
               (aTokens.includes(m.home.toUpperCase()) && hTokens.includes(m.away.toUpperCase()));
      });

      if (match) {
        return {
          ...match,
          awayLogo: logoMap[match.awayAbbr ?? ""] ?? null,
          homeLogo: logoMap[match.homeAbbr ?? ""] ?? null,
          awayStanding: standingsMap[match.awayAbbr ?? ""] ?? null,
          homeStanding: standingsMap[match.homeAbbr ?? ""] ?? null,
        };
      }

      return {
        eventId: null,
        awayTeam: m.away,
        homeTeam: m.home,
        awayAbbr: m.away,
        homeAbbr: m.home,
        awayScore: null,
        homeScore: null,
        clock: null,
        period: null,
        detailedStatus: null,
        date: null,
        status: null,
        awayLogo: logoMap[m.away] ?? null,
        homeLogo: logoMap[m.home] ?? null,
        awayStanding: standingsMap[m.away] ?? null,
        homeStanding: standingsMap[m.home] ?? null,
      } as Matchup;
    });

    cached = { ts: Date.now(), data: { results, matchups } };
    return NextResponse.json({ source: "espn-mapped-hardcoded", results, matchups, fetchedAt: cached.ts });
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

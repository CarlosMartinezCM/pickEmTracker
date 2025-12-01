// app/api/scoreboard/route.ts
// Hard-coded weekly order for Week 13 (editorial pick-sheet order)

import { NextResponse } from "next/server";
// adjust the path to your types file if needed
import type { Matchup } from "../../types";

type ResultArray = (string | null)[];

// --------------------------- HARD-CODED expectedMatchups (Week 13) ---------------------------
// Replace this each week with the exact order you want shown on the site.
const expectedMatchups: { away: string; home: string }[] = [
  { away: "SF", home: "CLE" },
  { away: "JAX", home: "TEN" },
  { away: "HOU", home: "IND" },
  { away: "NO", home: "MIA" },
  { away: "ATL", home: "NYJ" },
  { away: "ARI", home: "TB" },
  { away: "LAR", home: "CAR" },
  { away: "MIN", home: "SEA" },
  { away: "BUF", home: "PIT" },
  { away: "LV", home: "LAC" },
  // Use ESPN's canonical abbreviation for Washington
  { away: "DEN", home: "WSH" },
  { away: "NYG", home: "NE" },
];

// ----- Small abbreviation alias map (editorial -> ESPN canonical) -----
const ABBR_ALIASES: Record<string, string> = {
  // editorial => ESPN canonical
  WAS: "WSH", // editorial shorthand -> ESPN's WSH
  WSH: "WSH",
  OAK: "LV", // legacy -> current (example)
  SD: "LAC", // legacy -> current (example)
  // add more if you discover mismatches
};

function normalizeForMatch(input?: string | null) {
  if (!input) return input ?? null;
  const up = String(input).toUpperCase();
  return ABBR_ALIASES[up] ?? up;
}

let cached: { ts: number; data: { results: ResultArray; matchups: Matchup[] } } | null = null;
// Default cache time (ms)
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
    // teamsJson.teams is often an array of group objects; flatten.
    const arr = Array.isArray(teamsJson?.teams) ? teamsJson.teams : (teamsJson?.sports?.[0]?.leagues?.[0]?.teams ?? []);
    const map: Record<string, string | null> = {};
    for (const t of arr) {
      const teamObj = t?.team ?? t; // sometimes wrapped
      if (!teamObj) continue;
      const abbr = (teamObj.abbreviation || teamObj.shortName || teamObj.displayName || "").toString().toUpperCase();
      // logos could be in teamObj.logos (array) or teamObj.logo
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
    // defensive traversal
    for (const r of sJson.records ?? []) {
      const recs = r?.teamRecords ?? [];
      for (const rec of recs) {
        const abbr = (rec?.team?.abbreviation || rec?.team?.shortDisplayName || "").toString().toUpperCase();
        const summary = rec?.summary ?? `${rec?.wins}-${rec?.losses}${rec?.ties ? `-${rec.ties}` : ""}`;
        map[abbr] = summary ?? null;
      }
    }
    // fallback older shape
    if (Object.keys(map).length === 0 && Array.isArray(sJson?.children)) {
      for (const g of sJson.children) {
        const recs = g?.teamRecords ?? [];
        for (const rec of recs) {
          const abbr = (rec?.team?.abbreviation || rec?.team?.shortDisplayName || "").toString().toUpperCase();
          const w = rec?.team?.record?.summary ?? (rec?.stats?.find((x: any) => x?.name === "record")?.displayValue ?? null);
          map[abbr] = w ?? null;
        }
      }
    }
    return map;
  } catch (e) {
    console.warn("standings fetch failed", e);
    return {};
  }
}

// --------------------------- ROUTE HANDLER ---------------------------
export async function GET() {
  // Return cached if fresh
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

    // build raw matchups list from ESPN events
    const rawMatchups: Matchup[] = events.map((ev: any) => {
      try {
        const comp = ev?.competitions?.[0];
        const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home");
        const away = competitors.find((c: any) => c?.homeAway === "away");
        const homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation ?? home?.team?.shortDisplayName);
        const awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation ?? away?.team?.shortDisplayName);

        // parse scores (numbers or null)
        const homeScoreNum =
          home?.score != null && home?.score !== "" ? parseInt(String(home.score), 10) : null;
        const awayScoreNum =
          away?.score != null && away?.score !== "" ? parseInt(String(away.score), 10) : null;

        // clock, period, detailed status
        const clock = comp?.status?.displayClock ?? null;
        const period = comp?.status?.period != null ? (typeof comp.status.period === "number" ? comp.status.period : parseInt(String(comp.status.period), 10)) : null;
        const detailedStatus = comp?.status?.type?.state ?? comp?.status?.type?.name ?? null;
        const statusName = comp?.status?.type?.name ?? null;

        // determine winner if available
        const winner = competitors.find((c: any) => c?.winner === true);
        let winnerAbbr: string | null = null;
        if (winner?.team?.abbreviation) winnerAbbr = normalizeTeamAbbr(winner.team.abbreviation);
        else {
          const sname = String(statusName || "").toLowerCase();
          const hs = homeScoreNum != null ? homeScoreNum : -1;
          const as = awayScoreNum != null ? awayScoreNum : -1;
          if (sname.includes("final")) {
            if (hs > as) winnerAbbr = homeAbbr;
            else if (as > hs) winnerAbbr = awayAbbr;
            else winnerAbbr = null;
          } else {
            winnerAbbr = null;
          }
        }

        // register winner under both keys (away@home and home@away)
        const key = makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined);
        if (key) {
          eventWinnerMap.set(key, winnerAbbr);
          // also register reversed key for lookup flexibility
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
      } catch (e) {
        // safe fallback if parsing fails
        return {
          eventId: ev?.id ?? null,
          awayTeam: null,
          homeTeam: null,
          awayAbbr: null,
          homeAbbr: null,
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

    // Build ordered results array aligned with expectedMatchups
    const results: ResultArray = expectedMatchups.map((m) => {
      // normalize expected abbreviations for matching
      const expectedAway = normalizeForMatch(m.away);
      const expectedHome = normalizeForMatch(m.home);

      const key = makeKey(expectedAway ?? undefined, expectedHome ?? undefined);
      if (key && eventWinnerMap.has(key)) return eventWinnerMap.get(key) ?? null;
      const reverseKey = makeKey(expectedHome ?? undefined, expectedAway ?? undefined);
      if (reverseKey && eventWinnerMap.has(reverseKey)) return eventWinnerMap.get(reverseKey) ?? null;

      // fallback: try to find a rawMatchups entry that matches tokens loosely (defensive)
      const found = rawMatchups.find((r) => {
        const a = (r.awayAbbr ?? r.awayTeam ?? "").toString().toUpperCase();
        const h = (r.homeAbbr ?? r.homeTeam ?? "").toString().toUpperCase();
        return (a === expectedAway && h === expectedHome) ||
          (a === expectedHome && h === expectedAway) ||
          (a.includes(expectedAway ?? "") && h.includes(expectedHome ?? "")) ||
          (a.includes(expectedHome ?? "") && h.includes(expectedAway ?? ""));

      });
      if (found) {
        const foundKey = makeKey(found.awayAbbr ?? undefined, found.homeAbbr ?? undefined);
        if (foundKey && eventWinnerMap.has(foundKey)) return eventWinnerMap.get(foundKey) ?? null;
      }
      return null;
    });

    // Build the matchups array to return (normalized and aligned)
    const matchups: Matchup[] = expectedMatchups.map((m) => {
      const expectedAway = normalizeForMatch(m.away);
      const expectedHome = normalizeForMatch(m.home);

      const match = rawMatchups.find((r) => {
        const aTokens = `${r.awayAbbr ?? r.awayTeam ?? ""}`.toUpperCase();
        const hTokens = `${r.homeAbbr ?? r.homeTeam ?? ""}`.toUpperCase();
        return (aTokens === expectedAway && hTokens === expectedHome) ||
          (aTokens === expectedHome && hTokens === expectedAway) ||
          (aTokens.includes(expectedAway ?? "") && hTokens.includes(expectedHome ?? "")) ||
          (aTokens.includes(expectedHome ?? "") && hTokens.includes(expectedAway ?? ""));
      });

      if (match) return {
        ...match,
        awayLogo: logoMap[match.awayAbbr ?? ""] ?? null,
        homeLogo: logoMap[match.homeAbbr ?? ""] ?? null,
        awayStanding: standingsMap[match.awayAbbr ?? ""] ?? null,
        homeStanding: standingsMap[match.homeAbbr ?? ""] ?? null,
      };

      // fallback placeholder if not found
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

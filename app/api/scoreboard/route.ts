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

// helper: normalize abbr
function normalizeTeamAbbr(abbr: any): string | null {
  if (!abbr) return null;
  return String(abbr).toUpperCase();
}
function makeKey(away: string | undefined, home: string | undefined) {
  if (!away || !home) return null;
  return `${away.toUpperCase()}@${home.toUpperCase()}`;
}

let cached: { ts: number; data: { results: ResultArray; matchups: Matchup[] } } | null = null;
const CACHE_TTL = 1000 * 60 * 6; // 6 minutes

// --------------------------- utility to fetch remote weekly order ---------------------------
async function tryFetchWeeklyOrder(): Promise<{ away: string; home: string }[] | null> {
  try {
    const url = process.env.WEEKLY_ORDER_URL;
    if (!url) return null;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    // if the JSON uses { week: N, matchups: [...] } prefer matchups only when provided
    if (Array.isArray(j?.matchups)) {
      // optional: check week matching if CURRENT_WEEK set
      const expectedWeek = process.env.CURRENT_WEEK ? Number(process.env.CURRENT_WEEK) : undefined;
      if (expectedWeek && j.week && Number(j.week) !== expectedWeek) {
        // mismatch: still allow but you can decide to ignore. Here we'll accept it.
      }
      // basic validation: all entries have away/home
      const ok = j.matchups.every((m: any) => m && m.away && m.home);
      if (ok) return j.matchups.map((m: any) => ({ away: String(m.away).toUpperCase(), home: String(m.home).toUpperCase() }));
    }
    // Some external sources might return plain array of pairs
    if (Array.isArray(j) && j.length > 0 && j[0].away && j[0].home) {
      return j.map((m: any) => ({ away: String(m.away).toUpperCase(), home: String(m.home).toUpperCase() }));
    }
    return null;
  } catch (e) {
    console.warn("weekly-order fetch failed:", e);
    return null;
  }
}

// --------------------------- main handler ---------------------------
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

    // Build rawMatchups from ESPN (includes abbrs, date, status)
    const rawMatchups: Matchup[] = events.map((ev: any) => {
      try {
        const comp = ev?.competitions?.[0];
        const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home");
        const away = competitors.find((c: any) => c?.homeAway === "away");
        const homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation ?? home?.team?.shortDisplayName);
        const awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation ?? away?.team?.shortDisplayName);
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
        return { eventId: ev?.id ?? null, awayTeam: null, homeTeam: null, awayAbbr: null, homeAbbr: null, date: null, status: null } as Matchup;
      }
    });

    // Try remote weekly order first (WEEKLY_ORDER_URL)
    let expectedMatchups: { away: string; home: string }[] | null = await tryFetchWeeklyOrder();

    // If no remote/order available, auto-generate by sorting ESPN events by datetime
    if (!expectedMatchups) {
      // sort events by kickoff date and map to {away, home} (use abbrs if available)
      const sorted = rawMatchups
        .slice()
        .sort((a, b) => {
          const ta = a.date ? new Date(a.date).getTime() : 0;
          const tb = b.date ? new Date(b.date).getTime() : 0;
          return ta - tb;
        })
        .map(r => ({ away: (r.awayAbbr ?? r.awayTeam ?? "").toString().toUpperCase(), home: (r.homeAbbr ?? r.homeTeam ?? "").toString().toUpperCase() }));

      expectedMatchups = sorted;
    }

    // Build map of winners (existing logic)
    const eventWinnerMap = new Map<string, string | null>();
    // determine winners for rawMatchups (same logic as before)
    events.forEach((ev: any) => {
      try {
        const comp = ev?.competitions?.[0];
        if (!comp) return;
        const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
        const home = competitors.find((c: any) => c?.homeAway === "home");
        const away = competitors.find((c: any) => c?.homeAway === "away");
        const homeAbbr = normalizeTeamAbbr(home?.team?.abbreviation);
        const awayAbbr = normalizeTeamAbbr(away?.team?.abbreviation);

        const winner = competitors.find((c: any) => c?.winner === true);
        if (winner?.team?.abbreviation) {
          eventWinnerMap.set(makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined)!, normalizeTeamAbbr(winner.team.abbreviation));
          eventWinnerMap.set(makeKey(homeAbbr ?? undefined, awayAbbr ?? undefined)!, normalizeTeamAbbr(winner.team.abbreviation));
          return;
        }

        const statusName = String(comp?.status?.type?.name || "").toLowerCase();
        if (statusName.includes("final")) {
          const homeScore = parseInt(home?.score ?? "-1", 10);
          const awayScore = parseInt(away?.score ?? "-1", 10);
          if (homeScore > awayScore) {
            eventWinnerMap.set(makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined)!, homeAbbr);
            eventWinnerMap.set(makeKey(homeAbbr ?? undefined, awayAbbr ?? undefined)!, homeAbbr);
          } else if (awayScore > homeScore) {
            eventWinnerMap.set(makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined)!, awayAbbr);
            eventWinnerMap.set(makeKey(homeAbbr ?? undefined, awayAbbr ?? undefined)!, awayAbbr);
          } else {
            eventWinnerMap.set(makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined)!, null);
            eventWinnerMap.set(makeKey(homeAbbr ?? undefined, awayAbbr ?? undefined)!, null);
          }
        } else {
          eventWinnerMap.set(makeKey(awayAbbr ?? undefined, homeAbbr ?? undefined)!, null);
          eventWinnerMap.set(makeKey(homeAbbr ?? undefined, awayAbbr ?? undefined)!, null);
        }
      } catch {}
    });

    // Build results in the same order as expectedMatchups
    const results: ResultArray = expectedMatchups.map((m) => {
      const key = makeKey(m.away, m.home);
      if (key && eventWinnerMap.has(key)) return eventWinnerMap.get(key) ?? null;
      const reverseKey = makeKey(m.home, m.away);
      if (reverseKey && eventWinnerMap.has(reverseKey)) return eventWinnerMap.get(reverseKey) ?? null;

      // fallback: try to find in rawMatchups by tokens
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

    // Build the matchups array to return (normalized and aligned)
    const matchups: Matchup[] = expectedMatchups.map((m) => {
      const match = rawMatchups.find((r) => {
        const aTokens = `${r.awayAbbr ?? r.awayTeam ?? ""}`.toUpperCase();
        const hTokens = `${r.homeAbbr ?? r.homeTeam ?? ""}`.toUpperCase();
        return (aTokens.includes(m.away.toUpperCase()) && hTokens.includes(m.home.toUpperCase())) ||
               (aTokens.includes(m.home.toUpperCase()) && hTokens.includes(m.away.toUpperCase()));
      });
      if (match) return match;
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

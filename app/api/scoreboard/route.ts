export {};

import { NextResponse } from "next/server";
import type { Matchup } from "../../types";

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

type ResultArray = Array<string | null>;

// Wild Card Weekend expectedMatchups (NFL 2025)
const expectedMatchups: { away: string; home: string }[] = [
  // Saturday, Jan. 10
  { away: "LAR", home: "CAR" }, // 4:30 pm
  { away: "GB",  home: "CHI" }, // 8:00 pm

  // Sunday, Jan. 11
  { away: "BUF", home: "JAX" }, // 1:00 pm
  { away: "SF",  home: "PHI" }, // 4:30 pm
  { away: "LAC", home: "NE"  }, // 8:00 pm

  // Monday, Jan. 12
  { away: "HOU", home: "PIT" }, // 8:00 pm
];


/* ------------------------------------------------------------------ */
/* ABBREVIATION NORMALIZATION (ESPN → EDITORIAL) */
/* ------------------------------------------------------------------ */

const ABBR_ALIASES: Record<string, string> = {
  WSH: "WAS",
  OAK: "LV",
  SD: "LAC",
};

function normalizeAbbr(input?: string | null): string | null {
  if (!input) return null;
  const up = String(input).toUpperCase();
  return ABBR_ALIASES[up] ?? up;
}

/* ------------------------------------------------------------------ */
/* CACHE */
/* ------------------------------------------------------------------ */

let cached:
  | {
      ts: number;
      data: { results: ResultArray; matchups: Matchup[] };
    }
  | null = null;

const CACHE_TTL = 1000 * 60 * 6;

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function makeKey(away?: string | null, home?: string | null) {
  if (!away || !home) return null;
  return `${away}@${home}`;
}

/* ------------------------------------------------------------------ */
/* ROUTE */
/* ------------------------------------------------------------------ */

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      source: "cache",
      ...cached.data,
      fetchedAt: cached.ts,
    });
  }

  try {
    const resp = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    if (!resp.ok) {
      return NextResponse.json(
        { error: "ESPN fetch failed" },
        { status: resp.status }
      );
    }

    const json = await resp.json();
    const events = Array.isArray(json?.events) ? json.events : [];

    const eventWinnerMap = new Map<string, string | null>();
    const rawMatchups: Matchup[] = [];

    /* -------------------------------------------------------------- */
    /* PARSE ESPN EVENTS */
    /* -------------------------------------------------------------- */

    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors ?? [];
      const home = competitors.find((c: any) => c.homeAway === "home");
      const away = competitors.find((c: any) => c.homeAway === "away");

      const homeAbbr = normalizeAbbr(home?.team?.abbreviation);
      const awayAbbr = normalizeAbbr(away?.team?.abbreviation);

      const homeScore = home?.score ? Number(home.score) : null;
      const awayScore = away?.score ? Number(away.score) : null;

      const status = comp?.status?.type?.name ?? null;

      /* ------------------------------------------------------------ */
      /* DETERMINE WINNER */
      /* ------------------------------------------------------------ */

      let winnerAbbr: string | null = null;

      const declaredWinner = competitors.find((c: any) => c.winner === true);
      if (declaredWinner?.team?.abbreviation) {
        winnerAbbr = normalizeAbbr(declaredWinner.team.abbreviation);
      } else if (status?.toLowerCase().includes("final")) {
        if (homeScore !== null && awayScore !== null) {
          if (homeScore > awayScore) winnerAbbr = homeAbbr;
          if (awayScore > homeScore) winnerAbbr = awayAbbr;
        }
      }

      const key = makeKey(awayAbbr, homeAbbr);
      if (key) {
        eventWinnerMap.set(key, winnerAbbr);
        eventWinnerMap.set(makeKey(homeAbbr, awayAbbr)!, winnerAbbr);
      }

      rawMatchups.push({
        eventId: ev.id ?? null,
        awayTeam: away?.team?.displayName ?? null,
        homeTeam: home?.team?.displayName ?? null,
        awayAbbr,
        homeAbbr,
        awayScore,
        homeScore,
        clock: comp?.status?.displayClock ?? null,
        period: comp?.status?.period ?? null,
        detailedStatus: comp?.status?.type?.state ?? null,
        date: ev?.date ?? null,
        status,
      });
    }

    /* -------------------------------------------------------------- */
    /* BUILD RESULTS ARRAY */
    /* -------------------------------------------------------------- */

    const results: ResultArray = expectedMatchups.map(({ away, home }) => {
      const key = makeKey(away, home);
      if (key && eventWinnerMap.has(key)) {
        return eventWinnerMap.get(key) ?? null;
      }
      return null;
    });

    /* -------------------------------------------------------------- */
    /* BUILD MATCHUPS ARRAY */
    /* -------------------------------------------------------------- */

    const matchups: Matchup[] = expectedMatchups.map(({ away, home }) => {
      const found = rawMatchups.find(
        (m) => m.awayAbbr === away && m.homeAbbr === home
      );

      return (
        found ?? {
          eventId: null,
          awayTeam: away,
          homeTeam: home,
          awayAbbr: away,
          homeAbbr: home,
          awayScore: null,
          homeScore: null,
          clock: null,
          period: null,
          detailedStatus: null,
          date: null,
          status: null,
        }
      );
    });

    cached = {
      ts: Date.now(),
      data: { results, matchups },
    };

    return NextResponse.json({
      source: "espn-normalized-editorial",
      results,
      matchups,
      fetchedAt: cached.ts,
    });
  } catch (err: any) {
    console.error("scoreboard error:", err);

    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

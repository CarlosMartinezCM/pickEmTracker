export {};

import { NextResponse } from "next/server";
import type { Matchup } from "../../types";

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

type ResultArray = Array<string | null>;

/* ------------------------------------------------------------------ */
/* ESPN ABBREVIATION NORMALIZATION */
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
      data: {
        results: ResultArray;
        matchups: Matchup[];
        week: number | null;
        season: number | null;
      };
    }
  | null = null;

// Cache for 2 minutes.
// Shorter than before so live/final scores update quickly.
const CACHE_TTL = 1000 * 60 * 2;

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function makeKey(
  away?: string | null,
  home?: string | null
) {
  if (!away || !home) return null;

  return `${away}@${home}`;
}

/* ------------------------------------------------------------------ */
/* GET CURRENT NFL WEEK */
/* ------------------------------------------------------------------ */

function getCurrentNFLWeek(
  events: any[]
): number | null {
  for (const ev of events) {
    const weekNumber = ev?.week?.number;

    if (
      typeof weekNumber === "number" &&
      Number.isFinite(weekNumber)
    ) {
      return weekNumber;
    }

    const competitionWeek =
      ev?.competitions?.[0]?.week?.number;

    if (
      typeof competitionWeek === "number" &&
      Number.isFinite(competitionWeek)
    ) {
      return competitionWeek;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* ROUTE */
/* ------------------------------------------------------------------ */

export async function GET() {
  /* -------------------------------------------------------------- */
  /* CACHE */
  /* -------------------------------------------------------------- */

  if (
    cached &&
    Date.now() - cached.ts < CACHE_TTL
  ) {
    return NextResponse.json({
      source: "cache",
      ...cached.data,
      fetchedAt: cached.ts,
    });
  }

  try {
    /* ------------------------------------------------------------ */
    /* ESPN SCOREBOARD */
    /* ------------------------------------------------------------ */

    const url =
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

    const resp = await fetch(url, {
      headers: {
        Accept: "application/json",
      },

      // Next.js server-side fetch:
      // don't let Next.js keep an old response around.
      cache: "no-store",
    });

    if (!resp.ok) {
      console.error(
        "ESPN fetch failed:",
        resp.status,
        resp.statusText
      );

      return NextResponse.json(
        {
          error: "ESPN fetch failed",
          status: resp.status,
          statusText: resp.statusText,
        },
        {
          status: resp.status,
        }
      );
    }

    const json = await resp.json();

    const events = Array.isArray(json?.events)
      ? json.events
      : [];

    /* ------------------------------------------------------------ */
    /* SEASON / WEEK */
    /* ------------------------------------------------------------ */

    const season =
      Number(json?.season?.year) ||
      Number(json?.leagues?.[0]?.season?.year) ||
      null;

    const week =
  getCurrentNFLWeek(events) ??
  (Number(json?.week?.number) || null);

    /* ------------------------------------------------------------ */
    /* PARSE ESPN EVENTS */
    /* ------------------------------------------------------------ */

    const eventWinnerMap = new Map<
      string,
      string | null
    >();

    const matchups: Matchup[] = [];

    for (const ev of events) {
      const comp = ev?.competitions?.[0];

      if (!comp) continue;

      const competitors = Array.isArray(
        comp?.competitors
      )
        ? comp.competitors
        : [];

      const home = competitors.find(
        (c: any) => c?.homeAway === "home"
      );

      const away = competitors.find(
        (c: any) => c?.homeAway === "away"
      );

      if (!home || !away) continue;

      /* ---------------------------------------------------------- */
      /* TEAM INFO */
      /* ---------------------------------------------------------- */

      const homeAbbr = normalizeAbbr(
        home?.team?.abbreviation
      );

      const awayAbbr = normalizeAbbr(
        away?.team?.abbreviation
      );

      /* ---------------------------------------------------------- */
      /* SCORES */
      /* ---------------------------------------------------------- */

      const homeScore =
        home?.score !== undefined &&
        home?.score !== null &&
        home?.score !== ""
          ? Number(home.score)
          : null;

      const awayScore =
        away?.score !== undefined &&
        away?.score !== null &&
        away?.score !== ""
          ? Number(away.score)
          : null;

      /* ---------------------------------------------------------- */
      /* STATUS */
      /* ---------------------------------------------------------- */

      const status =
        comp?.status?.type?.name ??
        null;

      const detailedStatus =
        comp?.status?.type?.state ??
        null;

      /* ---------------------------------------------------------- */
      /* DETERMINE WINNER */
      /* ---------------------------------------------------------- */

      let winnerAbbr: string | null = null;

      // ESPN normally supplies winner=true for completed games.
      const declaredWinner =
        competitors.find(
          (c: any) => c?.winner === true
        );

      if (
        declaredWinner?.team?.abbreviation
      ) {
        winnerAbbr = normalizeAbbr(
          declaredWinner.team.abbreviation
        );
      }

      // Backup: determine winner from final score.
      else if (
        detailedStatus === "post" ||
        status
          ?.toLowerCase()
          .includes("final")
      ) {
        if (
          homeScore !== null &&
          awayScore !== null
        ) {
          if (homeScore > awayScore) {
            winnerAbbr = homeAbbr;
          } else if (awayScore > homeScore) {
            winnerAbbr = awayAbbr;
          }
        }
      }

      /* ---------------------------------------------------------- */
      /* WINNER LOOKUP */
      /* ---------------------------------------------------------- */

      const key = makeKey(
        awayAbbr,
        homeAbbr
      );

      if (key) {
        eventWinnerMap.set(
          key,
          winnerAbbr
        );

        // Also allow reverse lookup.
        const reverseKey = makeKey(
          homeAbbr,
          awayAbbr
        );

        if (reverseKey) {
          eventWinnerMap.set(
            reverseKey,
            winnerAbbr
          );
        }
      }

      /* ---------------------------------------------------------- */
      /* MATCHUP */
      /* ---------------------------------------------------------- */

      matchups.push({
        eventId: ev?.id ?? null,

        awayTeam:
          away?.team?.displayName ??
          away?.team?.name ??
          null,

        homeTeam:
          home?.team?.displayName ??
          home?.team?.name ??
          null,

        awayAbbr,
        homeAbbr,

        awayScore,
        homeScore,

        clock:
          comp?.status?.displayClock ??
          null,

        period:
          comp?.status?.period ??
          null,

        detailedStatus,

        date:
          ev?.date ??
          null,

        status,
      });
    }

    /* ------------------------------------------------------------ */
    /* RESULTS */
    /* ------------------------------------------------------------ */

    const results: ResultArray =
      matchups.map((matchup) => {
        const key = makeKey(
          matchup.awayAbbr,
          matchup.homeAbbr
        );

        if (
          key &&
          eventWinnerMap.has(key)
        ) {
          return (
            eventWinnerMap.get(key) ??
            null
          );
        }

        return null;
      });

    /* ------------------------------------------------------------ */
    /* SORT GAMES BY DATE */
    /* ------------------------------------------------------------ */

    matchups.sort((a, b) => {
      const dateA = a.date
        ? new Date(a.date).getTime()
        : 0;

      const dateB = b.date
        ? new Date(b.date).getTime()
        : 0;

      return dateA - dateB;
    });

    /* ------------------------------------------------------------ */
    /* CACHE RESULT */
    /* ------------------------------------------------------------ */

    const data = {
      results,
      matchups,
      week,
      season,
    };

    cached = {
      ts: Date.now(),
      data,
    };

    /* ------------------------------------------------------------ */
    /* RESPONSE */
    /* ------------------------------------------------------------ */

    return NextResponse.json({
      source: "espn-dynamic",
      ...data,
      fetchedAt: cached.ts,
    });
  } catch (err: any) {
    console.error(
      "ESPN scoreboard error:",
      err
    );

    return NextResponse.json(
      {
        error:
          err?.message ??
          String(err),
      },
      {
        status: 500,
      }
    );
  }
}
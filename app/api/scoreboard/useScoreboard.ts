// app/api/scoreboard/useScoreboard.ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { Matchup } from "../../types";

type ScoreboardResponse = {
  source?: string;
  results?: (string | null)[];
  matchups?: Matchup[];
  fetchedAt?: number;
  error?: string;
};

type TeamMap = Record<string, string | null>;

function normalizeAbbr(input?: string | null): string | null {
  if (!input) return null;

  const up = String(input).toUpperCase();

  if (up === "WSH") return "WAS";
  if (up === "OAK") return "LV";
  if (up === "SD") return "LAC";

  return up;
}

export default function useScoreboard(
  pollIntervalMs = 1000 * 60 * 5,
  apiPath = "/api/scoreboard"
) {
  const [results, setResults] = useState<(string | null)[] | null>(null);
  const [matchups, setMatchups] = useState<Matchup[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchTeamsLogoMap(
    signal?: AbortSignal
  ): Promise<TeamMap> {
    try {
      const teamsResp = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams",
        {
          signal,
          cache: "no-store",
        }
      );

      if (!teamsResp.ok) return {};

      const teamsJson = await teamsResp.json();

      const arr = Array.isArray(teamsJson?.teams)
        ? teamsJson.teams
        : teamsJson?.sports?.[0]?.leagues?.[0]?.teams ?? [];

      const map: TeamMap = {};

      for (const t of arr) {
        const teamObj = t?.team ?? t;
        if (!teamObj) continue;

        const abbr = normalizeAbbr(
          teamObj.abbreviation ||
            teamObj.shortName ||
            teamObj.displayName ||
            null
        );

        let logo: string | null = null;

        if (
          Array.isArray(teamObj.logos) &&
          teamObj.logos.length > 0
        ) {
          logo = teamObj.logos[0]?.href ?? null;
        } else if (teamObj.logo) {
          logo = teamObj.logo;
        }

        if (abbr) {
          map[abbr] = logo;
        }
      }

      return map;
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.warn("teams fetch failed", err);
      }

      return {};
    }
  }

  async function fetchStandingsMap(
    signal?: AbortSignal
  ): Promise<TeamMap> {
    try {
      const standingsResp = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings",
        {
          signal,
          cache: "no-store",
        }
      );

      if (!standingsResp.ok) return {};

      const standingsJson = await standingsResp.json();

      const map: TeamMap = {};

      const entries = (standingsJson?.records ?? []).flatMap(
        (record: any) => record?.teamRecords ?? []
      );

      for (const record of entries) {
        const abbr = normalizeAbbr(
          record?.team?.abbreviation ||
            record?.team?.shortDisplayName ||
            null
        );

        const summary =
          record?.summary ??
          `${record?.wins}-${record?.losses}${
            record?.ties ? `-${record.ties}` : ""
          }`;

        if (abbr) {
          map[abbr] = summary;
        }
      }

      return map;
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.warn("standings fetch failed", err);
      }

      return {};
    }
  }

  async function fetchOnce(signal?: AbortSignal) {
    if (mounted.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(apiPath, {
        signal,
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}`
        );
      }

      const json =
        (await response.json()) as ScoreboardResponse;

      if (!mounted.current) return;

      if (json.error) {
        throw new Error(json.error);
      }

      /*
       * IMPORTANT:
       * Do not independently sort results and matchups here.
       *
       * The API returns:
       *   matchups[0] <-> results[0]
       *   matchups[1] <-> results[1]
       *   ...
       *
       * PickEmBoard.tsx handles putting those games into the fixed
       * Week 1 pick-sheet order.
       */
      const rawMatchups = Array.isArray(json.matchups)
        ? json.matchups
        : [];

      const rawResults = Array.isArray(json.results)
        ? json.results
        : [];

      const [logoMap, standingsMap] =
        await Promise.all([
          fetchTeamsLogoMap(signal),
          fetchStandingsMap(signal),
        ]);

      if (!mounted.current) return;

      const enhancedMatchups: Matchup[] =
        rawMatchups.map((matchup) => {
          const awayAbbr = normalizeAbbr(
            matchup.awayAbbr
          );

          const homeAbbr = normalizeAbbr(
            matchup.homeAbbr
          );

          return {
            ...matchup,
            awayAbbr,
            homeAbbr,

            awayLogo: awayAbbr
              ? logoMap[awayAbbr] ?? null
              : null,

            homeLogo: homeAbbr
              ? logoMap[homeAbbr] ?? null
              : null,

            awayStanding: awayAbbr
              ? standingsMap[awayAbbr] ?? null
              : null,

            homeStanding: homeAbbr
              ? standingsMap[homeAbbr] ?? null
              : null,

            date: matchup.date ?? null,
          };
        });

      /*
       * Normalize winner abbreviations, but DO NOT change their
       * position. Each result remains paired with the matchup at
       * the same index.
       */
      const normalizedResults =
        rawMatchups.map((_, index) =>
          normalizeAbbr(rawResults[index] ?? null)
        );

      setMatchups(enhancedMatchups);
      setResults(normalizedResults);
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      console.error(
        "useScoreboard fetch error:",
        err
      );

      if (mounted.current) {
        setError(
          err?.message ?? String(err)
        );
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mounted.current = true;

    const controller = new AbortController();

    // Initial fetch
    fetchOnce(controller.signal);

    // Refresh scoreboard
    intervalRef.current = setInterval(() => {
      fetchOnce();
    }, pollIntervalMs);

    return () => {
      mounted.current = false;
      controller.abort();

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [apiPath, pollIntervalMs]);

  return {
    results,
    matchups,
    loading,
    error,
  };
}

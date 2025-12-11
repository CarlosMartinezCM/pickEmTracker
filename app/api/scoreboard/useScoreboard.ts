// app/api/scoreboard/useScoreboard.ts
"use client";

import { useEffect, useRef, useState } from "react";

type Matchup = {
  eventId: string | null;
  awayTeam: string | null;
  homeTeam: string | null;
  awayAbbr: string | null;
  homeAbbr: string | null;
  awayScore: number | null;
  homeScore: number | null;
  awayLogo?: string | null;
  homeLogo?: string | null;
  awayStanding?: string | null;
  homeStanding?: string | null;
  clock: string | null;
  period: number | null;
  detailedStatus: string | null;
  date: string | null;
  status: string | null;
  winner?: string; // <--- add this
};

type ScoreboardResponse = {
  source?: string;
  results?: (string | null)[];
  matchups?: Matchup[];
  fetchedAt?: number;
  error?: string;
};

export default function useScoreboard(pollIntervalMs = 1000 * 60 * 5, apiPath = "/api/scoreboard") {
  const [results, setResults] = useState<(string | null)[] | null>(null);
  const [matchups, setMatchups] = useState<Matchup[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const intervalRef = useRef<number | null>(null);

  // Fetch logos mapping
  async function fetchTeamsLogoMap() {
    try {
      const teamsResp = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
      if (!teamsResp.ok) return {};
      const teamsJson = await teamsResp.json();
      const arr = Array.isArray(teamsJson?.teams)
        ? teamsJson.teams
        : teamsJson?.sports?.[0]?.leagues?.[0]?.teams ?? [];
      const map: Record<string, string | null> = {};
      for (const t of arr) {
        const teamObj = t?.team ?? t;
        if (!teamObj) continue;
        const abbr = (teamObj.abbreviation || teamObj.shortName || teamObj.displayName || "").toUpperCase();
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

  // Fetch standings mapping
  async function fetchStandingsMap() {
    try {
      const sResp = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings");
      if (!sResp.ok) return {};
      const sJson = await sResp.json();
      const map: Record<string, string | null> = {};
      const entries = (sJson?.records ?? []).flatMap((r: any) => r?.teamRecords ?? []);
      for (const rec of entries) {
        const abbr = (rec?.team?.abbreviation || rec?.team?.shortDisplayName || "").toUpperCase();
        const summary = rec?.summary ?? `${rec?.wins}-${rec?.losses}${rec?.ties ? `-${rec.ties}` : ""}`;
        if (abbr) map[abbr] = summary;
      }
      return map;
    } catch (e) {
      console.warn("standings fetch failed", e);
      return {};
    }
  }

  async function fetchOnce(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = (await res.json()) as ScoreboardResponse;

      if (!mounted.current) return;

      const logoMap = await fetchTeamsLogoMap();
      const standingsMap = await fetchStandingsMap();

      const enhancedMatchups = json.matchups?.map((m) => ({
        ...m,
        awayLogo: m.awayAbbr ? logoMap[m.awayAbbr] ?? null : null,
        homeLogo: m.homeAbbr ? logoMap[m.homeAbbr] ?? null : null,
        awayStanding: m.awayAbbr ? standingsMap[m.awayAbbr] ?? null : null,
        homeStanding: m.homeAbbr ? standingsMap[m.homeAbbr] ?? null : null,
        // Fix for Denver game showing TBD
        date:
          m?.date ??
          (m?.status === "SCHEDULED" && m?.detailedStatus?.includes("Sun") ? new Date(m.detailedStatus).toISOString() : null),
      }));

      setResults(json.results ?? null);
      setMatchups(enhancedMatchups ?? null);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("useScoreboard fetch error:", err);
      if (mounted.current) setError(String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    // initial fetch
    fetchOnce(controller.signal);

    // set up polling interval
    intervalRef.current = window.setInterval(() => {
      fetchOnce();
    }, pollIntervalMs);

    return () => {
      mounted.current = false;
      controller.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, pollIntervalMs]);

  return { results, matchups, loading, error };
}

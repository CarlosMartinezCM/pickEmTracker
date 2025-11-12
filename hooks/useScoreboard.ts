// hooks/useScoreboard.ts
import { useEffect, useState } from "react";

const STORAGE_KEY = "confirmedResults_v1";

type Matchup = {
  eventId: string | null;
  awayTeam: string | null;
  homeTeam: string | null;
  awayAbbr: string | null;
  homeAbbr: string | null;
  date: string | null;
  status: string | null;
};

export default function useScoreboard(pollMs = 1000 * 60 * 5) {
  const [results, setResults] = useState<(string | null)[] | null>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return null;
  });

  const [matchups, setMatchups] = useState<Matchup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistResults = (arr: (string | null)[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      // ignore
    }
  };

  const fetchScores = async () => {
    try {
      setError(null);
      const r = await fetch("/api/scoreboard");
      if (!r.ok) {
        const text = await r.text().catch(() => "<no body>");
        throw new Error(`Status ${r.status}: ${text}`);
      }
      const j = await r.json();
      if (Array.isArray(j?.results)) {
        setResults(j.results);
        persistResults(j.results);
      }
      if (Array.isArray(j?.matchups)) {
        setMatchups(j.matchups);
      }
      setLoading(false);
    } catch (err: any) {
      console.error("score fetch error", err);
      setError(String(err));
      setLoading(false);

      // on error, keep last persisted results
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setResults(parsed);
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return { results, matchups, loading, error };
}

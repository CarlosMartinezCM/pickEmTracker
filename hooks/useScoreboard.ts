// hooks/useScoreboard.ts
import { useEffect, useState } from "react";

export default function useScoreboard(pollMs = 1000 * 60 * 5) {
  const [results, setResults] = useState<(string | null)[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = async () => {
    try {
      setError(null);
      const r = await fetch("/api/scoreboard");
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const j = await r.json();
      if (Array.isArray(j?.results)) setResults(j.results);
      setLoading(false);
    } catch (err: any) {
      console.error("score fetch error", err);
      setError(String(err));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return { results, loading, error };
}


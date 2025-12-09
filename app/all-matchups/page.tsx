// app/(whatever)/all-matchups/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import useScoreboard from "../api/scoreboard/useScoreboard"; // <-- adjust path if needed
import { Matchup } from "../types"; // <-- adjust path if needed

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">{children}</div>
);

export function formatGameStatus(m: Matchup | null) {
  if (!m) return "";

  const detailed = (m.detailedStatus ?? "").toLowerCase();
  const status = (m.status ?? "").toLowerCase();
  const clock = (m.clock ?? "").trim();

  const isFinal = detailed.includes("final") || status.includes("final");
  const isHalftime = detailed.includes("halftime") || status.includes("halftime");

  if (m?.period === 0) return "PRE-GAME";
  if (isFinal) return "FINAL";
  if (isHalftime) return "HALFTIME";
  if (m.period === 4 && (clock === "0:00" || clock === "")) return "FINAL";
  if (m.period != null && m.clock != null) return `Q${m.period} ${m.clock}`;
  return m.status ?? "SCHEDULED";
}

/** Helper to format kickoff date/time to Pacific Time for PRE-GAME display */
function kickoffToPT(dateString: string | null | undefined) {
  if (!dateString) return "TBD";
  try {
    const d = new Date(dateString);
    // show short day + month + day + time in PT
    return d.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  } catch {
    return "TBD";
  }
}

export default function AllMatchupsPage() {
  const { matchups, loading } = useScoreboard(1000 * 60 * 5);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || loading) {
    return <div className="p-8 text-center text-gray-700 dark:text-gray-300">Loading matchups...</div>;
  }

  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="text-white font-bold text-center text-lg px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          🏈 Back to Pick'ems
        </Link>
      </div>

      <Card>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-700 dark:text-gray-300">
          📅 Week Matchups
        </h2>

        {matchups?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {matchups.map((mRaw, i) => {
              const m = mRaw as Matchup;

              const awayScorePresent = typeof (m as any)?.awayScore === "number";
              const homeScorePresent = typeof (m as any)?.homeScore === "number";
              const numericScore = awayScorePresent || homeScorePresent
                ? `${awayScorePresent ? (m as any).awayScore : "-"} - ${homeScorePresent ? (m as any).homeScore : "-"}`
                : null;

              const statusLabel = formatGameStatus(m);
              // PRE-GAME shows kickoff in PT; FINAL shows numericScore (if available)
              const topLine =
                statusLabel === "PRE-GAME"
                  ? kickoffToPT(m?.date ?? null)
                  : statusLabel === "FINAL"
                  ? `FINAL ${numericScore ?? ""}`
                  : statusLabel; // e.g. "Q3 7:12" or "HALFTIME"

              return (
                <div key={m.eventId ?? `m-${i}`} className="flex flex-col p-4 rounded-md border bg-white/60 dark:bg-gray-800/60">
                  {/* Teams + logos */}
                  <div className="flex flex-col w-full mb-2">
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                      <div className="flex items-center gap-1 min-w-[50px] justify-end">
                        {m.awayLogo && <img src={(m as any).awayLogo} alt={m.awayAbbr ?? "Away Team"} className="w-5 h-5 object-contain" />}
                        <span className="truncate">{m.awayAbbr ?? m.awayTeam ?? "—"}</span>
                      </div>
                      <span className="text-xs flex-shrink-0">@</span>
                      <div className="flex items-center gap-1 min-w-[50px] justify-start">
                        {m.homeLogo && <img src={(m as any).homeLogo} alt={m.homeAbbr ?? "Home Team"} className="w-5 h-5 object-contain" />}
                        <span className="truncate">{m.homeAbbr ?? m.homeTeam ?? "—"}</span>
                      </div>
                    </div>

                    {/* status / time line */}
                    <div className="text-center text-xs text-gray-600 dark:text-gray-300 mt-2">
                      {topLine}
                    </div>

                    {/* numeric score when available (big) */}
                    <div className="text-center text-lg font-bold text-green-900 dark:text-green-400 mt-3">
                      {statusLabel === "FINAL" && numericScore ? numericScore : (statusLabel !== "PRE-GAME" && numericScore) ? numericScore : "—"}
                    </div>

                    {/* small live info: clock / quarter / possession */}
                    {statusLabel && statusLabel !== "PRE-GAME" && statusLabel !== "FINAL" && (
                      <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2 mt-2 justify-center">
                        {m.clock && <span className="font-mono">{m.clock}</span>}
                        {m.period != null && <span className="px-1 rounded bg-white/20 text-[11px]">Q{m.period}</span>}
                        {(m as any).possession && <span className="text-[11px] italic">Poss: {(m as any).possession}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500">No matchups available</div>
        )}
      </Card>
    </div>
  );
}

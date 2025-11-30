"use client";
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
    {children}
  </div>
);

import React, { useEffect, useState } from "react";
import Link from "next/link";
import useScoreboard from "../api/scoreboard/useScoreboard"; // adjust path
import { Matchup } from "../types";

export default function AllMatchupsPage() {
  // fetch scoreboard data
  const { matchups, loading } = useScoreboard(1000 * 60 * 5);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true); // ensures client-only rendering
  }, []);

  if (!mounted || loading) {
    return <div className="p-8 text-center text-gray-700 dark:text-gray-300">Loading matchups...</div>;
  }

  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen">
      {/* Navbar */}
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="text-white font-bold text-center text-lg px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
        >
          🏈 Back to Pick'ems
        </Link>
      </div>
    <Card>
      {/* Page Title */}
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-700 dark:text-gray-300">
        📅 Week 13 Sunday/Monday Matchups
      </h2>

      {/* Matchups Grid */}
      {matchups?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {matchups.map((mRaw, i) => {
            const m = mRaw as Matchup;

            const awayScorePresent = typeof m?.awayScore === "number";
            const homeScorePresent = typeof m?.homeScore === "number";
            const hasScores = awayScorePresent || homeScorePresent;
            const numericScore = hasScores
              ? `${awayScorePresent ? m.awayScore : "-"} - ${homeScorePresent ? m.homeScore : "-"}`
              : "—";

            return (
              <div
                key={m.eventId ?? `m-${i}`}
                className="flex flex-col p-4 rounded-md border bg-white/60 dark:bg-gray-800/60"
              >
                {/* Teams with logos and standings */}
                <div className="flex flex-col w-full mb-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                    {/* Away Team */}
                    <div className="flex items-center gap-1 min-w-[50px] justify-end">
                      {m.awayLogo && <img src={m.awayLogo} alt={m.awayAbbr ?? "Away Team"} className="w-5 h-5 object-contain" />}
                      <span className="truncate">{m.awayAbbr ?? m.awayTeam ?? "—"}</span>
                    </div>

                    {/* @ symbol */}
                    <span className="text-xs flex-shrink-0">@</span>

                    {/* Home Team */}
                    <div className="flex items-center gap-1 min-w-[50px] justify-start">
                      {m.homeLogo && <img src={m.homeLogo} alt={m.homeAbbr ?? "Home Team"} className="w-5 h-5 object-contain" />}
                      <span className="truncate">{m.homeAbbr ?? m.homeTeam ?? "—"}</span>
                    </div>
                  </div>

                  {/* Standings */}
                  <div className="flex items-center justify-center gap-1 text-[10px] text-yellow-200 dark:text-yellow-300 mt-1">
                    <span className="truncate">{m.awayStanding ?? "—"}</span>
                    <span>-</span>
                    <span className="truncate">{m.homeStanding ?? "—"}</span>
                  </div>

                  {/* Date & Status */}
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    {m.date ? new Date(m.date).toLocaleString() : "TBD"} • {m.status ?? "SCHEDULED"}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center text-lg font-bold text-green-900 dark:text-green-400">
                  {numericScore}
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

"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import useScoreboard from "../api/scoreboard/useScoreboard"; // adjust path
import { Matchup } from "../types";

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">{children}</div>
);

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
          📅 Week 13 Sunday/Monday Matchups
        </h2>

        {matchups?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {matchups.map((mRaw, i) => {
              const m = mRaw as Matchup;

              const awayScorePresent = typeof m?.awayScore === "number";
              const homeScorePresent = typeof m?.homeScore === "number";
              const numericScore = awayScorePresent || homeScorePresent
                ? `${awayScorePresent ? m.awayScore : "-"} - ${homeScorePresent ? m.homeScore : "-"}`
                : "—";

              const clockText = m?.clock ?? null;
              const quarterText = m?.period != null ? `Q${m.period}` : null;
              const possessionText = m?.possession ?? null;
              const downDistanceText = m?.down != null && m?.yardsToGo != null ? `${m.down} & ${m.yardsToGo}` : null;
              const ballOnText = m?.ballOn ?? null;
              const lastPlayText = m?.lastPlayText ?? null;

              return (
                <div key={m.eventId ?? `m-${i}`} className="flex flex-col p-4 rounded-md border bg-white/60 dark:bg-gray-800/60">
                  {/* Teams + logos */}
                  <div className="flex flex-col w-full mb-2">
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                      <div className="flex items-center gap-1 min-w-[50px] justify-end">
                        {m.awayLogo && <img src={m.awayLogo} alt={m.awayAbbr ?? "Away Team"} className="w-5 h-5 object-contain" />}
                        <span className="truncate">{m.awayAbbr ?? m.awayTeam ?? "—"}</span>
                      </div>
                      <span className="text-xs flex-shrink-0">@</span>
                      <div className="flex items-center gap-1 min-w-[50px] justify-start">
                        {m.homeLogo && <img src={m.homeLogo} alt={m.homeAbbr ?? "Home Team"} className="w-5 h-5 object-contain" />}
                        <span className="truncate">{m.homeAbbr ?? m.homeTeam ?? "—"}</span>
                      </div>
                    </div>

                    {/* Live clock / quarter / possession */}
                    {(clockText || quarterText || possessionText) && (
                      <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2 mt-1 justify-center">
                        {clockText && <span className="font-mono">{clockText}</span>}
                        {quarterText && <span className="px-1 rounded bg-white/20 text-[11px]">{quarterText}</span>}
                        {possessionText && <span className="text-[11px] italic">Poss: {possessionText}</span>}
                      </div>
                    )}

                    {/* Down & distance + ball on */}
                    {(downDistanceText || ballOnText) && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2 mt-1 justify-center">
                        {downDistanceText && <span>{downDistanceText}</span>}
                        {!downDistanceText && m?.yardsToGo != null && <span>{m.yardsToGo} to go</span>}
                        {ballOnText && <span>• {ballOnText}</span>}
                      </div>
                    )}

                    {/* Last play */}
                    {lastPlayText && (
                      <div className="text-[10px] italic text-gray-500 truncate w-full mt-1 text-center">
                        {lastPlayText}
                      </div>
                    )}
                  </div>

                  {/* Score / status */}
                  <div className="text-center text-lg font-bold text-green-900 dark:text-green-400 mt-2">
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

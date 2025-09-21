"use client";

import React, { useState, useMemo, useEffect } from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => (
  <div
    className={`bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl p-6 shadow-lg transition-colors duration-300 ${className || ""}`}
  >
    {children}
  </div>
);

type Player = { name: string; picks: string[]; tiebreaker: number };
type Result = { [gameIndex: number]: string };

// Week 3 results (BUF already confirmed)
const confirmedResults: (string | null)[] = [
  "BUF", // TNF
  null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null
];

// Week 3 Picks (truncated for brevity, keep your full list)
const initialPlayers: Player[] = [
  { name: "Carlos(comish)", picks: ["BUF","ATL","CLE","HOU","CIN","NE","PHI","TB","IND","WAS","LAC","SEA","CHI","ARI","NYG","BAL"], tiebreaker: 54 },
  { name: "Erick Escobar", picks: ["BUF","ATL","GB","JAX","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","CHI","SF","KC","BAL"], tiebreaker: 42 },
  { name: "J El De la R", picks: ["BUF","ATL","CLE","HOU","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","DET"], tiebreaker: 50 },
  { name: "RIOS", picks: ["BUF","ATL","GB","HOU","CIN","PIT","PHI","TB","IND","LV","LAC","SEA","DAL","ARI","KC","BAL"], tiebreaker: 60 },
  { name: "Edgar B", picks: ["BUF","ATL","GB","JAX","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","CHI","SF","KC","BAL"], tiebreaker: 51 },
  { name: "YOLO", picks: ["BUF","CAR","GB","HOU","CIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","DET"], tiebreaker: 44 },
  { name: "Maverick", picks: ["BUF","CAR","GB","HOU","CIN","PIT","LAR","TB","IND","LV","LAC","SEA","CHI","SF","KC","BAL"], tiebreaker: 56 },
  { name: "Sumo", picks: ["BUF","ATL","GB","HOU","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 62 },
  { name: "Chico", picks: ["BUF","CAR","GB","HOU","MIN","PIT","LAR","NYJ","IND","WAS","LAC","SEA","DAL","ARI","KC","BAL"], tiebreaker: 48 },
  { name: "Bobby", picks: ["BUF","ATL","GB","JAX","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 47 },
  { name: "Fay", picks: ["BUF","ATL","GB","HOU","MIN","PIT","LAR","TB","TEN","LV","LAC","SEA","DAL","ARI","KC","DET"], tiebreaker: 48 },
  { name: "Eric Rodriguez", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","NYG","BAL"], tiebreaker: 65 },
  { name: "NikGo", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 41 },
  { name: "Ant", picks: ["BUF","ATL","GB","HOU","CIN","PIT","PHI","TB","IND","LV","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 49 },
  { name: "Beto", picks: ["BUF","ATL","GB","JAX","CIN","PIT","PHI","NYJ","TEN","WAS","LAC","SEA","DAL","SF","NYG","DET"], tiebreaker: 60 },
  { name: "Javier A", picks: ["BUF","CAR","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","NYG","BAL"], tiebreaker: 55 },
  { name: "Dennis", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 50 },
  { name: "Oso", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","CHI","ARI","KC","BAL"], tiebreaker: 53 },
  { name: "Ernest", picks: ["BUF","ATL","GB","JAX","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 47 },
  { name: "Danny", picks: ["BUF","ATL","GB","HOU","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 59 },
  { name: "Castro", picks: ["BUF","ATL","GB","JAX","MIN","PIT","PHI","TB","IND","LV","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 55 },
  { name: "Candon", picks: ["BUF","ATL","GB","HOU","CIN","PIT","LAR","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 44 }
];
// --- helper: calculate correct/wrong ---
const calculateRecord = (picks: string[], results: Result) => {
  let correct = 0, wrong = 0;
  picks.forEach((pick, idx) => {
    if (results[idx]) pick === results[idx] ? correct++ : wrong++;
  });
  return { correct, wrong };
};

export default function PickemTracker() {
  const [results, setResults] = useState<Result>(
    confirmedResults.reduce((acc, val, idx) => {
      if (val) acc[idx] = val;
      return acc;
    }, {} as Result)
  );

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load saved theme on first render
  useEffect(() => {
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  // Toggle theme
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
    }
  };

  const leaderboard = useMemo(() => {
    const players = initialPlayers.map(p => ({
      ...p,
      ...calculateRecord(p.picks, results),
    }));
    players.sort((a, b) => b.correct - a.correct || a.tiebreaker - b.tiebreaker);

    let rank = 1, lastCorrect: number | null = null;
    return players.map((p, idx) => {
      if (lastCorrect !== null && p.correct < lastCorrect) rank = idx + 1;
      lastCorrect = p.correct;
      return { ...p, rank };
    });
  }, [results]);

  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen space-y-8 transition-colors duration-300">
      {/* Picks Tracker */}
      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">
          🏈 NFL Pick'em Tracker 2025 🏈
        </h1>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
            <thead className="bg-gradient-to-r from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-700 sticky top-0">
              <tr>
                <th className="border p-3 text-left">Player</th>
                {Array.from({ length: 16 }).map((_, idx) => (
                  <th key={idx} className="border p-3 text-center">G{idx + 1}</th>
                ))}
                <th className="border p-3 text-center">✅ Correct</th>
                <th className="border p-3 text-center">❌ Wrong</th>
                <th className="border p-3 text-center">🎯 TieBreaker</th>
              </tr>
            </thead>
            <tbody>
              {initialPlayers.map((player, i) => {
                const record = calculateRecord(player.picks, results);
                return (
                  <tr
                    key={i}
                    className={i % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"}
                  >
                    <td className="border p-3 font-semibold">{player.name}</td>
                    {player.picks.map((pick, idx) => (
                      <td
                        key={idx}
                        className={`border p-2 text-center font-medium ${
                          results[idx]
                            ? results[idx] === pick
                              ? "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100"
                              : "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100"
                            : "bg-gray-100 dark:bg-gray-600"
                        }`}
                      >
                        {pick}
                      </td>
                    ))}
                    <td className="border p-3 text-center font-bold text-green-700 dark:text-green-300">
                      {record.correct}
                    </td>
                    <td className="border p-3 text-center font-bold text-red-700 dark:text-red-300">
                      {record.wrong}
                    </td>
                    <td className="border p-3 text-center font-bold">{player.tiebreaker}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Leaderboard */}
      <Card>
        <h2 className="text-3xl font-bold mb-4 text-yellow-700 dark:text-yellow-300">
          🏆 Leaderboard
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
            <thead className="bg-gradient-to-r from-yellow-200 to-yellow-100 dark:from-yellow-900 dark:to-yellow-700">
              <tr>
                <th className="border p-3 text-center">Rank</th>
                <th className="border p-3 text-left">Player</th>
                <th className="border p-3 text-center">✅ Correct</th>
                <th className="border p-3 text-center">❌ Wrong</th>
                <th className="border p-3 text-center">🎯 TieBreaker</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, idx) => (
                <tr
                  key={player.name}
                  className={idx % 2 === 0
                    ? "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-600"
                    : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"}
                >
                  <td className="border p-3 text-center">{player.rank}</td>
                  <td className="border p-3 font-semibold">{player.name}</td>
                  <td className="border p-3 text-center font-bold text-green-700 dark:text-green-300">{player.correct}</td>
                  <td className="border p-3 text-center font-bold text-red-700 dark:text-red-300">{player.wrong}</td>
                  <td className="border p-3 text-center font-bold">{player.tiebreaker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useMemo, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";


const exportPDF = async () => {
  const element = document.getElementById("leaderboard");
  if (!element) return;

  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("l", "mm", "a4");
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

  // Instead of saving locally, get PDF as blob
  const pdfBlob = pdf.output("blob");

  // Send to backend
  const formData = new FormData();
  formData.append("file", pdfBlob, "pickem_results.pdf");

  await fetch("http://localhost:8081/upload", {
    method: "POST",
    body: formData,
  });

  alert("✅ PDF exported & uploaded to server");
};


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
type LeaderboardPlayer = Player & { correct: number; wrong: number; rank: number };

// Week 4 results
const confirmedResults: (string | null)[] = [
];

// Week 4 Picks (truncated for brevity, keep your full list)
const initialPlayers: Player[] = [
  { name: "Carlos(comish)", picks: ["SEA","PIT","WAS","BUF","DET","HOU","NE","LAC","PHI","LAR","JAX","BAL","LV","GB","MIA","DEN"], tiebreaker: 40 },
  { name: "J El de la R", picks: ["SEA","PIT","WAS","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","BAL","CHI","DAL","MIA","DEN"], tiebreaker: 48 },
  { name: "Candon", picks: ["SEA","PIT","WAS","BUF","DET","HOU","NE","LAC","TB","LAR","SF","BAL","LV","GB","MIA","DEN"], tiebreaker: 49 },
  { name: "Fay", picks: ["SEA","MIN","ATL","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","KC","LV","DAL","NYJ","DEN"], tiebreaker: 48 },
  { name: "Sumo", picks: ["SEA","MIN","WAS","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","BAL","LV","GB","NYJ","DEN"], tiebreaker: 38 },
  { name: "Edgar B", picks: ["SEA","MIN","ATL","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","KC","LV","GB","MIA","CIN"], tiebreaker: 45 },
  { name: "Chico", picks: ["SEA","PIT","WAS","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","BAL","CHI","DAL","NYJ","DEN"], tiebreaker: 50 },
  { name: "Beto", picks: ["SEA","PIT","WAS","BUF","DET","HOU","CAR","LAC","TB","LAR","SF","BAL","CHI","DAL","MIA","DEN"], tiebreaker: 34 },
  { name: "Nik", picks: ["SEA","PIT","WAS","BUF","DET","TEN","CAR","LAC","TB","LAR","SF","BAL","CHI","GB","MIA","DEN"], tiebreaker: 43 },
  { name: "Eric Rodriguez", picks: ["SEA","MIN","WAS","BUF","DET","HOU","NE","LAC","PHI","IND","JAX","BAL","CHI","GB","MIA","DEN"], tiebreaker: 42 },
  { name: "Erick Escobar", picks: ["SEA","PIT","ATL","BUF","DET","HOU","NE","LAC","TB","IND","SF","KC","LV","GB","MIA","DEN"], tiebreaker: 42 },
  { name: "Bobby", picks: ["SEA","PIT","ATL","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","KC","CHI","GB","NYJ","DEN"], tiebreaker: 43 },
  { name: "RIOS", picks: ["SEA","PIT","WAS","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","BAL","LV","GB","NYJ","DEN"], tiebreaker: 52 },
  { name: "Yolo", picks: ["ARI","MIN","WAS","BUF","DET","HOU","CAR","LAC","TB","LAR","SF","KC","LV","GB","MIA","CIN"], tiebreaker: 44 },
  { name: "Oso", picks: ["SEA","MIN","WAS","BUF","DET","HOU","NE","LAC","PHI","IND","JAX","BAL","CHI","GB","NYJ","CIN"], tiebreaker: 53 },
  { name: "Teno", picks: ["SEA","PIT","WAS","BUF","DET","HOU","CAR","LAC","PHI","LAR","SF","BAL","LV","GB","NYJ","CIN"], tiebreaker: 37 },
  { name: "Dennis", picks: ["ARI","PIT","WAS","BUF","DET","HOU","NE","LAC","PHI","LAR","SF","BAL","LV","GB","MIA","DEN"], tiebreaker: 48 },
  { name: "Gzuz", picks: ["ARI","MIN","WAS","BUF","DET","TEN","NE","NYG","PHI","LAR","SF","KC","CHI","GB","MIA","CIN"], tiebreaker: 38 },
  { name: "Danny", picks: ["SEA","PIT","WAS","BUF","DET","HOU","NE","LAC","TB","LAR","SF","BAL","CHI","GB","NYJ","DEN"], tiebreaker: 45 },
  { name: "Los", picks: ["SEA","MIN","WAS","BUF","DET","TEN","CAR","LAC","PHI","IND","SF","BAL","LV","GB","MIA","CIN"], tiebreaker: 45 },
];

// Helper: calculate correct/wrong
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

  // Load saved theme
  useEffect(() => {
    if (
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
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

  // Leaderboard
  const leaderboard: LeaderboardPlayer[] = useMemo(() => {
    const playersWithRecord = initialPlayers.map(p => ({
      ...p,
      ...calculateRecord(p.picks, results),
    }));

    // Sort by correct (desc), then tiebreaker (asc)
    playersWithRecord.sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.tiebreaker - b.tiebreaker;
    });

    // Assign ranks
    let rank = 1;
    let lastCorrect: number | null = null;
    let lastTiebreaker: number | null = null;

    return playersWithRecord.map((p, idx) => {
      if (
        lastCorrect !== null &&
        (p.correct !== lastCorrect || p.tiebreaker !== lastTiebreaker)
      ) {
        rank = idx + 1;
      }
      lastCorrect = p.correct;
      lastTiebreaker = p.tiebreaker;
      return { ...p, rank };
    });
  }, [results]);


  // Winner(s): players with rank 1
  const winners = useMemo(() => leaderboard.filter(p => p.rank === 1), [leaderboard]);

  // Top contenders: rank ≤ 3
  const realisticWinners = useMemo(() => leaderboard.filter(p => p.rank <= 3), [leaderboard]);


  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen space-y-8 transition-colors duration-300">      {/* Picks Tracker */}
      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">
          🏈 NFL Pick'em Tracker 2025 - WEEK 4 🏈
        </h1>
        {/* Winner */}
        {/*winners.length > 0 && (
          <div className="mt-4 text-xl font-bold text-yellow-700 dark:text-yellow-300">
            🏆 Winner: {winners.map(p => p.name).join(", ")}
          </div>
        )*/}

        {/* Top contenders */}
        {/*realisticWinners.length > 0 && (
          <div className="mt-2 text-lg font-semibold text-green-700 dark:text-green-300">
            Top contenders: {realisticWinners.map(p => p.name).join(", ")}
          </div>
        )*/}

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
              {leaderboard.map((player, i) => {
                const record = calculateRecord(player.picks, results);
                const isTop4 = player.rank <= 4;
                return (
                  <tr
                    key={player.name}
                    className={`${i % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50 dark:bg-gray-700"
                      } hover:bg-gray-100 dark:hover:bg-gray-600
                      ${isTop4 ? "ring-2 ring-yellow-400 dark:ring-yellow-500" : ""}`}
                  >
                    <td className="border p-3 font-semibold">{player.name}</td>
                    {player.picks.map((pick, idx) => (
                      <td
                        key={idx}
                        className={`border p-2 text-center font-medium ${results[idx]
                          ? results[idx] === pick
                            ? "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100"
                            : "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100"
                          : "bg-gray-100 dark:bg-gray-600"
                          }`}
                      >
                        {pick}
                      </td>
                    ))}
                    <td className="border p-3 text-center font-bold text-green-700 dark:text-green-300">{record.correct}</td>
                    <td className="border p-3 text-center font-bold text-red-700 dark:text-red-300">{record.wrong}</td>
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
              {/*leaderboard.map(player => {
                const isTop4 = player.rank <= 4;
                return (
                  <tr
                    key={player.name}
                    className={`${player.rank % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50 dark:bg-gray-700"
                      } hover:bg-gray-100 dark:hover:bg-gray-600
                      ${isTop4 ? "ring-2 ring-yellow-400 dark:ring-yellow-500" : ""}`}
                  >
                    <td className="border p-3 text-center">{player.rank}</td>
                    <td className="border p-3 font-semibold">{player.name}</td>
                    <td className="border p-3 text-center font-bold text-green-700 dark:text-green-300">{player.correct}</td>
                    <td className="border p-3 text-center font-bold text-red-700 dark:text-red-300">{player.wrong}</td>
                    <td className="border p-3 text-center font-bold">{player.tiebreaker}</td>
                  </tr>
                );
              })*/}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

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

// Week 9 results
const confirmedResults: (string | null)[] = [/* WeekResults */  "DEN", "IND", "CHI", "MIA", "BAL", "NYJ", "NE", "NO", "JAX","SEA","LAR","DET", "LAC"   /*Results*/];

//Week 10 players                                                 
const initialPlayers: Player[] = [
  { name: "Carlos Comish", picks: ["DEN","IND","CHI","BUF","BAL","CLE","NE","CAR","JAX","SEA","LAR","DET","LAC","PHI"], tiebreaker: 58 },
  { name: "Fay", picks: ["LV","ATL","CHI","BUF","MIN","NYJ","TB","NO","HOU","SEA","SF","DET","PIT","PHI"], tiebreaker: 48 },
  { name: "Sumo", picks: ["DEN","IND","CHI","BUF","BAL","CLE","TB","CAR","JAX","SEA","LAR","DET","PIT","PHI"], tiebreaker: 49 },
  { name: "Javier", picks: ["DEN","IND","CHI","BUF","BAL","NYJ","TB","CAR","HOU","SEA","LAR","DET","LAC","PHI"], tiebreaker: 45 },
  { name: "Rios", picks: ["DEN","IND","CHI","BUF","BAL","CLE","TB","NO","JAX","SEA","LAR","DET","LAC","PHI"], tiebreaker: 52 },
  { name: "Edgar B", picks: ["DEN","IND","NYG","BUF","MIN","NYJ","TB","CAR","HOU","SEA","LAR","DET","LAC","PHI"], tiebreaker: 45 },
  { name: "J El De La R", picks: ["DEN","IND","NYG","BUF","MIN","CLE","NE","CAR","HOU","SEA","SF","DET","LAC","GB"], tiebreaker: 50 },
  { name: "Poki", picks: ["LV","IND","CHI","MIA","MIN","CLE","TB","NO","HOU","ARI","LAR","WAS","LAC","GB"], tiebreaker: 49 },
  { name: "Chico", picks: ["DEN","ATL","CHI","BUF","BAL","NYJ","NE","CAR","JAX","SEA","SF","DET","PIT","PHI"], tiebreaker: 48 },
  { name: "Beto", picks: ["DEN","IND","CHI","BUF","BAL","NYJ","NE","CAR","JAX","SEA","SF","DET","LAC","GB"], tiebreaker: 53 },
  { name: "Sebastian", picks: ["DEN","IND","NYG","BUF","BAL","CLE","TB","CAR","HOU","SEA","LAR","DET","LAC","GB"], tiebreaker: 50 },
  { name: "Adrian", picks: ["DEN","IND","NYG","BUF","BAL","CLE","NE","CAR","JAX","SEA","LAR","DET","PIT","PHI"], tiebreaker: 50 },
  { name: "Oso", picks: ["DEN","IND","CHI","BUF","MIN","NYJ","TB","CAR","JAX","SEA","LAR","DET","PIT","GB"], tiebreaker: 53 },
  { name: "Maveric", picks: ["DEN","IND","CHI","BUF","BAL","NYJ","TB","CAR","HOU","SEA","LAR","DET","PIT","PHI"], tiebreaker: 47 },
  { name: "Dennis", picks: ["DEN","IND","CHI","BUF","BAL","CLE","TB","CAR","HOU","SEA","LAR","DET","LAC","PHI"], tiebreaker: 56 },
  { name: "Erick Escobar", picks: ["DEN","IND","CHI","BUF","BAL","CLE","TB","CAR","HOU","SEA","SF","DET","PIT","GB"], tiebreaker: 42 },
  { name: "Candon", picks: ["DEN","IND","CHI","BUF","MIN","CLE","TB","CAR","JAX","SEA","LAR","DET","LAC","GB"], tiebreaker: 48 },
  { name: "Danny", picks: ["DEN","IND","CHI","BUF","BAL","CLE","TB","CAR","JAX","SEA","LAR","DET","PIT","PHI"], tiebreaker: 52 },
  { name: "Eric Rodriguez", picks: ["DEN","IND","CHI","BUF","BAL","CLE","TB","CAR","HOU","SEA","LAR","DET","LAC","PHI"], tiebreaker: 56 },
  { name: "Bobby", picks: ["DEN","ATL","CHI","BUF","BAL","CLE","TB","CAR","HOU","SEA","LAR","DET","LAC","PHI"], tiebreaker: 45 },
  { name: "Tito", picks: ["DEN","IND","CHI","BUF","BAL","NYJ","TB","CAR","JAX","SEA","SF","DET","LAC","PHI"], tiebreaker: 54 },
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

  // Top contenders: rank ≤ varies. ** This is where i change the number of top contenders** 
  const realisticWinners = useMemo(() => leaderboard.filter(p => p.rank <= 0), [leaderboard]);

  return (
    <div className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen space-y-8 transition-colors duration-300">      {/* Picks Tracker */}
      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">
          🏈 NFL Pick'em Tracker 2025 - WEEK 10 🏈
        </h1>
       {/* total players */}
        <div className="text-center text-lg font-semibold text-yellow-300 dark:text-yellow-500 mb-1">
          Total Players: {initialPlayers.length}
        </div>
        {/* Winner */}
        {winners.length > 0 && (
          <div className="text-center mt-4 text-xl font-bold text-yellow-700 dark:text-green-300 blink">
            🏆 {(" ")}
            {winners.map(p => null /* p.name ****** this is the winners section so next to rophy add Winning p.name when ready set this */).join(" ")}
          </div>
        )}
        {/* Top contenders */}
        {realisticWinners.length > 0 && (
          <div className="text-center mt-2 text-lg font-semibold text-green-700 dark:text-blue-200">
            🏈 {(" ")}
             Top 7 contenders: {realisticWinners.map(p => null).join(", ")}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
            <thead className="bg-gradient-to-r from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-700 sticky top-0">
              <tr>
                <th className="border p-3 text-center">#</th>{/* 👈 new column */}
                <th className="border p-3 text-left">Player</th>
                {Array.from({ length: 14 }).map((_, idx) => (
                  <th key={idx} className="border p-3 text-center">G{idx + 1}</th>
                ))}
                <th className="border p-3 text-center">✅ Correct</th>
                <th className="border p-3 text-center">❌ Wrong</th>
                <th className="border p-3 text-center">🎯 TieBreaker ARI@DAL </th>
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
                    <td className="border p-3 text-center font-bold">{i + 1}</td>{/* 👈 number */}
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
                <th className="border p-3 text-center">🎯 TieBreaker ARI@DAL </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(player => {
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
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// (your existing file, replace contents with this)
// e.g. components/PickemTracker.tsx or app/page.tsx depending on your project

"use client";

import React, { useState, useMemo, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import useScoreboard from "../../hooks/useScoreboard"; // <- adjust path to where you put the hook

// improved exportPDF: uses html2canvas + jsPDF and supports multi-page PDFs
const exportPDF = async (options?: { elementId?: string; filenamePrefix?: string }) => {
  const elementId = options?.elementId ?? "leaderboard";
  const el = document.getElementById(elementId);
  if (!el) {
    alert("Could not find the snapshot element.");
    return;
  }

  const scale = 2; // resolution multiplier
  const padding = 12; // mm

  // clone node so we don't mutate live UI
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.zIndex = "9999";
  // ensure body-level background for the clone
  clone.style.background = window.getComputedStyle(document.body).backgroundColor || "#ffffff";

  // create a style tag that forces safe colors and strips problematic styles
  const forced = document.createElement("style");
  forced.innerHTML = `
    /* force simple colors and remove effects that html2canvas may choke on */
    *, *::before, *::after {
      color: #111 !important;
      background: #ffffff !important;
      background-image: none !important;
      border-color: #e5e7eb !important;
      box-shadow: none !important;
      filter: none !important;
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
      text-shadow: none !important;
    }
    /* images and svgs: keep visible but remove any CSS blend modes */
    img, svg { mix-blend-mode: normal !important; }
    /* tables: keep layout */
    table { border-collapse: collapse !important; }
  `;

  // append style to clone so it only affects the clone subtree
  clone.prepend(forced);

  // append clone to document so styles are computed
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: null,
    });

    // remove clone
    try { document.body.removeChild(clone); } catch { }

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("l", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // px -> mm conversion (approx 96 dpi)
    const pxToMm = (px: number) => (px * 25.4) / 96;
    const imgWidthMm = pxToMm(canvas.width);
    const imgHeightMm = pxToMm(canvas.height);

    const usableWidth = pageWidth - padding * 2;
    const scaleFactor = Math.min(usableWidth / imgWidthMm, 1);
    const renderWidth = imgWidthMm * scaleFactor;
    const renderHeight = imgHeightMm * scaleFactor;

    if (renderHeight <= pageHeight - padding * 2) {
      const x = (pageWidth - renderWidth) / 2;
      const y = padding;
      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
    } else {
      // multi-page slicing vertically
      const pxPerMm = 96 / 25.4;
      const sliceHeightPx = Math.floor((pageHeight - padding * 2) * pxPerMm / scaleFactor);
      let positionY = 0;
      let page = 0;
      while (positionY < canvas.height) {
        page++;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - positionY);
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, positionY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceHeightMm = pxToMm(sliceCanvas.height) * scaleFactor;
        const x = (pageWidth - renderWidth) / 2;
        const y = padding;
        if (page > 1) pdf.addPage();
        pdf.addImage(sliceData, "PNG", x, y, renderWidth, sliceHeightMm);
        positionY += sliceHeightPx;
      }
    }

    const prefix = options?.filenamePrefix ?? "pickem_snapshot";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${prefix}_${ts}.pdf`;
    pdf.save(filename);
  } catch (err) {
    // cleanup clone on error
    try { document.body.removeChild(clone); } catch { }
    console.error("exportPDF error", err);
    alert("Failed to generate PDF. See console for details.");
  }
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

// fallback static confirmed results (used while scoreboard loads or on error)
const confirmedResults: (string | null)[] = [
];

//Week 11 players (unchanged)
const initialPlayers: Player[] = [
  { name: "Carlos Comish", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "MIN", "GB", "CIN", "JAX", "SEA", "SF", "BAL", "KC", "DET", "LV"], tiebreaker: 52 },
  { name: "Meno", picks: ["NE", "MIA", "ATL", "BUF", "TEN", "MIN", "GB", "PIT", "LAC", "LAR", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 44 },
  { name: "Oso", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "MIN", "GB", "PIT", "LAC", "SEA", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 53 },
  { name: "J El De La R", picks: ["NE", "MIA", "CAR", "BUF", "HOU", "MIN", "GB", "PIT", "LAC", "SEA", "ARI", "BAL", "KC", "PHI", "DAL"], tiebreaker: 50 },
  { name: "Rios", picks: ["NE", "WAS", "ATL", "BUF", "TEN", "MIN", "GB", "CIN", "LAC", "LAR", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 42 },
  { name: "Yolo", picks: ["NE", "WAS", "CAR", "BUF", "HOU", "MIN", "GB", "PIT", "LAC", "LAR", "SF", "BAL", "KC", "PHI", "DAL"], tiebreaker: 44 },
  { name: "Maveric", picks: ["NE", "WAS", "ATL", "BUF", "HOU", "MIN", "GB", "PIT", "LAC", "SEA", "SF", "BAL", "KC", "PHI", "DAL"], tiebreaker: 41 },
  { name: "Chico", picks: ["NE", "MIA", "ATL", "TB", "HOU", "MIN", "NYG", "PIT", "LAC", "SEA", "SF", "BAL", "KC", "PHI", "DAL"], tiebreaker: 48 },
  { name: "Edgar", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "MIN", "GB", "PIT", "LAC", "LAR", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 46 },
  { name: "Sumo", picks: ["NE", "MIA", "ATL", "TB", "HOU", "CHI", "GB", "CIN", "LAC", "SEA", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 45 },
  { name: "Nik", picks: ["NE", "MIA", "ATL", "TB", "HOU", "CHI", "GB", "CIN", "LAC", "SEA", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 41 },
  { name: "Beto", picks: ["NE", "MIA", "ATL", "TB", "HOU", "CHI", "GB", "PIT", "JAX", "SEA", "SF", "BAL", "KC", "PHI", "LV"], tiebreaker: 45 },
  { name: "Eric", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "CHI", "GB", "CIN", "LAC", "SEA", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 40 },
  { name: "Dennis", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "MIN", "GB", "PIT", "LAC", "LAR", "SF", "BAL", "KC", "PHI", "DAL"], tiebreaker: 44 },
  { name: "Fay", picks: ["NE", "MIA", "ATL", "BUF", "TEN", "MIN", "GB", "PIT", "LAC", "SEA", "SF", "BAL", "KC", "PHI", "LV"], tiebreaker: 48 },
  { name: "Erick Escobar", picks: ["NE", "MIA", "ATL", "TB", "HOU", "MIN", "GB", "CIN", "LAC", "SEA", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 42 },
  { name: "Candon", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "CHI", "GB", "PIT", "LAC", "LAR", "SF", "BAL", "DEN", "DET", "DAL"], tiebreaker: 52 },
  { name: "Bobby", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "CHI", "GB", "PIT", "LAC", "LAR", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 52 },
  { name: "Javier", picks: ["NE", "MIA", "ATL", "BUF", "HOU", "CHI", "GB", "PIT", "LAC", "SEA", "SF", "BAL", "KC", "DET", "DAL"], tiebreaker: 40 },
];

// Helper: calculate correct/wrong
const calculateRecord = (picks: string[], results: Result) => {
  let correct = 0, wrong = 0;
  picks.forEach((pick, idx) => {
    if (results[idx]) (pick === results[idx] ? correct++ : wrong++);
  });
  return { correct, wrong };
};

export default function PickemTracker() {
  // scoreboard hook (polls /api/scoreboard)
  const { results: scoreboardResults, matchups, loading } = useScoreboard(1000 * 60 * 5); // 5 minutes
  const displayedConfirmed = scoreboardResults ?? [];


  // initialize with fallback confirmedResults
  const [results, setResults] = useState<Result>(() =>
    confirmedResults.reduce((acc, val, idx) => {
      if (val) acc[idx] = val;
      return acc;
    }, {} as Result)
  );

  // When scoreboardResults becomes available, map to results object
  useEffect(() => {
    if (!scoreboardResults) return;
    const normalized = scoreboardResults.reduce((acc, val, idx) => {
      if (val) acc[idx] = val;
      return acc;
    }, {} as Result);
    setResults(normalized);
  }, [scoreboardResults]);

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

    playersWithRecord.sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.tiebreaker - b.tiebreaker;
    });

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

  const winners = useMemo(() => leaderboard.filter(p => p.rank === 1), [leaderboard]);
  const realisticWinners = useMemo(() => leaderboard.filter(p => p.rank <= 0), [leaderboard]);

  return (
    <div id="leaderboard" className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen space-y-8 transition-colors duration-300">
      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">
          🏈 NFL Pick'em Tracker 2025 🏈
        </h1><h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">
          WEEK 11
        </h1>

        {/* Number of players in for the week */}
        <div className="text-center text-lg font-semibold text-yellow-300 dark:text-yellow-500 mb-1">
          Total Players: {initialPlayers.length}
        </div>

        {/* Winner */}
        {winners.length > 0 && (
          <div className="text-center mt-4 text-xl font-bold text-yellow-700 dark:text-green-300 blink">
            🏆{" "}
            {winners.map(p => null).join(" ")}
          </div>
        )}
        {/* Top contenders */}
        {realisticWinners.length > 0 && (
          <div className="text-center mt-2 text-lg font-semibold text-green-700 dark:text-blue-200">
            🏈 {(" ")}
            Top contenders: {realisticWinners.map(p => null).join(", ")}
          </div>
        )}

           <div className="text-center mt-2 text-sm text-gray-600 dark:text-gray-300">
          {loading ? "Loading latest scores..." : "Scores updated from live scoreboard"}
        </div>
        {/* Donwload button */}
        <div className="flex items-center justify-center gap-3 my-4">
          <button
            onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            📸 Save Picks
          </button>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
            <thead className="bg-gradient-to-r from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-700 sticky top-0">
              <tr>
                <th className="border p-3 text-center">#</th>
                <th className="border p-3 text-left">Player</th>
                {Array.from({ length: 15 }).map((_, idx) => (
                  <th key={idx} className="border p-3 text-center">G{idx + 1}</th>
                ))}
                <th className="border p-3 text-center">✅ Correct</th>
                <th className="border p-3 text-center">❌ Wrong</th>
                <th className="border p-3 text-center">🎯 TieBreaker DAL@LV </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, i) => {
                const record = calculateRecord(player.picks, results);
                const isTop4 = player.rank <= 4;
                return (
                  <tr
                    key={player.name}
                    className={`${i % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-700"} hover:bg-gray-100 dark:hover:bg-gray-600 ${isTop4 ? "ring-2 ring-yellow-400 dark:ring-yellow-500" : ""}`}
                  >
                    <td className="border p-3 text-center font-bold">{i + 1}</td>
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
      {/* MATCHUPS SECTION */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">
          📅 This week's matchups
        </h2>
        {matchups && matchups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-4xl mx-auto">
            {matchups.map((m, i) => (
              <div key={m.eventId ?? `m-${i}`} className="flex items-center justify-between p-2 rounded-md border bg-white/60 dark:bg-gray-800/60">
                <div className="flex flex-col">
                  <div className="text-sm font-medium">
                    <span className="mr-2 text-xs text-gray-500">G{i + 1}</span>
                    <span className="font-semibold">{m.awayAbbr ?? m.awayTeam ?? "—"}</span>
                    <span className="mx-2">@</span>
                    <span className="font-semibold">{m.homeAbbr ?? m.homeTeam ?? "—"}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {m.date ? new Date(m.date).toLocaleString() : "TBD"} • {m.status ?? "SCHEDULED"}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-xs text-gray-500">Result</div>
                  <div className="font-semibold">{scoreboardResults?.[i] ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500">Loading matchups...</div>
        )}
      </div>
      {/* Donwload button */}
      <div className="flex items-center justify-center gap-3 my-4">
        <button
          onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          📸 Save Picks
        </button>
      </div>
      {/* Leaderboard Card */}
      {/*      
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
                <th className="border p-3 text-center">🎯 TieBreaker DAL@LV </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(player => {
                const isTop4 = player.rank <= 4;
                return (
                  <tr
                    key={player.name}
                    className={`${player.rank % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-700"} hover:bg-gray-100 dark:hover:bg-gray-600 ${isTop4 ? "ring-2 ring-yellow-400 dark:ring-yellow-500" : ""}`}
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
      </Card> */}
    </div>
  );
}

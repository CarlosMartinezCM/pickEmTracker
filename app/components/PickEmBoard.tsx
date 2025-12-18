/* PickemTracker.tsx */
"use client";
import React, { useState, useMemo, useEffect } from "react";
import jsPDF from "jspdf";
import useScoreboard from "../api/scoreboard/useScoreboard"; // adjust path if needed
import { Matchup } from "../types"; // adjust the path

export function formatGameStatus(m: Matchup | null) {
  if (!m) return "";

  const detailed = (m.detailedStatus ?? "").toLowerCase();
  const status = (m.status ?? "").toLowerCase();
  const clock = (m.clock ?? "").trim();

  const isFinal =
    detailed.includes("final") ||
    status.includes("final");

  const isHalftime =
    detailed.includes("halftime") ||
    status.includes("halftime");

  // ✅ PreGame display 
  if (m?.period === 0) return m?.gameTime ?? "PRE-GAME"

  // ✅ FINAL overrides everything
  if (isFinal) return "FINAL";

  // ✅ HALFTIME overrides clock
  if (isHalftime) return "HALFTIME";

  // ✅ If Q4 and 0:00 → treat as FINAL
  if (m.period === 4 && (clock === "0:00" || clock === "")) {
    return "FINAL";
  }

  // ✅ Normal in-game display
  if (m.period != null && m.clock != null) {
    return `Q${m.period} ${m.clock}`;
  }

  return m.status ?? "SCHEDULED";
}

// Types
type Player = { name: string; picks: string[]; tiebreaker: number };
type Result = { [gameIndex: number]: string };
type LeaderboardPlayer = Player & { correct: number; wrong: number; rank: number };

// fallback static confirmed results (used while scoreboard loads or on error)
const confirmedResults: (string | null)[] = [];

// Week 16 players (Picks Final Sunday Morning)
const initialPlayers: Player[] = [
  { name: "Carlos Comish", picks: ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Rios", picks: ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"], tiebreaker: 0 },
  { name: "J El De La R", picks: ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Bobby", picks: ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"], tiebreaker: 0 },
  { name: "49rs", picks: ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"], tiebreaker: 0 },
];


// Helper: calculate correct/wrong
const calculateRecord = (picks: string[], results: Result) => {
  let correct = 0,
    wrong = 0;
  picks.forEach((pick, idx) => {
    if (results[idx]) (pick === results[idx] ? correct++ : wrong++);
  });
  return { correct, wrong };
};
// CLIENT-SIDE ONLY: paste into your component file (ensure "use client" at top)

// -------------------- Utility: inline computed styles / replace embeds --------------------
function inlineComputedStyles(root: HTMLElement) {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const node of nodes) {
    try {
      const cs = window.getComputedStyle(node);
      const props = [
        "width", "height", "boxSizing", "padding", "margin", "border",
        "borderRadius", "background", "backgroundColor", "backgroundImage",
        "color", "fontSize", "fontWeight", "fontFamily", "lineHeight", "textAlign",
        "display", "flexDirection", "justifyContent", "alignItems",
        "gridTemplateColumns", "gridTemplateRows", "gap", "minWidth", "minHeight",
        "maxWidth", "maxHeight", "overflow", "whiteSpace", "textDecoration",
        "boxShadow", "transform", "position", "top", "left", "right", "bottom"
      ];
      for (const p of props) {
        const v = (cs as any)[p];
        if (v && v !== "initial" && v !== "none") {
          try { (node.style as any)[p] = v; } catch { }
        }
      }
      node.style.overflow = "visible";
    } catch {
      // ignore
    }
  }
}

function replaceEmbedsWithPlaceholders(clone: HTMLElement) {
  const iframes = Array.from(clone.querySelectorAll("iframe"));
  for (const frame of iframes) {
    try {
      const rect = (frame as HTMLElement).getBoundingClientRect();
      const placeholder = document.createElement("div");
      placeholder.style.width = rect.width + "px";
      placeholder.style.height = rect.height + "px";
      placeholder.style.background = "#111827";
      placeholder.style.color = "#fff";
      placeholder.style.display = "flex";
      placeholder.style.alignItems = "center";
      placeholder.style.justifyContent = "center";
      placeholder.style.padding = "6px";
      placeholder.style.boxSizing = "border-box";
      placeholder.textContent = `iframe`;
      frame.parentNode?.replaceChild(placeholder, frame);
    } catch {
      try { frame.parentNode?.removeChild(frame); } catch { }
    }
  }

  const vids = Array.from(clone.querySelectorAll("video"));
  vids.forEach(v => {
    try {
      const rect = (v as HTMLElement).getBoundingClientRect();
      const ph = document.createElement("div");
      ph.style.width = rect.width + "px";
      ph.style.height = rect.height + "px";
      ph.style.background = "#000";
      v.parentNode?.replaceChild(ph, v);
    } catch {
      try { v.parentNode?.removeChild(v); } catch { }
    }
  });
}

async function makeRenderedClone(elementId = "leaderboard") {
  const el = document.getElementById(elementId) as HTMLElement | null;
  if (!el) throw new Error("Element not found: " + elementId);

  const clone = el.cloneNode(true) as HTMLElement;

  clone.style.position = "fixed";
  clone.style.left = "-99999px";
  clone.style.top = "0";
  clone.style.zIndex = "999999";
  clone.style.width = el.scrollWidth + "px";
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.display = "block";

  document.body.appendChild(clone);
  // allow styles to compute
  await new Promise((r) => setTimeout(r, 60));

  inlineComputedStyles(clone);
  replaceEmbedsWithPlaceholders(clone);

  // ensure final sizing
  clone.style.width = clone.scrollWidth + "px";
  clone.style.height = clone.scrollHeight + "px";

  return clone;
}

// small UI helper
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl p-6 shadow-lg transition-colors duration-300 ${className || ""}`}>
    {children}
  </div>
);

// -------------------- Exporters --------------------
async function loadDomToImage(): Promise<any | null> {
  try {
    const mod = await import("dom-to-image-more");
    const domtoimage = mod && (mod.default ?? mod);
    return (mod && (mod.default ?? mod)) as any;
  } catch (err) {
    // not available
    console.warn("dom-to-image-more dynamic import failed:", err);
    return null;
  }
}

/** Export PNG: tries dom-to-image-more, falls back to html2canvas */
export async function exportImage(elementId = "leaderboard") {
  let clone: HTMLElement | null = null;
  try {
    clone = await makeRenderedClone(elementId);

    const domtoimage = await loadDomToImage();

    if (domtoimage) {
      try {
        const dataUrl = await domtoimage.toPng(clone, {
          bgcolor: window.getComputedStyle(document.body).backgroundColor || "#ffffff",
          width: clone.scrollWidth,
          height: clone.scrollHeight,
          style: { transform: "scale(1)", transformOrigin: "top left" },
        });
        clone.remove();
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `pickem_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      } catch (err) {
        console.warn("dom-to-image-more capture failed, falling back:", err);
      }
    }

    // fallback to html2canvas
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(clone as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
      width: clone.scrollWidth,
      height: clone.scrollHeight,
    });

    try { clone.remove(); } catch { }

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `pickem_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error("exportImage error:", err);
    try { clone?.remove(); } catch { }
    alert("Failed to generate image. See console for details.");
  }
}

/** Export PDF via image -> jsPDF (supports multi-page) */
export async function exportPDF(options?: { elementId?: string; filenamePrefix?: string; orientation?: "l" | "p"; format?: string }) {
  const elementId = options?.elementId ?? "leaderboard";
  const prefix = options?.filenamePrefix ?? "pickem_snapshot";
  const orientation = options?.orientation ?? "l";
  const format = options?.format ?? "a4";

  let clone: HTMLElement | null = null;
  try {
    clone = await makeRenderedClone(elementId);

    let dataUrl: string | null = null;
    const domtoimage = await loadDomToImage();
    if (domtoimage) {
      try {
        dataUrl = await domtoimage.toPng(clone, { bgcolor: window.getComputedStyle(document.body).backgroundColor || "#ffffff", width: clone.scrollWidth, height: clone.scrollHeight });
      } catch (e) {
        console.warn("dom-to-image-more failed for PDF, will fallback to html2canvas:", e);
        dataUrl = null;
      }
    }

    if (!dataUrl) {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(clone as HTMLElement, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: null });
      dataUrl = canvas.toDataURL("image/png");
    }

    try { clone.remove(); } catch { }

    const img = new Image();
    img.src = dataUrl!;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = (e) => rej(e); });

    const pdf = new jsPDF(orientation, "mm", format);
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pxToMm = (px: number) => (px * 25.4) / 96;
    const imgWmm = pxToMm(img.width);
    const imgHmm = pxToMm(img.height);

    const margin = 12;
    const usableW = pageW - margin * 2;
    const scaleFactor = Math.min(usableW / imgWmm, 1);
    const renderW = imgWmm * scaleFactor;
    const renderH = imgHmm * scaleFactor;

    if (renderH <= pageH - margin * 2) {
      const x = (pageW - renderW) / 2;
      const y = margin;
      pdf.addImage(dataUrl!, "PNG", x, y, renderW, renderH);
    } else {
      // multi-page slicing
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const pxPerMm = 96 / 25.4;
      const slicePx = Math.floor((pageH - margin * 2) * pxPerMm / scaleFactor);

      let yPos = 0;
      let page = 0;
      while (yPos < canvas.height) {
        page++;
        const sliceH = Math.min(slicePx, canvas.height - yPos);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const sctx = sliceCanvas.getContext("2d")!;
        sctx.drawImage(canvas, 0, yPos, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL("image/png");
        const sliceHmm = pxToMm(sliceH) * scaleFactor;
        const x = (pageW - renderW) / 2;
        const y = margin;
        if (page > 1) pdf.addPage();
        pdf.addImage(sliceData, "PNG", x, y, renderW, sliceHmm);
        yPos += slicePx;
      }
    }

    const filename = `${prefix}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
    pdf.save(filename);
  } catch (err) {
    console.error("exportPDF error:", err);
    try { clone?.remove(); } catch { }
    alert("Failed to generate PDF. See console for details.");
  }
}

export default function PickemTracker() {
  // scoreboard hook (polls /api/scoreboard)
  const { results: scoreboardResults, matchups, loading } = useScoreboard(1000 * 60 * 5);
  const displayedConfirmed = scoreboardResults ?? [];

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // client-only
  }, []);

  // initialize with fallback confirmedResults
  const [results, setResults] = useState<Result>(() =>
    confirmedResults.reduce((acc, val, idx) => {
      if (val) acc[idx] = val;
      return acc;
    }, {} as Result)
  );

  // compute gameCount to keep header, winners row and table aligned
  //IMPORTANT, this is where the number of games is set!!!  ********************************************************************************
  const gameCount = (matchups && matchups.length) || (initialPlayers[0]?.picks?.length) || 12;

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
    if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  // Leaderboard (rank calculation)
  const leaderboard: LeaderboardPlayer[] = useMemo(() => {
    const playersWithRecord = initialPlayers.map((p) => ({
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
      if (lastCorrect !== null && (p.correct !== lastCorrect || p.tiebreaker !== lastTiebreaker)) {
        rank = idx + 1;
      }
      lastCorrect = p.correct;
      lastTiebreaker = p.tiebreaker;
      return { ...p, rank };
    });
  }, [results]);

  // Here is where you can set the number of players that are the *Top Contenders
  const winners = useMemo(() => leaderboard.filter((p) => p.rank === 1), [leaderboard]);

  return (
    <div id="leaderboard" className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen space-y-8 transition-colors duration-300">
      <div className="flex justify-center text-center space-x-4 mb-6">
        <a
          href="/all-matchups"
          className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
        >
          NFL Games
        </a>
        <a
          href="/pastWinners"
          className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
        >
          Past Winners
        </a>
      </div>

      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 drop-shadow-lg">
          🏈
          <span className="bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 bg-clip-text text-transparent">
            NFL Pick'em Tracker 2025
          </span>
          🏈
        </h1>
        <h1 className="text-4xl text-center font-bold mb-6 bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 bg-clip-text text-transparent drop-shadow-lg">
          WEEK 16
        </h1>

        {/* Number of players */}
        <div className="text-center text-lg font-semibold text-yellow-300 dark:text-yellow-500 mb-1">Total Players: {initialPlayers.length}</div>

        {/* Winner */}
        {winners.length > 0 && (
          <div className="text-center mt-4 text-3xl font-bold text-green-300 dark:text-green-400">
            🏆 {winners.map((p) => null).join(" ")}
          </div>
        )}

        <div className="text-center mt-2 text-sm text-gray-600 dark:text-gray-300">{loading ? "Loading latest scores..." : "Scores updated from live scoreboard every 5 minutes"}</div>

        {/* Download buttons */}
        <div className="flex justify-center gap-3 my-4">
          <button onClick={() => exportImage("leaderboard")} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">🖼 Save as Image</button>
          <button onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">📸 Save as PDF</button>
        </div>

        {/* Final Winners Row */}
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">
          Week 16 matchup results
        </h2>
        {mounted && scoreboardResults?.length ? (
          <div className="mt-2 mb-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
            {scoreboardResults.slice(0, gameCount).map((winner, i) => {
              const m = matchups ? (matchups[i] as Matchup) : null;
              let winnerLogo: string | null = null;
              if (winner && m) {
                if (winner === m.awayAbbr || winner === m.awayTeam) winnerLogo = m.awayLogo ?? null;
                else if (winner === m.homeAbbr || winner === m.homeTeam) winnerLogo = m.homeLogo ?? null;
              }

              return (
                <div
                  key={`winner-${i}`}
                  className="flex items-center gap-1 px-3 py-1 text-green-900 dark:text-green-400 rounded border text-lg"
                >
                  {winnerLogo && (
                    <img
                      src={winnerLogo}
                      alt={winner ?? "Winner"}
                      className="w-5 h-5 object-contain"
                    />
                  )}
                  <span>{winner || "—"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500">Loading winners...</div>
        )}

        {/* Pick'ems Table */}
        <div className="overflow-x-auto mt-4">
          <table className="max-w-full border-separate border-spacing-0 text-[10px]">

            <thead className="sticky top-0 z-30 bg-gradient-to-r from-blue-800 via-blue-500 to-blue-700 text-white">
              <tr>
                {/* Rank # */}
                <th className="border-b-2 border-white-800 p-3 text-center text-base border-blue-300">#</th>

                {/* Player */}
                <th className="border p-3 text-base text-center font-bold border-blue-400">Player</th>

                {/* Matchup columns */}
                {Array.from({ length: gameCount }).map((_, idx) => {
                  const m = mounted && matchups ? (matchups[idx] as Matchup) : null;

                  const awayScorePresent = typeof m?.awayScore === "number";
                  const homeScorePresent = typeof m?.homeScore === "number";
                  const numericScore = (awayScorePresent || homeScorePresent)
                    ? `${awayScorePresent ? m!.awayScore : "-"} - ${homeScorePresent ? m!.homeScore : "-"}`
                    : null;

                  const fallbackResult = mounted && scoreboardResults ? scoreboardResults[idx] ?? null : null;
                  const displayResult = numericScore ?? fallbackResult ?? "—";

                  const winner = scoreboardResults ? scoreboardResults[idx] : null;

                  // Decide winner logo
                  let winnerLogo: string | null = null;
                  if (winner && m) {
                    if (winner === m.awayAbbr || winner === m.awayTeam) winnerLogo = m.awayLogo ?? null;
                    else if (winner === m.homeAbbr || winner === m.homeTeam) winnerLogo = m.homeLogo ?? null;
                  }

                  const gameStatus = formatGameStatus(m);
                  const showClock = gameStatus ? !/FINAL|HALFTIME/i.test(gameStatus) : false;

                  // Small info
                  const clockText = m?.clock ?? null;
                  const quarterText = m?.period != null ? `Q${m.period}` : null;
                  const possessionText = m?.possession ?? null;
                  const downDistanceText = m?.down != null && m?.yardsToGo != null ? `${m.down} & ${m.yardsToGo}` : null;
                  const ballOnText = m?.ballOn ?? null;
                  const lastPlayText = m?.lastPlayText ?? null;

                  return (
                    <th key={idx} className="border p-2 text-center font-bold border-blue-00">
                      <div className="flex flex-col items-center gap-1 max-w-[180px]"> {/* increased from 140px */}

                        {/* Logos + Team Names */}
                        <div className="flex items-center justify-center gap-1 w-full text-center">
                          {/* Away Team */}
                          <div className="flex items-center gap-0.5 min-w-[50px] max-w-[70px] justify-end"> {/* wider */}
                            {m?.awayLogo && <img src={m.awayLogo} alt={m.awayAbbr ?? "Away"} className="w-4 h-4 object-contain" />}
                            <span className="truncate text-xs">{m?.awayAbbr ?? m?.awayTeam ?? "—"}</span>
                          </div>

                          {/* @ symbol */}
                          <span className="mx-1 text-xs flex-shrink-0">@</span>

                          {/* Home Team */}
                          <div className="flex items-center gap-0.5 min-w-[50px] max-w-[70px] justify-start"> {/* wider */}
                            {m?.homeLogo && <img src={m.homeLogo} alt={m.homeAbbr ?? "Home"} className="w-4 h-4 object-contain" />}
                            <span className="truncate text-xs">{m?.homeAbbr ?? m?.homeTeam ?? "—"}</span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-center text-sm font-bold text-whites">{displayResult}</div>

                        {/* Winner box under score */}
                        {winner && (
                          <div className="flex items-center gap-1 mt-1 px-2 py-0.5 text-green-900 dark:text-green-400 rounded border text-xs">
                            {winnerLogo && <img src={winnerLogo} alt={winner} className="w-4 h-4 object-contain" />}
                            <span>{winner}</span>
                          </div>
                        )}

                        {/* Live clock / quarter / possession */}
                        {showClock && (clockText || quarterText || possessionText) && (
                          <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            {clockText && <span className="font-mono">{clockText}</span>}
                            {quarterText && <span className="px-1 rounded bg-white/20 text-[11px]">{quarterText}</span>}
                            {possessionText && <span className="text-[11px] italic">Poss: {possessionText}</span>}
                          </div>
                        )}

                        {/* Down & distance + ball on */}
                        {(downDistanceText || ballOnText) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            {downDistanceText && <span>{downDistanceText}</span>}
                            {!downDistanceText && m?.yardsToGo != null && <span>{m.yardsToGo} to go</span>}
                            {ballOnText && <span>• {ballOnText}</span>}
                          </div>
                        )}

                        {/* Last play text */}
                        {lastPlayText && (
                          <div className="text-[10px] italic text-gray-500 truncate w-full">{lastPlayText}</div>
                        )}

                        {/* Game status */}
                        <div className="text-green-900 dark:text-green-400 text-sm mt-1">
                          {mounted && matchups && matchups[idx] ? gameStatus : "—"}
                        </div>
                      </div>
                    </th>

                  );
                })}

                {/* Correct / Wrong / TieBreaker headers */}
                <th className="border p-2 text-center font-bold text-xs border-blue-300">✅ Correct</th>
                <th className="border p-2 text-center font-bold text-xs border-blue-300">❌ Wrong</th>
                <th className="border p-2 text-center font-bold text-xs border-blue-300">🎯 TieBreaker</th>
              </tr>
            </thead>

            <tbody>
              {leaderboard.map((player, i) => {
                const record = calculateRecord(player.picks, results);
                const isTop4 = player.rank <= 0;

                return (
                  <tr
                    key={player.name}
                    className={`${i % 2 === 0 ? "bg-blue-50 dark:bg-blue-900/30" : "bg-blue-100 dark:bg-blue-800/20"} hover:bg-blue-200 dark:hover:bg-blue-700/40 ${isTop4 ? "ring-2 ring-yellow-400 dark:ring-yellow-500" : ""
                      }`}
                  >
                    <td className="border p-3 text-base text-center font-bold border-blue-500">{i + 1}</td>
                    <td className="border p-3 text-base text-center font-semibold border-blue-500">{player.name}</td>

                    {player.picks.slice(0, gameCount).map((pick, idx) => (
                      <td
                        key={idx}
                        className={`border p-2 text-center text-sm border-blue-800 ${results[idx]
                          ? results[idx] === pick
                            ? "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100"
                            : "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100"
                          : "bg-blue-50 dark:bg-blue-900/20"
                          }`}
                      >
                        {pick}
                      </td>
                    ))}

                    <td className="border p-3 text-center font-bold text-green-700 text-lg dark:text-green-300 border-blue-300 dark:border-blue-600">{record.correct}</td>
                    <td className="border p-3 text-center font-bold text-red-700 text-lg dark:text-red-300 border-blue-300 dark:border-blue-600">{record.wrong}</td>
                    <td className="border p-3 text-center text-lg font-bold border-blue-300 dark:border-blue-600">{player.tiebreaker}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </Card>
      {/* Download buttons */}
      <div className="flex justify-center gap-3 my-4">
        <button onClick={() => exportImage("leaderboard")} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">🖼 Save as Image</button>
        <button onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">📸 Save as PDF</button>
      </div>
    </div>

  );

}

/* PickemTracker.tsx */
"use client";
import React, { useState, useMemo, useEffect } from "react";
import jsPDF from "jspdf";
import useScoreboard from "../../hooks/useScoreboard"; // adjust path if needed

// Types
type Player = { name: string; picks: string[]; tiebreaker: number };
type Result = { [gameIndex: number]: string };
type LeaderboardPlayer = Player & { correct: number; wrong: number; rank: number };

// fallback static confirmed results (used while scoreboard loads or on error)
const confirmedResults: (string | null)[] = [];

// Week 12 players (example)
const initialPlayers: Player[] = [];

// Helper: calculate correct/wrong
const calculateRecord = (picks: string[], results: Result) => {
  let correct = 0,
    wrong = 0;
  picks.forEach((pick, idx) => {
    if (results[idx]) (pick === results[idx] ? correct++ : wrong++);
  });
  return { correct, wrong };
};

/** Helper: replace iframes and videos in a clone so capture doesn't try to access cross-origin frames */
function sanitizeCloneForCapture(clone: HTMLElement) {
  const iframes = Array.from(clone.querySelectorAll("iframe"));
  for (const frame of iframes) {
    try {
      const rect = (frame as HTMLElement).getBoundingClientRect();
      const placeholder = document.createElement("div");
      placeholder.style.width = rect.width + "px";
      placeholder.style.height = rect.height + "px";
      placeholder.style.display = "inline-block";
      placeholder.style.background = "#111827";
      placeholder.style.color = "#fff";
      placeholder.style.fontSize = "12px";
      placeholder.style.padding = "6px";
      placeholder.style.boxSizing = "border-box";
      placeholder.style.overflow = "hidden";
      placeholder.innerText = `iframe: ${frame.getAttribute("src") ?? "embedded content"}`;
      frame.parentNode?.replaceChild(placeholder, frame);
    } catch {
      frame.parentNode?.removeChild(frame);
    }
  }

  const vids = Array.from(clone.querySelectorAll("video"));
  vids.forEach((v) => {
    const placeholder = document.createElement("div");
    const rect = (v as HTMLElement).getBoundingClientRect();
    placeholder.style.width = rect.width + "px";
    placeholder.style.height = rect.height + "px";
    placeholder.style.background = "#000";
    v.parentNode?.replaceChild(placeholder, v);
  });
}

/** Make a clone, sanitize iframe/video, append offscreen, return clone (caller must remove clone) */
async function makeClone(elementId = "leaderboard") {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Element not found: " + elementId);

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = "-99999px";
  clone.style.top = "100";
  clone.style.zIndex = "9999";

  // ensure clone can grow to contain all rows
  clone.style.height = "auto";
  clone.style.minHeight = "auto";
  clone.style.overflow = "visible";

  // keep the page background so colors look the same
  clone.style.background = window.getComputedStyle(document.body).backgroundColor || "#ffffff";

  sanitizeCloneForCapture(clone);

  document.body.appendChild(clone);
  // give browser a tick to apply styles
  await new Promise((r) => setTimeout(r, 50));
  return clone;
}

/** Export PNG — uses dom-to-image-more for robust CSS support */
async function loadDomToImage() {
  if (typeof window === "undefined") throw new Error("Client only");
  // require dynamically to avoid SSR errors
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("dom-to-image-more");
}

export async function exportImage(elementId = "leaderboard") {
  let clone: HTMLElement | null = null;
  try {
    const domtoimage = await loadDomToImage();
    clone = await makeClone(elementId);

    const dataUrl = await domtoimage.toPng(clone, {
      bgcolor: null,
      style: {
        width: clone.scrollWidth + "px",
        height: clone.scrollHeight + "px",
        transform: "scale(1)",
      },
    });

    try {
      clone.remove();
    } catch {}

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `pickem_snapshot_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error("exportImage error:", err);
    try {
      clone?.remove();
    } catch {}
    alert("Failed to generate image. See console for details.");
  }
}

/** Export PDF via dom-to-image-more PNG -> jsPDF */
export async function exportPDF(options?: { elementId?: string; filenamePrefix?: string; orientation?: "l" | "p"; format?: string }) {
  const elementId = options?.elementId ?? "leaderboard";
  const prefix = options?.filenamePrefix ?? "pickem_snapshot";
  const orientation = options?.orientation ?? "l";
  const format = options?.format ?? "a4";

  let clone: HTMLElement | null = null;
  try {
    const domtoimage = await loadDomToImage();
    clone = await makeClone(elementId);

    const dataUrl = await domtoimage.toPng(clone, {
      bgcolor: null,
      style: { width: clone.scrollWidth + "px", height: clone.scrollHeight + "px" },
    });

    try {
      clone.remove();
    } catch {}

    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = (e) => rej(e);
    });

    const pdf = new jsPDF(orientation, "mm", format);
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const pxToMm = (px: number) => (px * 25.4) / 96;
    const imgWmm = pxToMm(img.width);
    const imgHmm = pxToMm(img.height);

    const margin = 12;
    const usableW = pageW - margin * 2;
    const scaleFactor = Math.min(usableW / imgWmm, (pageH - margin * 2) / imgHmm, 1);
    const renderW = imgWmm * scaleFactor;
    const renderH = imgHmm * scaleFactor;

    if (renderH <= pageH - margin * 2) {
      const x = (pageW - renderW) / 2;
      const y = margin;
      pdf.addImage(dataUrl, "PNG", x, y, renderW, renderH);
    } else {
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
    try {
      clone?.remove();
    } catch {}
    alert("Failed to generate PDF. See console for details.");
  }
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl p-6 shadow-lg transition-colors duration-300 ${className || ""}`}>
    {children}
  </div>
);

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
  const gameCount = (matchups && matchups.length) || (initialPlayers[0]?.picks?.length) || 14;

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

  const winners = useMemo(() => leaderboard.filter((p) => p.rank === 1), [leaderboard]);

  return (
    <div id="leaderboard" className="p-8 bg-gray-100 dark:bg-gray-900 min-h-screen space-y-8 transition-colors duration-300">
      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">🏈 NFL Pick'em Tracker 2025 🏈</h1>
        <h1 className="text-3xl text-center font-bold mb-6 text-blue-800 dark:text-blue-300">WEEK 12</h1>

        {/* Number of players */}
        <div className="text-center text-lg font-semibold text-yellow-300 dark:text-yellow-500 mb-1">Total Players: {initialPlayers.length}</div>

        {/* Winners */}
        {winners.length > 0 && (
          <div className="text-center mt-4 text-xl font-bold text-yellow-700 dark:text-green-300">
            🏆 Winner {winners.map((p) => p.name).join(" ")}
          </div>
        )}

        <div className="text-center mt-2 text-sm text-gray-600 dark:text-gray-300">{loading ? "Loading latest scores..." : "Scores updated from live scoreboard"}</div>

        {/* Download buttons */}
        <div className="flex justify-center gap-3 my-4">
          <button onClick={() => exportImage("leaderboard")} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">🖼 Save as Image</button>
          <button onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">📸 Save as PDF</button>
        </div>

        {/* Final Winners Row */}
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">Week 12 Results</h2>
        {mounted && scoreboardResults && scoreboardResults.length > 0 && (
          <div className="mt-2 mb-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
            {scoreboardResults.slice(0, gameCount).map((winner, i) => (
              <div key={`winner-${i}`} className="px-3 py-1 bg-white/70 dark:bg-gray-800/70 rounded border shadow-sm">
                {winner || "—"}
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-[10px]">
            <thead className="bg-gradient-to-r from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-700 sticky top-0">
              <tr>
                <th className="border p-3 text-center text-sm">#</th>
                <th className="border p-3 text-left text-sm">Player</th>

                {/* MATCHUPS INSIDE THE GAME COLUMNS */}
                {Array.from({ length: gameCount }).map((_, idx) => {
                  const m = mounted && matchups ? matchups[idx] : null;
                  const result = mounted && scoreboardResults ? scoreboardResults[idx] : null;

                  return (
                    <th key={idx} className="border p-3 text-center leading-tight">
                      <div className="font-semibold text-xs">
                        {m ? `${m.awayAbbr ?? m.awayTeam ?? "—"} @ ${m.homeAbbr ?? m.homeTeam ?? "—"}` : "—"}
                      </div>
                      <div className="text-sm mt-1 text-blue-900 dark:text-blue-200">{result ?? "—"}</div>
                    </th>
                  );
                })}

                <th className="border p-3 text-center text-xs">✅ Correct</th>
                <th className="border p-3 text-center text-xs">❌ Wrong</th>
                <th className="border p-3 text-center text-xs">🎯 TieBreaker CAR @ SF</th>
              </tr>
            </thead>

            <tbody>
              {leaderboard.map((player, i) => {
                const record = calculateRecord(player.picks, results);
                const isTop4 = player.rank <= 4;

                return (
                  <tr key={player.name} className={`${i % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-700"} hover:bg-gray-100 dark:hover:bg-gray-600 ${isTop4 ? "ring-2 ring-yellow-400 dark:ring-yellow-500" : ""}`}>
                    <td className="border p-3 text-center font-bold">{i + 1}</td>
                    <td className="border p-3 font-semibold">{player.name}</td>

                    {player.picks.slice(0, gameCount).map((pick, idx) => (
                      <td key={idx} className={`border p-2 text-center font-medium ${results[idx] ? (results[idx] === pick ? "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100" : "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100") : "bg-gray-100 dark:bg-gray-600"}`}>
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
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">📅 Week 12 matchups</h2>
        {matchups && matchups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-4xl mx-auto">
            {matchups.map((m, i) => (
              <div key={m.eventId ?? `m-${i}`} className="flex items-center justify-between p-2 rounded-md border bg-white/60 dark:bg-gray-800/60">
                <div className="flex flex-col">
                  <div className="text-[10px] font-medium">
                    <span className="mr-2 text-xs text-gray-500">G{i + 1}</span>
                    <span className="font-semibold">{m.awayAbbr ?? m.awayTeam ?? "—"}</span>
                    <span className="mx-2">@</span>
                    <span className="font-semibold">{m.homeAbbr ?? m.homeTeam ?? "—"}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{m.date ? new Date(m.date).toLocaleString() : "TBD"} • {m.status ?? "SCHEDULED"}</div>
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

      {/* Download buttons */}
      <div className="flex justify-center gap-3 my-4">
        <button onClick={() => exportImage("leaderboard")} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">🖼 Save as Image</button>
        <button onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">📸 Save as PDF</button>
      </div>
    </div>
  );
}

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

// Week 13 players (Picks Final Thursday morning)
const initialPlayers: Player[] = [
  { name: "Carlos (comish)", picks: ["DET", "KC", "BAL", "PHI"], tiebreaker: 40 },
  { name: "Fay", picks: ["DET", "DAL", "BAL", "PHI"], tiebreaker: 48 },
  { name: "Edgar B", picks: ["DET", "KC", "BAL", "PHI"], tiebreaker: 41 },
  { name: "Yolo", picks: ["DET", "KC", "BAL", "PHI"], tiebreaker: 44 },
  { name: "Eric Rodriguez", picks: ["DET", "DAL", "BAL", "PHI"], tiebreaker: 49 },
  { name: "Bobby", picks: ["DET", "KC", "BAL", "PHI"], tiebreaker: 51 },
  { name: "Sumo", picks: ["DET", "KC", "BAL", "PHI"], tiebreaker: 44 },
  { name: "Candon", picks: ["GB", "KC", "BAL", "PHI"], tiebreaker: 52 },
  { name: "Oso", picks: ["DET", "KC", "CIN", "PHI"], tiebreaker: 53 },
  { name: "Nik", picks: ["DET", "KC", "BAL", "PHI"], tiebreaker: 45 },
];

/****************************************************************************************************************
// Week 13 players (picks hidden)
const initialPlayers: Player[] = [
  { name: "Carlos (comish)", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Fay", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Edgar B", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Yolo", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Eric Rodriguez", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Bobby", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Sumo", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Candon", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Oso", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
  { name: "Nik", picks: ["-", "-", "-", "-"], tiebreaker: 0 },
];

/****************************************************************************************************************
 * ********************************************************************************************************************/
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
  //IMPORTANT, this is where the number of games is set!!!
  const gameCount = (matchups && matchups.length) || (initialPlayers[0]?.picks?.length) || 4;

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
      <Card>
        <h1 className="text-3xl text-center font-bold mb-6 drop-shadow-lg">
          🏈
          <span className="bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 bg-clip-text text-transparent">
            NFL Pick'em Tracker 2025
          </span>
          🏈
        </h1>
        <h1 className="text-4xl text-center font-bold mb-6 bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 bg-clip-text text-transparent drop-shadow-lg">
          WEEK 13
        </h1>

        <h1 className="text-3xl text-center font-bold mb-6 bg-gradient-to-r from-orange-700 via-amber-600 to-yellow-500 bg-clip-text text-transparent drop-shadow-lg">
          Special Thanksgiving Matchups
        </h1>

        {/* Number of players */}
        <div className="text-center text-lg font-semibold text-yellow-300 dark:text-yellow-500 mb-1">Total Players: {initialPlayers.length}</div>

        {/* Winner */}
        {winners.length > 0 && (
          <div className="text-center mt-4 text-xl font-bold text-yellow-700 dark:text-green-300">
            🏆 {winners.map((p) => p.name).join(" ")}
          </div>
        )}

        <div className="text-center mt-2 text-sm text-gray-600 dark:text-gray-300">{loading ? "Loading latest scores..." : "Scores updated from live scoreboard every 5 minutes"}</div>

        {/* Download buttons */}
        <div className="flex justify-center gap-3 my-4">
          <button onClick={() => exportImage("leaderboard")} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">🖼 Save as Image</button>
          <button onClick={() => exportPDF({ elementId: "leaderboard", filenamePrefix: "pickem_week" })} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-sm">📸 Save as PDF</button>
        </div>

        {/* Final Winners Row */}
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">Week 13 Thanksgiving matchup results</h2>
        {mounted && scoreboardResults && scoreboardResults.length > 0 && (
          <div className="mt-2 mb-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
            {scoreboardResults.slice(0, gameCount).map((winner, i) => (
              <div key={`winner-${i}`} className="px-3 py-1 text-green-900 dark:text-green-400 rounded border text-lg">
                {winner || "—"}
              </div>
            ))}
          </div>
        )}

        {/* Pick'ems Table */}
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full border-separate border-spacing-0 text-[10px]">
            <thead className="sticky top-0 z-30 bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 text-white">
              <tr>
                <th className="border-b-2 border-white-800 p-3 text-center text-lg border-blue-300">#</th>
                <th className="border p-3 text-lg text-center font-bold border-blue-400">Player</th>

                {Array.from({ length: gameCount }).map((_, idx) => {
                  const m = mounted && matchups ? matchups[idx] : null;
                  const result = mounted && scoreboardResults ? scoreboardResults[idx] : null;

                  return (
                    <th key={idx} className="border p-3 text-lg text-center font-bold border-blue-00">
                      <div className="font-semibold text-base">
                        {m ? `${m.awayAbbr ?? m.awayTeam ?? "—"} @ ${m.homeAbbr ?? m.homeTeam ?? "—"}` : "—"}
                      </div>
                      <div className="text-lg mt-1 text-green-900 dark:text-green-400">{result ?? "—"}</div>
                    </th>
                  );
                })}

                <th className="border p-3 text-lg text-center font-bold border-blue-300">✅ Correct</th>
                <th className="border p-3 text-lg text-center font-bold border-blue-300">❌ Wrong</th>
                <th className="border p-3 text-lg text-center font-bold border-blue-300">🎯 TieBreaker</th>
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
                    <td className="border p-3 text-lg text-center font-bold border-blue-500">{i + 1}</td>
                    <td className="border p-3 text-lg text-left font-semibold border-blue-500">{player.name}</td>

                    {player.picks.slice(0, gameCount).map((pick, idx) => (
                      <td
                        key={idx}
                        className={`border p-2 text-center text-lg border-blue-800 ${results[idx]
                            ? results[idx] === pick
                              ? "bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100"
                              : "bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100"
                            : "bg-blue-50 dark:bg-blue-900/20"
                          }`}
                      >
                        {pick}
                      </td>
                    ))}

                    <td className="border p-3 text-center font-bold text-green-700 dark:text-green-300 border-blue-300 dark:border-blue-600">{record.correct}</td>
                    <td className="border p-3 text-center font-bold text-red-700 dark:text-red-300 border-blue-300 dark:border-blue-600">{record.wrong}</td>
                    <td className="border p-3 text-center font-bold border-blue-300 dark:border-blue-600">{player.tiebreaker}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {/* MATCHUPS SECTION */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">📅 Week 13 Thanksgiving matchups</h2>
        {matchups && matchups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-4xl mx-auto">
            {matchups.map((m, i) => (
              <div key={m.eventId ?? `m-${i}`} className="flex items-center justify-between p-2 rounded-md border bg-white/60 dark:bg-gray-800/60">
                <div className="flex flex-col">
                  <div className="text-[10px] font-medium">
                    <span className="mr-2 text-xs text-gray-500">G{i + 1}</span>
                    <span className="font-semibold text-sm">{m.awayAbbr ?? m.awayTeam ?? "—"}</span>
                    <span className="mx-2">@</span>
                    <span className="font-semibold text-sm">{m.homeAbbr ?? m.homeTeam ?? "—"}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{m.date ? new Date(m.date).toLocaleString() : "TBD"} • {m.status ?? "SCHEDULED"}</div>
                </div>
                <div className="text-right text-[18px]">
                  <div className="text-xs text-gray-500">Result</div>
                  <div className="text-lg mt-1 text-green-900 dark:text-green-400">{scoreboardResults?.[i] ?? "—"}</div>
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
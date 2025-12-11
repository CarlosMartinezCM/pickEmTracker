"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type PreviousWinner = { week: number; winner: string };

const previousWinners: PreviousWinner[] = [
  { week: 14, winner: "Sumo" },
  { week: 13.1, winner: "Yolo" },
  { week: 13, winner: "Thanksgiving_Games_Fay" },
  { week: 12, winner: "Yolo" },
  { week: 11, winner: "Candon" },
  { week: 10, winner: "Javier" },
  { week: 9, winner: "Oso" },
  { week: 8, winner: "Maverick" },
  { week: 7, winner: "Dennis" },
  { week: 6, winner: "Edgar" },
  { week: 5, winner: "Candon" },
  { week: 4, winner: "Bobby" },
  { week: 3, winner: "Edgar" },
  { week: 2, winner: "Erick_Escobar" },
  { week: 1, winner: "Candon" },
];

const TRY_EXT = [".png", ".jpg", ".jpeg", ".webp"];

/** Attempts to load image by creating an Image() — good cross-browser check. */
function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("not found"));
    img.src = url;
  });
}

/** Build a list of candidate filename bases to try (handles underscores, spaces, case) */
function buildCandidates(baseName: string) {
  const candidates: string[] = [];
  const raw = baseName.trim();

  // common variants:
  const underscored = raw.replace(/\s+/g, "_");
  const nounderscore = raw.replace(/_+/g, " ");
  const lower = raw.toLowerCase();
  const lowerUnderscore = underscored.toLowerCase();

  const variants = Array.from(new Set([raw, underscored, lower, lowerUnderscore, nounderscore]));

  for (const v of variants) {
    for (const ext of TRY_EXT) {
      candidates.push(`/images/${v}${ext}`);
    }
  }

  // also try removing non-alphanumeric chars (safe fallback)
  const alnum = raw.replace(/[^a-z0-9]/gi, "");
  if (alnum && !variants.includes(alnum)) {
    for (const ext of TRY_EXT) candidates.push(`/images/${alnum}${ext}`);
    const alnumLower = alnum.toLowerCase();
    if (alnumLower !== alnum) for (const ext of TRY_EXT) candidates.push(`/images/${alnumLower}${ext}`);
  }

  return candidates;
}

export default function WinnerDetailPage() {
  const params = useParams();
  const week = params.week as string;
  const winner = previousWinners.find((p) => p.week.toString() === week);

  const [imageSrc, setImageSrc] = useState<string>("/images/default.png");
  const [tried, setTried] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!winner) {
      setImageSrc("/images/default.png");
      return;
    }

    (async () => {
      const base = winner.winner;
      const candidates = buildCandidates(base);
      setTried(candidates);

      console.info("WinnerDetailPage: trying image candidates:", candidates);

      for (const candidate of candidates) {
        try {
          await loadImage(candidate);
          if (!mounted) return;
          console.info("WinnerDetailPage: found image:", candidate);
          setImageSrc(candidate);
          return;
        } catch (err) {
          console.debug("WinnerDetailPage: not found:", candidate);
        }
      }

      // final fallback
      if (mounted) {
        console.warn("WinnerDetailPage: no candidate found, using default.png");
        setImageSrc("/images/default.png");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [winner]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="flex justify-center space-x-4 mb-6">
        <Link href="/pastWinners" className="px-4 py-2 bg-blue-600 text-white rounded">
          🔙 Back
        </Link>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded">
          Pick'ems
        </Link>
        <Link href="/all-matchups" className="px-4 py-2 bg-blue-600 text-white rounded">
          NFL Games
        </Link>
      </div>

      {winner ? (
        <>
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-600">Week {winner.week} Winner</h1>
          <div className="bg-white/20 dark:bg-black/25 p-6 rounded-xl shadow-lg">
            <img
              src={imageSrc}
              alt={`Winner Week ${winner.week}`}
              className="max-w-full rounded-lg shadow-lg"
              onError={(e) => {
                // last-ditch guard (shouldn't normally be hit)
                console.error("img onError for", (e.currentTarget as HTMLImageElement).src);
                (e.currentTarget as HTMLImageElement).src = "/images/default.png";
              }}
            />
          </div>

          <div className="mt-4 text-xs text-gray-500 max-w-xl text-center">
            <div>Attempted candidate URLs (check browser console for full list):</div>
            <pre className="text-left bg-black/5 dark:bg-white/5 p-2 rounded text-[11px] mt-2">{tried.join("\n")}</pre>
            <p className="mt-2">If none of these load on the deployed site, check that the files exist in <code>public/images</code> and are committed to git (and that casing matches exactly).</p>
          </div>
        </>
      ) : (
        <p className="text-xl text-gray-700">Winner not found for week {week}.</p>
      )}
    </div>
  );
}

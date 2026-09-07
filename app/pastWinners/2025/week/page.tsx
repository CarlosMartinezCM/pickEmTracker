"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type CurrentWinner = {
  week: number;
  winner: string;
};

/*
 * ADD YOUR 2026 WINNERS HERE
 *
 * Example:
 *
 * { week: 1, winner: "Carlos_W1_2026" },
 * { week: 2, winner: "Bob_W2_2026" },
 *
 * You can add the actual winners as the season progresses.
 */

const currentWinners: CurrentWinner[] = [
  // { week: 1, winner: "WinnerName_W1_2026" },
  // { week: 2, winner: "WinnerName_W2_2026" },
];

const TRY_EXT = [".png", ".jpg", ".jpeg", ".webp"];

/**
 * Attempts to load an image.
 */
function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("not found"));

    img.src = url;
  });
}

/**
 * Build possible filename variations.
 */
function buildCandidates(baseName: string) {
  const candidates: string[] = [];

  const raw = baseName.trim();

  const underscored = raw.replace(/\s+/g, "_");
  const nounderscore = raw.replace(/_+/g, " ");
  const lower = raw.toLowerCase();
  const lowerUnderscore = underscored.toLowerCase();

  const variants = Array.from(
    new Set([
      raw,
      underscored,
      lower,
      lowerUnderscore,
      nounderscore,
    ])
  );

  for (const v of variants) {
    for (const ext of TRY_EXT) {
      candidates.push(`/images/winners/${v}${ext}`);
    }
  }

  // Also try removing non-alphanumeric characters.
  const alnum = raw.replace(/[^a-z0-9]/gi, "");

  if (alnum && !variants.includes(alnum)) {
    for (const ext of TRY_EXT) {
      candidates.push(`/images/winners/${alnum}${ext}`);
    }

    const alnumLower = alnum.toLowerCase();

    if (alnumLower !== alnum) {
      for (const ext of TRY_EXT) {
        candidates.push(
          `/images/winners/${alnumLower}${ext}`
        );
      }
    }
  }

  return candidates;
}

export default function WinnerDetailPage() {
  const params = useParams();

  const week = params.week as string;

  const winner = currentWinners.find(
    (p) => p.week.toString() === week
  );

  const [imageSrc, setImageSrc] = useState<string>(
    "/images/default.png"
  );

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

      console.info(
        "2026 WinnerDetailPage: trying image candidates:",
        candidates
      );

      for (const candidate of candidates) {
        try {
          await loadImage(candidate);

          if (!mounted) return;

          console.info(
            "2026 WinnerDetailPage: found image:",
            candidate
          );

          setImageSrc(candidate);

          return;
        } catch (err) {
          console.debug(
            "2026 WinnerDetailPage: not found:",
            candidate
          );
        }
      }

      if (mounted) {
        console.warn(
          "2026 WinnerDetailPage: no candidate found, using default.png"
        );

        setImageSrc("/images/default.png");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [winner]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">

      {/* Navigation */}
      <div className="flex justify-center space-x-4 mb-6">

        <Link
          href="/pastWinners"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          🔙 Back to 2026 Winners
        </Link>

        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Pick'ems
        </Link>

        <Link
          href="/all-matchups"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          NFL Games
        </Link>

      </div>

      {winner ? (
        <>
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-600">
            Week {winner.week} Winner
          </h1>

          <div className="bg-white/20 dark:bg-black/25 p-6 rounded-xl shadow-lg">

            <img
              src={imageSrc}
              alt={`2026 Winner Week ${winner.week}`}
              className="max-w-full rounded-lg shadow-lg"
              onError={(e) => {
                console.error(
                  "img onError for",
                  (e.currentTarget as HTMLImageElement).src
                );

                (e.currentTarget as HTMLImageElement).src =
                  "/images/default.png";
              }}
            />

          </div>
        </>
      ) : (
        <p className="text-xl text-gray-700 dark:text-gray-300">
          Winner not found for week {week}.
        </p>
      )}

    </div>
  );
}
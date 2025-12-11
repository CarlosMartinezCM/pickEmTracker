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

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("not found"));
    img.src = url;
  });
}

export default function WinnerDetailPage() {
  const params = useParams();
  const week = params.week as string;
  const winner = previousWinners.find((p) => p.week.toString() === week);

  const [imageSrc, setImageSrc] = useState<string>("/images/default.png");

  useEffect(() => {
    let mounted = true;
    if (!winner) {
      setImageSrc("/images/default.png");
      return;
    }

    // try candidate urls in order
    (async () => {
      const base = `/images/${winner.winner}`;
      for (const ext of TRY_EXT) {
        const candidate = `${base}${ext}`;
        try {
          await loadImage(candidate);
          if (mounted) {
            setImageSrc(candidate);
            return;
          }
        } catch {
          // try next
        }
      }
      // fallback
      if (mounted) setImageSrc("/images/default.png");
    })();

    return () => {
      mounted = false;
    };
  }, [winner]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="flex justify-center space-x-4 mb-6">
        <Link href="/pastWinners" className="px-4 py-2 bg-blue-600 text-white rounded">
          🔙 Back to Previous Winners
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
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-600">
            Week {winner.week} Winner
          </h1>
          <div className="bg-white/20 dark:bg-black/25 p-6 rounded-xl shadow-lg">
            <img
              src={imageSrc}
              alt={`Winner Week ${winner.week}`}
              className="max-w-full rounded-lg shadow-lg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/images/default.png";
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-xl text-gray-700">Winner not found for week {week}.</p>
      )}
    </div>
  );
}

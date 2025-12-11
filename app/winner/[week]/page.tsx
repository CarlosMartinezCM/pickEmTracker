"use client";
import { useParams } from "next/navigation";
import Link from "next/link";

type PreviousWinner = {
  week: number;
  winner: string;
};

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

export default function WinnerDetailPage() {
  const params = useParams();
  const week = params.week as string;

  const winner = previousWinners.find((p) => p.week.toString() === week);

  const imageUrl = winner
    ? `/images/${winner.winner}.png`
    : "/images/default.png";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="flex justify-center space-x-4 mb-6">
        <Link
          href="/pastWinners"
          className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow transition-colors duration-200"
        >
          🔙 Back to Previous Winners
        </Link>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow transition-colors duration-200"
        >
          Pick'ems
        </Link>
        <Link
          href="/all-matchups"
          className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow transition-colors duration-200"
        >
          NFL Games
        </Link>
      </div>

      {winner ? (
        <>
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 text-blue-600 dark:text-blue-400">
            Week {winner.week} Winner
          </h1>
          <div className="bg-white/20 dark:bg-black/25 p-6 rounded-xl shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105">
            <img
              src={imageUrl}
              alt={`Winner Week ${winner.week}`}
              className="max-w-full rounded-lg shadow-lg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/images/default.png";
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

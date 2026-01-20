"use client";
import Link from "next/link";

type PreviousWinner = {
  week: number;
  winner: string;
};

const previousWinners: PreviousWinner[] = [
  { week: 20, winner: "Chuyito R - Divisinal Round" },
  { week: 19, winner: "Rios - WildCard weekend" },
  { week: 18, winner: "Carlos Comish" },
  { week: 17, winner: "Aiden" },
  { week: 16, winner: "Oso" },
  { week: 15, winner: "Candon" },
  { week: 14, winner: "Sumo" },
  { week: 13.1, winner: "Yolo" },
  { week: 13, winner: "Fay - Thanksgiving" },
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

export default function PreviousWinnersPage() {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-900">
      {/* Top Buttons */}
      <div className="flex space-x-4 mb-6">
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow transition-colors duration-200"
        >
           🏈 Pick'ems
        </Link>
        <Link
          href="/all-matchups"
          className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-green-700 shadow transition-colors duration-200"
        >
           NFL Games
        </Link>
      </div>

      <h1 className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-blue-300 via-blue-500 to-blue-700 bg-clip-text text-transparent drop-shadow-lg">
        Previous Weeks Winners
      </h1>

      <div className="w-full max-w-xl space-y-2">
        {previousWinners
          .sort((a, b) => b.week - a.week) // newest first
          .map((p, idx) => (
            <Link
              key={`pw-${p.week}-${idx}`}
              href={`/winner/${p.week}`}
              className="flex justify-between items-center p-3 rounded-md bg-white/10 dark:bg-black/20 hover:bg-white/20 dark:hover:bg-black/30 transition-all duration-200 shadow-sm cursor-pointer"
            >
              <span className="text-xl font-medium text-gray-600 dark:text-gray-300">
                Week {p.week}
              </span>
              <span className="text-xl font-bold text-green-400 dark:text-green-500">
                {p.winner.replace(/_/g, " ")}
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}

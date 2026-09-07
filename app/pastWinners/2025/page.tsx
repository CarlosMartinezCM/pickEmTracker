"use client";

import Link from "next/link";

type PreviousWinner = {
  week: number;
  winner: string;
};

const previousWinners: PreviousWinner[] = [
  { week: 20, winner: "ChuyitoR_DivisionalRound_2025" },
  { week: 19, winner: "Rios_WCW_Playoffs_2025" },
  { week: 18, winner: "CarlosComish_W18_2025" },
  { week: 17, winner: "Aiden_W17_2025" },
  { week: 16, winner: "Oso_W16_2025" },
  { week: 15, winner: "Candon_W15_2025" },
  { week: 14, winner: "Sumo_W14_2025" },
  { week: 13.1, winner: "Yolo" },
  { week: 13, winner: "Thanksgiving_Games_Fay" },
  { week: 12, winner: "Yolo_W12_2025" },
  { week: 11, winner: "Candon_W11_2025" },
  { week: 10, winner: "Javier_W10_2025" },
  { week: 9, winner: "Oso_W9_2025" },
  { week: 8, winner: "Maverick_W8_2025" },
  { week: 7, winner: "Dennis_W7_2025" },
  { week: 6, winner: "EdgarB_W6_2025" },
  { week: 5, winner: "Candon_W5_2025" },
  { week: 4, winner: "Bobby_W4_2025" },
  { week: 3, winner: "EdgarB_W3_2025" },
  { week: 2, winner: "Erick_Escobar_W2_2025" },
  { week: 1, winner: "Candon_W1_2025" },
];

export default function Winners2025Page() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-gray-900 p-6">

      {/* Navigation */}
      <div className="flex justify-center space-x-4 mb-8">

        <Link
          href="/pastWinners"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          🔙 2026 Winners
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

      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-bold text-center text-blue-600 mb-8">
        🏆 2025 Past Winners
      </h1>

      {/* Winners List */}
      <div className="w-full max-w-4xl">

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">

          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
            2025 Season Winners
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

            {previousWinners.map((winner) => (
              <Link
                key={winner.week}
                href={`/pastWinners/2025/${winner.week}`}
                className="block p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center shadow"
              >
                <div className="font-bold text-lg">
                  Week {winner.week}
                </div>

                <div className="text-sm mt-1 opacity-90">
                  {winner.winner}
                </div>
              </Link>
            ))}

          </div>

        </div>

      </div>

    </div>
  );
}
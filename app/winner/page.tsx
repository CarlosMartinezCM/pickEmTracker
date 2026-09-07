"use client";

import Link from "next/link";

export default function PastWinnersPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-gray-900 p-6">

      {/* Navigation */}
      <div className="flex justify-center space-x-4 mb-8">
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

      {/* Page Title */}
      <h1 className="text-3xl md:text-4xl font-bold text-center text-blue-600 mb-8">
        🏆 2026 Past Winners
      </h1>

      {/* Current Year */}
      <div className="w-full max-w-4xl">

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">

          <h2 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-white">
            2026 Winners
          </h2>

          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            View the winners from the 2026 NFL Pick'em season.
          </p>

          {/* 2026 Weeks */}
          <div className="flex flex-wrap justify-center gap-3">

            {Array.from({ length: 18 }, (_, i) => i + 1).map((week) => (
              <Link
                key={week}
                href={`/pastWinners/${week}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Week {week}
              </Link>
            ))}

          </div>

        </div>

        {/* Previous Years */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">

          <h2 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-white">
            📚 Previous Seasons
          </h2>

          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            Looking for winners from previous seasons?
          </p>

          <div className="flex justify-center">

            <Link
              href="/pastWinners/2025"
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold"
            >
              🏆 View 2025 Winners
            </Link>

          </div>

        </div>

      </div>

    </div>
  );
}
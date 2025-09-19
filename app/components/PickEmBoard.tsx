"use client";

import React, { useState, useMemo } from "react";

// Simple Card
const Card = ({ children, className }) => (
  <div className={`bg-white rounded-xl p-6 shadow-lg ${className}`}>{children}</div>
);

type Player = { name: string; picks: string[]; tiebreaker: number };
type Result = { [gameIndex: number]: string };

// Week 3 results (all null at start since no games played yet)
// Confirmed Week 2 results
const confirmedResults: (string | null)[] = [
  "BUF", // TNF
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , // 
  null , //Sun Night Game
  null  // Mon night Game  
];

// Week 3 Picks
const initialPlayers: Player[] = [
  { name: "Carlos(comish)", picks: ["BUF","ATL","CLE","HOU","CIN","NE","PHI","TB","IND","WAS","LAC","SEA","CHI","ARI","NYG","BAL"], tiebreaker: 54 },
  { name: "Erick Escobar", picks: ["BUF","ATL","GB","JAX","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","CHI","SF","KC","BAL"], tiebreaker: 42 },
  { name: "J El De la R", picks: ["BUF","ATL","CLE","HOU","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","DET"], tiebreaker: 50 },
  { name: "RIOS", picks: ["BUF","ATL","GB","HOU","CIN","PIT","PHI","TB","IND","LV","LAC","SEA","DAL","ARI","KC","BAL"], tiebreaker: 60 },
  { name: "Edgar B", picks: ["BUF","ATL","GB","JAX","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","CHI","SF","KC","BAL"], tiebreaker: 51 },
  { name: "YOLO", picks: ["BUF","CAR","GB","HOU","CIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","DET"], tiebreaker: 44 },
  { name: "Maverick", picks: ["BUF","CAR","GB","HOU","CIN","PIT","LAR","TB","IND","LV","LAC","SEA","CHI","SF","KC","BAL"], tiebreaker: 56 },
  { name: "Sumo", picks: ["BUF","ATL","GB","HOU","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 62 },
  { name: "Chico", picks: ["BUF","CAR","GB","HOU","MIN","PIT","LAR","NYJ","IND","WAS","LAC","SEA","DAL","ARI","KC","BAL"], tiebreaker: 48 },
  { name: "Bobby", picks: ["BUF","ATL","GB","JAX","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 47 },
  { name: "Fay", picks: ["BUF","ATL","GB","HOU","MIN","PIT","LAR","TB","TEN","LV","LAC","SEA","DAL","ARI","KC","DET"], tiebreaker: 48 },
  { name: "Eric Rodriguez", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","NYG","BAL"], tiebreaker: 65 },
  { name: "NikGo", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 41 },
  { name: "Ant", picks: ["BUF","ATL","GB","HOU","CIN","PIT","PHI","TB","IND","LV","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 49 },
  { name: "Beto", picks: ["BUF","ATL","GB","JAX","CIN","PIT","PHI","NYJ","TEN","WAS","LAC","SEA","DAL","SF","NYG","DET"], tiebreaker: 60 },
  { name: "Javier A", picks: ["BUF","CAR","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","NYG","BAL"], tiebreaker: 55 },
  { name: "Dennis", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 50 },
  { name: "Oso", picks: ["BUF","ATL","GB","HOU","MIN","PIT","PHI","TB","IND","WAS","LAC","SEA","CHI","ARI","KC","BAL"], tiebreaker: 53 },
  { name: "Ernest", picks: ["BUF","ATL","GB","JAX","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 47 },
  { name: "Danny", picks: ["BUF","ATL","GB","HOU","MIN","NE","PHI","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 59 },
  { name: "Castro", picks: ["BUF","ATL","GB","JAX","MIN","PIT","PHI","TB","IND","LV","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 55 },
  { name: "Candon", picks: ["BUF","ATL","GB","HOU","CIN","PIT","LAR","TB","IND","WAS","LAC","SEA","DAL","SF","KC","BAL"], tiebreaker: 44 }
];



// --- helper: calculate correct/wrong ---
const calculateRecord = (picks: string[], results: Result) => {
  let correct = 0, wrong = 0;
  picks.forEach((pick, idx) => {
    if (results[idx]) pick === results[idx] ? correct++ : wrong++;
  });
  return { correct, wrong };
};

export default function PickemTracker() {
  const [results, setResults] = useState<Result>(
    confirmedResults.reduce((acc, val, idx) => {
      if (val) acc[idx] = val;
      return acc;
    }, {} as Result)
  );

  const handleResultChange = (index: number, value: string) => {
    setResults({ ...results, [index]: value.toUpperCase() });
  };

  const leaderboard = useMemo(() => {
    const players = initialPlayers.map(p => ({ ...p, ...calculateRecord(p.picks, results) }));
    players.sort((a, b) => b.correct - a.correct || a.tiebreaker - b.tiebreaker);
    let rank = 1, lastCorrect: number | null = null;
    return players.map((p, idx) => {
      if (lastCorrect !== null && p.correct < lastCorrect) rank = idx + 1;
      lastCorrect = p.correct;
      return { ...p, rank };
    });
  }, [results]);

// --- SCENARIOS LOGIC ---
  /*
  // --- SCENARIOS LOGIC ---
  const scenarios = useMemo(() => {
    // Find unplayed games
    const unplayed = confirmedResults
      .map((res, i) => (res === null ? i : null))
      .filter((x): x is number => x !== null);

    if (unplayed.length === 0) return [];

    // All combinations of winners for unplayed games
    const allCombos: string[][] = [[]];
    for (let idx of unplayed) {
      const teams = Array.from(new Set(initialPlayers.map(p => p.picks[idx])));
      const newCombos: string[][] = [];
      for (let combo of allCombos) {
        for (let t of teams) newCombos.push([...combo, t]);
      }
      allCombos.splice(0, allCombos.length, ...newCombos);
    }

    // Evaluate each combo
    const playerScenarios: { [name: string]: Set<string> } = {};
    for (let combo of allCombos) {
      const tempResults = { ...results };
      combo.forEach((pick, i) => {
        tempResults[unplayed[i]] = pick;
      });

      // Calculate leaderboard for this outcome
      const outcome = initialPlayers.map(p => ({
        ...p,
        ...calculateRecord(p.picks, tempResults)
      }));
      outcome.sort((a, b) => b.correct - a.correct || a.tiebreaker - b.tiebreaker);
      const maxCorrect = outcome[0].correct;
      const leaders = outcome.filter(p => p.correct === maxCorrect);

      // Tag scenario text
      const scenarioText = unplayed.map((idx, i) => `if ${combo[i]} wins`).join(" and ");
      for (let p of leaders) {
        if (!playerScenarios[p.name]) playerScenarios[p.name] = new Set();
        playerScenarios[p.name].add(scenarioText);
      }
    }

    return Object.entries(playerScenarios).map(([name, texts]) => ({
      name,
      scenarios: Array.from(texts)
    }));
  }, [results]);
  */

  return (
    <div className="p-8 bg-gray-100 min-h-screen space-y-8">
      {/* Picks Tracker */}
      <Card>
        <h1 className="text-3xl font-bold mb-6 text-blue-800">🏈 NFL Pick'em Tracker</h1>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gradient-to-r from-blue-200 to-blue-100 sticky top-0">
              <tr>
                <th className="border p-3 text-left">Player</th>
                {Array.from({ length: 16 }).map((_, idx) => (
                  <th key={idx} className="border p-3 text-center">G{idx + 1}</th>
                ))}
                <th className="border p-3 text-center">✅ Correct</th>
                <th className="border p-3 text-center">❌ Wrong</th>
                <th className="border p-3 text-center">🎯 TieBreaker</th>
              </tr>
            </thead>
            <tbody>
              {initialPlayers.map((player, i) => {
                const record = calculateRecord(player.picks, results);
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-gray-100"}>
                    <td className="border p-3 font-semibold">{player.name}</td>
                    {player.picks.map((pick, idx) => (
                      <td
                        key={idx}
                        className={`border p-2 text-center font-medium ${
                          results[idx]
                            ? results[idx] === pick
                              ? "bg-green-200 text-green-800"
                              : "bg-red-200 text-red-800"
                            : "bg-gray-100"
                        }`}
                      >
                        {pick}
                      </td>
                    ))}
                    <td className="border p-3 text-center font-bold text-green-700">{record.correct}</td>
                    <td className="border p-3 text-center font-bold text-red-700">{record.wrong}</td>
                    <td className="border p-3 text-center font-bold">{player.tiebreaker}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Leaderboard */}
      <Card>
        <h2 className="text-3xl font-bold mb-4 text-yellow-700">🏆 Leaderboard</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 text-sm">
            <thead className="bg-gradient-to-r from-yellow-200 to-yellow-100">
              <tr>
                <th className="border p-3 text-center">Rank</th>
                <th className="border p-3 text-left">Player</th>
                <th className="border p-3 text-center">✅ Correct</th>
                <th className="border p-3 text-center">❌ Wrong</th>
                <th className="border p-3 text-center">🎯 TieBreaker</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, idx) => (
                <tr key={player.name} className={idx % 2 === 0 ? "bg-white hover:bg-gray-100" : "bg-gray-50 hover:bg-gray-100"}>
                  <td className="border p-3 text-center">{player.rank}</td>
                  <td className="border p-3 font-semibold">{player.name}</td>
                  <td className="border p-3 text-center font-bold text-green-700">{player.correct}</td>
                  <td className="border p-3 text-center font-bold text-red-700">{player.wrong}</td>
                  <td className="border p-3 text-center font-bold">{player.tiebreaker}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
   {/* Scenarios */}
    {/* add the code outside the function in the afternoon to calculate scenarios if i want.*/}
    </div>
  );
}


      // {/* Scenarios */}
      // <Card>
      //   <h2 className="text-2xl font-bold mb-4 text-purple-700">🔮 Scenarios</h2>
      //   {scenarios.length === 0 ? (
      //     <p className="text-gray-600">No scenarios left — all games decided.</p>
      //   ) : (
      //     <ul className="list-disc ml-6 space-y-2">
      //       {scenarios.map(s => (
      //         <li key={s.name}>
      //           <span className="font-semibold">{s.name}</span>:{" "}
      //           {s.scenarios.join("; ")}
      //         </li>
      //       ))}
      //     </ul>
      //   )}
      // </Card> 


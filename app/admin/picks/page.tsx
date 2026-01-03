"use client";
import { useState } from "react";

export default function PickConverterPage() {
  const [raw, setRaw] = useState("");
  const [output, setOutput] = useState("");

  function convert() {
    const lines = raw.trim().split("\n");

    const players = lines.map((line) => {
      const parts = line.split("\t").map(p => p.trim());
      const name = parts[0];
      const tiebreaker = Number(parts[parts.length - 1]);
      const picks = parts.slice(1, parts.length - 1);

      return {
        name,
        picks,
        tiebreaker,
      };
    });

    setOutput(
      players
        .map(
          (p) => `{
  name: "${p.name}",
  picks: ${JSON.stringify(p.picks)},
  tiebreaker: ${p.tiebreaker},
},`
        )
        .join("\n\n")
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">📝 Pick Converter</h1>

      <textarea
        className="w-full h-64 p-3 border rounded mb-4 font-mono"
        placeholder="Paste raw picks here..."
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />

      <button
        onClick={convert}
        className="px-6 py-2 bg-blue-600 text-white rounded font-bold mb-4"
      >
        Convert
      </button>

      <textarea
        className="w-full h-64 p-3 border rounded font-mono"
        placeholder="Formatted output..."
        value={output}
        readOnly
      />
    </div>
  );
}

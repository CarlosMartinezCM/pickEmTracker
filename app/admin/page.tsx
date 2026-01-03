"use client";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen p-6 bg-gray-100 dark:bg-gray-900">
      <h1 className="text-4xl font-bold mb-6 text-blue-600">🏈 Admin Portal</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <AdminLink href="/admin/picks" label="📝 Pick Converter" />
        <AdminLink href="/admin/schedule" label="📅 Schedule Manager" />
        <AdminLink href="/admin/results" label="🏆 Upload Results" />
        <AdminLink href="/admin/players" label="👥 Player Manager" />
      </div>
    </div>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="p-5 rounded-xl bg-white dark:bg-black/30 shadow hover:shadow-lg transition font-bold text-lg"
    >
      {label}
    </Link>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-gray-600">
          Cross-reference luminaire schedules against your line card.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/projects/new"
          className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <div className="text-3xl">+</div>
          <div className="mt-2 font-medium">New Project</div>
          <div className="mt-1 text-sm text-gray-500">Upload a luminaire schedule</div>
        </Link>

        <Link
          href="/products/import"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow transition-shadow"
        >
          <div className="text-3xl">📦</div>
          <div className="mt-2 font-medium">Import Products</div>
          <div className="mt-1 text-sm text-gray-500">Add products to your catalog</div>
        </Link>

        <Link
          href="/line-card"
          className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow transition-shadow"
        >
          <div className="text-3xl">📋</div>
          <div className="mt-2 font-medium">Manage Line Card</div>
          <div className="mt-1 text-sm text-gray-500">Configure your represented manufacturers</div>
        </Link>
      </div>
    </div>
  );
}

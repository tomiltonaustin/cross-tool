"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Product, Manufacturer } from "@/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<(Product & { manufacturer: Manufacturer })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("products")
      .select("*, manufacturer:manufacturers(*)")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setProducts((data as typeof products) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="mt-1 text-gray-600">{products.length} products</p>
        </div>
        <Link
          href="/products/import"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Import Products
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No products yet.</p>
          <Link href="/products/import" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Import your first products
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Mounting</th>
                <th className="px-4 py-3">Lumens</th>
                <th className="px-4 py-3">CCT</th>
                <th className="px-4 py-3">Wattage</th>
                <th className="px-4 py-3">CRI</th>
                <th className="px-4 py-3">Voltage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.manufacturer?.name ?? "—"}</td>
                  <td className="px-4 py-2">{p.model_number}</td>
                  <td className="px-4 py-2">{p.mounting_type ?? "—"}</td>
                  <td className="px-4 py-2">{p.lumens ?? "—"}</td>
                  <td className="px-4 py-2">{p.cct ? `${p.cct}K` : "—"}</td>
                  <td className="px-4 py-2">{p.wattage ? `${p.wattage}W` : "—"}</td>
                  <td className="px-4 py-2">{p.cri ?? "—"}</td>
                  <td className="px-4 py-2">{p.voltage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

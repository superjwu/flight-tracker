import type { Metadata } from "next";
import FavoritesClient from "@/components/FavoritesClient";

export const metadata: Metadata = { title: "Favorites · Flight Tracker" };

export default function FavoritesPage() {
  return <FavoritesClient />;
}

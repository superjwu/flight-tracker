import type { Metadata } from "next";
import MapShell from "@/components/MapShell";

export const metadata: Metadata = {
  title: "Live Map · Flight Tracker",
};

export default function MapPage() {
  return <MapShell />;
}

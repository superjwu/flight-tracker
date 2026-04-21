import type { Metadata } from "next";
import AlertsClient from "@/components/AlertsClient";

export const metadata: Metadata = { title: "Alerts · Flight Tracker" };

export default function AlertsPage() {
  return <AlertsClient />;
}

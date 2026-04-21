import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { FavoritesProvider } from "@/lib/favorites-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flight Tracker — live aircraft worldwide",
  description:
    "Live global flight tracking. Watch every plane in the sky in real time, filter by region, favorite callsigns and airlines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#22d3ee",
          colorBackground: "#0b0f16",
          colorInputBackground: "#111723",
          colorInputText: "#e6edf5",
          colorText: "#e6edf5",
          colorTextSecondary: "#7a8798",
          borderRadius: "8px",
        },
      }}
    >
      <html lang="en" className="dark">
        <body>
          <FavoritesProvider>{children}</FavoritesProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

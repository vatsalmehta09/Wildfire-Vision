// components/fire-map.tsx

'use client';

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";

const MapInner = dynamic(() => import("./map-inner"), { ssr: false });

/**
 * Represents a fire hotspot location with radiative power.
 */
interface FireLocation {
  /** Latitude of the fire detection. */
  latitude: number;
  /** Longitude of the fire detection. */
  longitude: number;
  /** Fire Radiative Power (MW). */
  frp: number;
}

/**
 * A wrapper component for the Leaflet map that safely handles SSR by
 * dynamically loading the map inner component on the client side only.
 *
 * @param props - Component props including title and an array of fire locations.
 * @returns JSX element containing the Leaflet map card.
 *
 * @example
 * ```tsx
 * <FireMap title="Active Fires" locations={[{ latitude: 20, longitude: 80, frp: 150 }]} />
 * ```
 */
export function FireMap({
  title,
  locations,
}: {
  /** The title displayed above the map card. */
  title: string;
  /** An array of geographic fire points to plot. */
  locations: FireLocation[];
}) {
  if (!locations || locations.length === 0) {
    return (
      <Card className="bg-card border-border p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-muted-foreground text-center py-16">
          No fire locations to display
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border p-6 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      <div className="w-full h-[600px] rounded-md overflow-hidden border border-border">
        <MapInner locations={locations} />
      </div>
    </Card>
  );
}

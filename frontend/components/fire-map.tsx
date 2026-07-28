// components/fire-map.tsx

'use client';

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";

const MapInner = dynamic(() => import("./map-inner"), { ssr: false });

interface FireLocation {
  latitude: number;
  longitude: number;
  frp: number;
}

export function FireMap({
  title,
  locations,
}: {
  title: string;
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

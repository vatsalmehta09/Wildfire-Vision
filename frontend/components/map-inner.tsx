// components/map-inner.tsx

'use client';

import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

/**
 * A helper component that hooks into the Leaflet map instance and invalidates
 * its size after mounting to prevent tile misalignment or partial rendering.
 *
 * @returns null - this component does not render any visible UI.
 */
function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200); // short delay ensures container is fully mounted
  }, [map]);
  return null;
}

/**
 * Represents a single fire detection point to be plotted on the map.
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
 * The internal Leaflet map component.
 * Must be dynamically imported with SSR disabled since Leaflet relies on the browser's `window` object.
 *
 * @param props - Component properties.
 * @param props.locations - Array of fire hotspot data points to render as circle markers.
 * @param props.height - The height of the map container in pixels (default: 700).
 * @returns JSX element containing the Leaflet map.
 */
export default function MapInner({
  locations,
  height = 700,
}: {
  /** Array of geographic fire points to plot. */
  locations: FireLocation[];
  /** Height of the map container in pixels. */
  height?: number;
}) {
  const center: [number, number] = [
    locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
    locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
  ];

  // const getFRPColor = (frp: number) => {
  //   if (frp >= 200) return "#ff4444";
  //   if (frp >= 100) return "#ff8844";
  //   if (frp >= 50) return "#ffaa44";
  //   return "#ffdd44";
  // };

  const getFRPColor = (frp: number) => {
    if (frp >= 40) return "#ff3333";     // high
    if (frp >= 25) return "#ff6633";     // medium
    if (frp >= 10) return "#ffbb33";     // low
    return "#ffee55";                    // very low
  };

  // const getMarkerSize = (frp: number) => Math.max(6, Math.min(20, frp / 10));

  const getMarkerSize = (frp: number) => {
    return Math.max(8, Math.sqrt(frp) * 2); 
  };

  return (
    <MapContainer
      center={center}
      zoom={5}
      scrollWheelZoom
      style={{ width: "100%", height }}
      preferCanvas={true}
    >
      <ResizeFix />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {locations.map((loc, idx) => (
        <CircleMarker
          key={idx}
          center={[loc.latitude, loc.longitude]}
          radius={getMarkerSize(loc.frp)}
          pathOptions={{
            color: getFRPColor(loc.frp),
            fillColor: getFRPColor(loc.frp),
            fillOpacity: 0.7,
          }}
        >
          <Tooltip direction="top">
            <div>
              FRP: {loc.frp.toFixed(1)} <br />
              Lat: {loc.latitude.toFixed(2)} <br />
              Lon: {loc.longitude.toFixed(2)}
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

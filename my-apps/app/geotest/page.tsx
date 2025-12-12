"use client";

import { useEffect, useState } from "react";

export default function GeoTestPage() {
  const [msg, setMsg] = useState("Waiting for GPS...");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setMsg("No geolocation API");
      return;
    }

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMsg(`Lat: ${latitude}, Lng: ${longitude}`);
      },
      (err) => {
        setMsg(`TEST GPS error code=${err.code} msg=${err.message}`);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15000,
        timeout: 30000,
      }
    );
  }, []);

  return <div>{msg}</div>;
}

export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

export async function getCurrentPosition(options?: PositionOptions): Promise<GeoFix> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation not supported on this device");
  }
  return new Promise<GeoFix>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
      }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access."
            : err.code === err.POSITION_UNAVAILABLE
            ? "Location unavailable. Check GPS/network signal."
            : err.code === err.TIMEOUT
            ? "Location request timed out. Try again."
            : err.message || "Failed to get location";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000, ...options },
    );
  });
}

export function fmtLatLng(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return null;
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function gmapsUrl(lat: number | null | undefined, lng: number | null | undefined) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

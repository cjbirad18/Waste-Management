// CommonJS version - avoids module type warnings and external dotenv dependency
const { createClient } = require("@supabase/supabase-js");
// turf helpers for reliable polygon checks
let booleanPointInPolygon = require("@turf/boolean-point-in-polygon");
if (booleanPointInPolygon && booleanPointInPolygon.default) {
  booleanPointInPolygon = booleanPointInPolygon.default;
}
const { point } = require("@turf/helpers");
const fs = require("fs");

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const barangaysGeo = JSON.parse(
  fs.readFileSync("my-apps/public/data/barangays.geojson", "utf-8"),
);

// wrapper around Turf's reliable point-in-polygon check
function pointInPoly(pt, feat) {
  // turf expects [lng, lat]
  return booleanPointInPolygon(point([pt.lng, pt.lat]), feat);
}

// pick a polygon object by name (case-insensitive substring match)
function findBarangayPolygon(name) {
  const features = barangaysGeo.features || [];
  name = name.toLowerCase();
  for (const feat of features) {
    const props = feat.properties || {};
    const bname = (props.NAME_3 || props.name || "").toLowerCase();
    if (!bname) continue;
    if (bname.includes(name) || name.includes(bname)) return feat;
  }
  return null;
}

// generate random point inside a GeoJSON feature by sampling its bounding box
// and verifying with pointInPoly; retries up to maxAttempts
function randomPointInPolygon(feat, maxAttempts = 500) {
  const coords = feat.geometry.coordinates;
  // recursively walk coordinates to determine bbox (handles Polygon/MultiPolygon)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  function walk(c) {
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      const [x, y] = c;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else {
      for (const sub of c) walk(sub);
    }
  }
  walk(coords);

  for (let i = 0; i < maxAttempts; i++) {
    const lng = minX + Math.random() * (maxX - minX);
    const lat = minY + Math.random() * (maxY - minY);
    if (pointInPoly({ lat, lng }, feat)) {
      return { lat, lng };
    }
  }
  // fallback to centroid
  return { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 };
}

// build a path consisting of `steps` random points inside the given polygon
function buildRandomPath(feat, steps = 20) {
  const path = [];
  for (let i = 0; i < steps; i++) {
    path.push(randomPointInPolygon(feat));
  }
  return path;
}

//----------------------------------------------------------------------

// the original hardcoded single route is no longer used; we will create
// a path per truck dynamically.

// helper to pause between updates
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// helper: move point "current" towards "target" by at most maxStep
function stepTowards(current, target, maxStep) {
  const latDiff = target.lat - current.lat;
  const lngDiff = target.lng - current.lng;
  const dist = Math.hypot(latDiff, lngDiff);
  if (dist === 0) return { ...current };
  const factor = Math.min(maxStep / dist, 1);
  return {
    lat: current.lat + latDiff * factor,
    lng: current.lng + lngDiff * factor,
  };
}

// drive a single truck forever using a random-walk steering model.  The
// vehicle maintains a heading and makes small random turns; this produces a
// very smooth, continuous movement that looks like a truck following streets.
async function driveTruck(truck_id, feat) {
  // starting position
  let pos = randomPointInPolygon(feat);

  // time step and speed (≈15 km/h)
  const tick = 1000;
  const speed = 0.000038;

  // steering parameters
  let angle = Math.random() * 2 * Math.PI;
  let steerCounter = 0;
  const steerInterval = 10;
  const maxTurn = Math.PI / 8;

  // pause simulation every so often
  let pauseCounter = 0;
  const pauseInterval = 30;
  const pauseDuration = 5;

  while (true) {
    if (++pauseCounter >= pauseInterval) {
      await sleep(pauseDuration * tick);
      pauseCounter = 0;
    }

    if (++steerCounter >= steerInterval) {
      angle += (Math.random() - 0.5) * maxTurn;
      steerCounter = 0;
    }

    // compute candidate next position; if it's outside, adjust heading
    let next;
    let tries = 0;
    do {
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      next = { lat: pos.lat + dy, lng: pos.lng + dx };
      if (pointInPoly(next, feat)) break;
      // rotate heading slightly and try again
      angle += (Math.random() - 0.5) * (Math.PI / 4);
      tries++;
    } while (tries < 8);
    if (!pointInPoly(next, feat)) {
      // give up and pick a completely new random valid direction
      angle = Math.random() * 2 * Math.PI;
      continue;
    }
    pos = next;

    const { error } = await supabase
      .from("truck_live_location")
      .upsert(
        { truck_id, latitude: pos.lat, longitude: pos.lng },
        { onConflict: "truck_id" },
      );

    if (error) {
      console.error(`truck ${truck_id} upsert failed`, error);
      await sleep(2000);
      continue;
    }

    console.log(
      `truck ${truck_id} -> ${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`,
    );
    await sleep(tick);
  }
}

// entry point: look up all trucks in the database and start each one in its barangay
async function run() {
  const { data: trucks, error } = await supabase
    .from("garbage_trucks")
    .select("truck_id,truck_code");
  if (error) {
    console.error("failed to load trucks", error);
    return;
  }
  if (!trucks || trucks.length === 0) {
    console.warn("no trucks found");
    return;
  }
  for (const t of trucks) {
    // resolve the barangay polygon from the truck_code; if it fails warn
    let feat = null;
    let assignedName = null;
    if (t.truck_code) {
      feat = findBarangayPolygon(t.truck_code);
      if (feat) {
        const props = feat.properties || {};
        assignedName = props.NAME_3 || props.name || "<unknown>";
      }
    }

    if (!feat) {
      console.warn(
        `truck ${t.truck_id} (${t.truck_code}) has no matching barangay polygon; ` +
          "assigning random one",
      );
      const all = barangaysGeo.features || [];
      feat = all[Math.floor(Math.random() * all.length)];
      const props = feat.properties || {};
      assignedName = props.NAME_3 || props.name || "<random>";
    }

    console.log(
      `truck ${t.truck_id} will run inside barangay: ${assignedName}`,
    );
    driveTruck(t.truck_id, feat).catch((e) =>
      console.error("driveTruck error", e),
    );
  }
}

run().catch(console.error);

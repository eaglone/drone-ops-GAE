importScripts(
    "https://unpkg.com/@turf/turf@6/turf.min.js"
);

self.onmessage = e => {

    const geojson = e.data;

    console.log("Worker: simplification...");

    const simplified = turf.simplify(geojson, {
        tolerance: 0.0001,
        highQuality: false
    });

    self.postMessage(simplified);
};

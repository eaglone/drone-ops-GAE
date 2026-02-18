/**
 * DGACZONES.JS — DGAC France entière optimisé
 * - pagination WFS
 * - cache IndexedDB
 * - worker simplification
 * - chargement progressif
 */

let dgacLayer = null;
let selectedLayer = null;

const WFS_URL = "https://data.geopf.fr/wfs/ows";
const TYPE_NAME = "TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf";
const PAGE_SIZE = 5000;


// ================= STREAM WFS =================

async function fetchAllDGACFeaturesProgressive(onBatch) {

    let startIndex = 0;
    let all = [];

    while (true) {

        console.log("📡 WFS batch", startIndex);

        const url = `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typeName=${TYPE_NAME}&outputFormat=application/json&srsName=EPSG:4326&count=${PAGE_SIZE}&startIndex=${startIndex}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur WFS");

        const data = await res.json();
        if (!data.features?.length) break;

        all = all.concat(data.features);

        onBatch({
            type: "FeatureCollection",
            features: data.features
        });

        if (data.features.length < PAGE_SIZE) break;

        startIndex += PAGE_SIZE;
    }

    console.log("✅ Total DGAC:", all.length);

    return {
        type: "FeatureCollection",
        features: all
    };
}


// ================= STYLE =================

function dgacStyle(feature) {
    const p = feature.properties || {};
    const alt = p.limite_alti ?? p.hauteur_max ?? 0;

    return {
        color: alt === 0 ? "#ff0000" : "#ff9800",
        fillColor: alt === 0 ? "#ff0000" : "#ff9800",
        weight: 2,
        fillOpacity: 0.3
    };
}


// ================= CLICK =================

function onEachDGACFeature(feature, layer) {

    const p = feature.properties || {};

    const altitude =
        p.limite_alti ??
        p.hauteur_max ??
        p.altitude_max ??
        "Non renseignée";

    const zoneName =
        p.nom ??
        p.nom_zone ??
        p.designation ??
        "Non renseignée";

    const statut =
        altitude === 0
            ? "🚫 VOL INTERDIT"
            : `✅ Autorisé jusqu’à ${altitude} m`;

    const defaultStyle = dgacStyle(feature);

    layer.on("click", e => {

        if (selectedLayer) {
            selectedLayer.setStyle(defaultStyle);
        }

        selectedLayer = layer;
        layer.setStyle({ weight: 4, fillOpacity: 0.6 });

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
<b>RESTRICTION DRONE DGAC</b><hr>
<b>Statut :</b> ${statut}<br>
<b>Zone :</b> ${zoneName}<br>
<b>Altitude :</b> ${altitude} m AGL<br>
<small>IGN / DGAC</small>
`)
            .openOn(window.map);
    });
}


// ================= LOAD DGAC =================

async function loadDGACZones() {

    if (dgacLayer) return dgacLayer;

    if (!window.map) {
        console.error("Map non initialisée");
        return null;
    }

    console.log("🛰️ Initialisation DGAC optimisé...");

    dgacLayer = L.geoJSON(null, {
        pane: "zonesPane",
        style: dgacStyle,
        onEachFeature: onEachDGACFeature,
        interactive: true
    });

    // CACHE FIRST
    const cached = await window.loadDGAC?.();

    if (cached) {
        console.log("⚡ DGAC depuis cache");
        dgacLayer.addData(cached);
        return dgacLayer;
    }

    // WORKER
    const worker = new Worker("app/dgacWorkers.js");

    worker.onmessage = e => {
        dgacLayer.addData(e.data);
        window.saveDGAC?.(e.data);
    };

    // STREAM WFS
    await fetchAllDGACFeaturesProgressive(batch => {
        worker.postMessage(batch);
    });

    return dgacLayer; // 🔥 manquait logique avant
}


// ================= LAYER CONTROL =================

async function addDGACToLayerControl() {

    const layer = await loadDGACZones();
    if (!layer) return;

    if (!window.overlayMaps) window.overlayMaps = {};

    window.overlayMaps["Restrictions DGAC (France)"] = layer;

    if (!window.layerControl) {
        window.layerControl = L.control.layers(
            window.baseMaps || {},
            window.overlayMaps
        ).addTo(window.map);
    } else {
        window.layerControl.addOverlay(layer, "Restrictions DGAC (France)");
    }
}


// ================= EXPORT GLOBAL =================

window.loadDGACZones = loadDGACZones;
window.addDGACToLayerControl = addDGACToLayerControl;

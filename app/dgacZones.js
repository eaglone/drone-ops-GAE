/**
 * DGACZONES.JS — DGAC dynamique autour de la carte
 * - chargement bbox carte
 * - mise à jour automatique
 * - clic zone
 */

let dgacLayer = null;
let selectedLayer = null;

const WFS_URL = "https://data.geopf.fr/wfs/ows";
const TYPE_NAME = "TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf";


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

    layer.on("click", e => {

        if (selectedLayer) {
            selectedLayer.setStyle(dgacStyle(selectedLayer.feature));
        }

        selectedLayer = layer;
        layer.setStyle({ weight: 4, fillOpacity: 0.6 });

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
<b>RESTRICTION DRONE DGAC</b><hr>
<b>Statut :</b> ${statut}<br>
<b>Zone :</b> ${zoneName}<br>
<b>Altitude :</b> ${altitude} m AGL
`)
            .openOn(window.map);
    });
}


// ================= LOAD BBOX =================

async function loadDGACForBounds() {

    if (!window.map || !dgacLayer) return;

    const bounds = window.map.getBounds();

    const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
    ].join(",");

    console.log("📦 DGAC bbox:", bbox);

    try {

        const url =
            `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature` +
            `&typeName=${TYPE_NAME}` +
            `&outputFormat=application/json` +
            `&srsName=EPSG:4326` +
            `&bbox=${bbox},EPSG:4326`;

        const res = await fetch(url);
        const data = await res.json();

        dgacLayer.clearLayers();
        dgacLayer.addData(data);

    } catch (err) {
        console.warn("DGAC bbox error", err);
    }
}


// ================= INIT DGAC =================

async function loadDGACZones() {

    if (dgacLayer) return dgacLayer;
    if (!window.map) return null;

    console.log("🛰️ Initialisation DGAC dynamique...");

    dgacLayer = L.geoJSON(null, {
        pane: "zonesPane",
        style: dgacStyle,
        onEachFeature: onEachDGACFeature,
        interactive: true
    });

    // recharge quand la carte bouge
    window.map.on("moveend", loadDGACForBounds);

    // premier chargement
    await loadDGACForBounds();

    return dgacLayer;
}


// ================= EXPORT =================

window.loadDGACZones = loadDGACZones;

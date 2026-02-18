/**
 * DGACZONES.JS — DGAC France entière via WFS IGN
 * - pagination WFS
 * - toutes les zones France
 * - clic info
 * - highlight
 */

let dgacLayer = null;
let selectedLayer = null;

const WFS_URL = "https://data.geopf.fr/wfs/ows";
const TYPE_NAME = "TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf";
const PAGE_SIZE = 5000;

/**
 * Récupère toutes les features WFS (pagination IGN)
 */
async function fetchAllDGACFeatures() {

    let startIndex = 0;
    let allFeatures = [];

    while (true) {

        console.log("📡 WFS batch", startIndex);

        const url = `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typeName=${TYPE_NAME}&outputFormat=application/json&srsName=EPSG:4326&count=${PAGE_SIZE}&startIndex=${startIndex}`;

        const res = await fetch(url);

        if (!res.ok) throw new Error("Erreur WFS");

        const data = await res.json();

        if (!data.features || data.features.length === 0) break;

        allFeatures = allFeatures.concat(data.features);

        if (data.features.length < PAGE_SIZE) break;

        startIndex += PAGE_SIZE;
    }

    console.log("✅ Total DGAC:", allFeatures.length);

    return {
        type: "FeatureCollection",
        features: allFeatures
    };
}

/**
 * Charge couche DGAC
 */
async function loadDGACZones() {

    if (dgacLayer) return dgacLayer;

    if (!window.map) {
        console.error("Map non initialisée");
        return null;
    }

    try {

        console.log("🛰️ Chargement DGAC France entière...");

        const geojson = await fetchAllDGACFeatures();

        dgacLayer = L.geoJSON(geojson, {

            pane: "zonesPane",

            style(feature) {
                const p = feature.properties || {};
                const alt = p.limite_alti ?? p.hauteur_max ?? 0;

                return {
                    color: alt === 0 ? "#ff0000" : "#ff9800",
                    fillColor: alt === 0 ? "#ff0000" : "#ff9800",
                    weight: 2,
                    fillOpacity: 0.3
                };
            },

            onEachFeature(feature, layer) {

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

                const defaultStyle = layer.options.style(feature);

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
        });

        console.log("✅ Couche DGAC prête");

        return dgacLayer;

    } catch (err) {
        console.error("❌ DGAC error:", err);
        return null;
    }
}

/**
 * Layer control
 */
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

window.loadDGACZones = loadDGACZones;
window.addDGACToLayerControl = addDGACToLayerControl;

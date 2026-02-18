/**
 * DGACZONES.JS — Restrictions drones via WFS GeoPlateforme (vecteur live)
 */

let dgacLayer = null;

async function loadDGACZones() {
    if (dgacLayer) return dgacLayer;

    if (!window.map) {
        console.error("Map non initialisée");
        return null;
    }

    try {
        console.log("🛰️ Chargement WFS DGAC...");

        // bbox de la carte (optimise perf)
        const bounds = window.map.getBounds();
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(",");

        const url = `
https://data.geopf.fr/wfs/ows
?service=WFS
&version=2.0.0
&request=GetFeature
&typeName=TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf
&outputFormat=application/json
&srsName=EPSG:4326
&bbox=${bbox},EPSG:4326
`.replace(/\s+/g, "");

        const response = await fetch(url);
        const geojson = await response.json();

        dgacLayer = L.geoJSON(geojson, {
            pane: "zonesPane",

            style(feature) {
                const alt = feature.properties?.limite_alti ?? 0;

                return {
                    color: alt === 0 ? "#ff0000" : "#ff9800",
                    fillColor: alt === 0 ? "#ff0000" : "#ff9800",
                    weight: 2,
                    fillOpacity: 0.3
                };
            },

            onEachFeature(feature, layer) {
                const p = feature.properties || {};

                layer.bindPopup(`
                    <b>Restriction UAS</b><br>
                    Zone : ${p.nom || "?"}<br>
                    Altitude max : ${p.limite_alti ?? "?"} m
                `);
            }
        });

        console.log("✅ WFS DGAC chargé");
        return dgacLayer;

    } catch (err) {
        console.error("❌ Erreur WFS DGAC", err);
        return null;
    }
}

/**
 * Ajoute au layerControl
 */
async function addDGACToLayerControl() {
    const layer = await loadDGACZones();
    if (!layer) return;

    if (!window.overlayMaps) window.overlayMaps = {};

    window.overlayMaps["Zones DGAC (WFS)"] = layer;

    if (!window.layerControl) {
        window.layerControl = L.control.layers(
            window.baseMaps || {},
            window.overlayMaps
        ).addTo(window.map);
    } else {
        window.layerControl.addOverlay(layer, "Zones DGAC (WFS)");
    }
}

window.loadDGACZones = loadDGACZones;
window.addDGACToLayerControl = addDGACToLayerControl;

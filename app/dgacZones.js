/**
 * DGACZONES.JS — Restrictions drones via WFS GeoPlateforme (vecteur live)
 */

let dgacLayer = null;
let selectedLayer = null;

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
        if (!response.ok) throw new Error("Erreur réseau WFS");

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

                const defaultStyle = {
                    color: p.limite_alti === 0 ? "#ff0000" : "#ff9800",
                    fillColor: p.limite_alti === 0 ? "#ff0000" : "#ff9800",
                    weight: 2,
                    fillOpacity: 0.3
                };

                const selectedStyle = {
                    weight: 4,
                    fillOpacity: 0.5
                };

                // clic zone
                layer.on("click", function (e) {

                    // reset ancienne sélection
                    if (selectedLayer) {
                        selectedLayer.setStyle(defaultStyle);
                    }

                    // nouvelle sélection
                    selectedLayer = layer;
                    layer.setStyle(selectedStyle);

                    const popupContent = `
                        <div style="font-family:Inter,sans-serif;min-width:200px">
                            <strong style="color:#ef4444">
                                RESTRICTION DRONE DGAC
                            </strong>
                            <hr>

                            <b>Zone :</b> ${p.nom || "Non renseigné"}<br>

                            <b>Altitude max :</b>
                            ${p.limite_alti ?? "?"} m AGL<br>

                            <b>Type :</b>
                            ${p.nature || "Non précisé"}<br>

                            <b>Identifiant :</b>
                            ${p.id || "—"}<br>

                            <hr>
                            <small>Source : IGN / DGAC</small>
                        </div>
                    `;

                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(popupContent)
                        .openOn(window.map);
                });
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

/**
 * DGACZONES.JS — Affichage restrictions drones via WMS GeoPlateforme
 * Source IGN / DGAC (live)
 */

let dgacLayer = null;

/**
 * Charge la couche DGAC depuis le WMS GeoPlateforme
 */
async function loadDGACZones() {
    if (dgacLayer) return dgacLayer;

    if (!window.map) {
        console.error("Map non initialisée");
        return null;
    }

    try {
        console.log("🛰️ Chargement WMS DGAC...");

        dgacLayer = L.tileLayer.wms(
            "https://data.geopf.fr/wms-r",
            {
                layers: "TRANSPORTS.DRONES.RESTRICTIONS",
                format: "image/png",
                transparent: true,
                version: "1.3.0",
                attribution: "DGAC / IGN Géoplateforme",
                pane: "zonesPane",
                opacity: 0.7
            }
        );

        console.log("✅ Couche DGAC WMS prête");
        return dgacLayer;

    } catch (error) {
        console.error("❌ Erreur WMS DGAC :", error);
        return null;
    }
}

/**
 * Ajoute la couche au contrôle checkbox
 */
async function addDGACToLayerControl() {
    const layer = await loadDGACZones();
    if (!layer) return;

    if (!window.overlayMaps) window.overlayMaps = {};

    window.overlayMaps["Zones DGAC (UAS)"] = layer;

    if (!window.layerControl) {
        window.layerControl = L.control.layers(
            window.baseMaps || {},
            window.overlayMaps,
            { collapsed: false }
        ).addTo(window.map);
    } else {
        window.layerControl.addOverlay(layer, "Zones DGAC (UAS)");
    }
}

window.loadDGACZones = loadDGACZones;
window.addDGACToLayerControl = addDGACToLayerControl;

/**
 * DGACZONES.JS — Restrictions drones DGAC France entière via WFS IGN
 * - Chargement national
 * - Clic zone → info
 * - Highlight sélection
 * - Popup robuste (compatible IGN)
 */

let dgacLayer = null;
let selectedLayer = null;

/**
 * Charge toutes les zones DGAC France entière
 */
async function loadDGACZones() {

    if (dgacLayer) return dgacLayer;

    if (!window.map) {
        console.error("Map non initialisée");
        return null;
    }

    try {
        console.log("🛰️ Chargement DGAC France entière (WFS IGN)...");

        // ⚠️ France entière → pas de bbox
        const url = `
https://data.geopf.fr/wfs/ows
?service=WFS
&version=2.0.0
&request=GetFeature
&typeName=TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf
&outputFormat=application/json
&srsName=EPSG:4326
`.replace(/\s+/g, "");

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Erreur réseau WFS");
        }

        const geojson = await response.json();

        console.log("✅ Données DGAC reçues :", geojson.features.length, "zones");

        dgacLayer = L.geoJSON(geojson, {
            pane: "zonesPane",

            style(feature) {
                const p = feature.properties || {};
                const altitude =
                    p.limite_alti ??
                    p.hauteur_max ??
                    p.altitude_max ??
                    p.alt_max ??
                    0;

                return {
                    color: altitude === 0 ? "#ff0000" : "#ff9800",
                    fillColor: altitude === 0 ? "#ff0000" : "#ff9800",
                    weight: 2,
                    fillOpacity: 0.3
                };
            },

            onEachFeature(feature, layer) {

                const p = feature.properties || {};

                // valeurs robustes IGN
                const altitude =
                    p.limite_alti ??
                    p.hauteur_max ??
                    p.altitude_max ??
                    p.alt_max ??
                    "Non renseignée";

                const zoneName =
                    p.nom ??
                    p.nom_zone ??
                    p.designation ??
                    p.libelle ??
                    "Non renseignée";

                const typeZone =
                    p.nature ??
                    p.type ??
                    p.type_zone ??
                    "Non précisé";

                const identifiant =
                    p.id ??
                    p.identifiant ??
                    p.objectid ??
                    "—";

                const statut =
                    altitude === 0
                        ? "🚫 VOL INTERDIT"
                        : `✅ Autorisé jusqu’à ${altitude} m`;

                const defaultStyle = layer.options.style(feature);

                const selectedStyle = {
                    weight: 4,
                    fillOpacity: 0.6
                };

                // clic zone
                layer.on("click", function(e) {

                    // reset ancienne sélection
                    if (selectedLayer) {
                        selectedLayer.setStyle(defaultStyle);
                    }

                    selectedLayer = layer;
                    layer.setStyle(selectedStyle);

                    const popupContent = `
<div style="font-family:Inter,sans-serif;min-width:220px">
<strong style="color:#ef4444">RESTRICTION DRONE DGAC</strong>
<hr>

<b>Statut :</b> ${statut}<br>
<b>Zone :</b> ${zoneName}<br>
<b>Altitude max :</b> ${altitude} m AGL<br>
<b>Type :</b> ${typeZone}<br>
<b>Identifiant :</b> ${identifiant}<br>

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

        console.log("✅ Couche DGAC prête");

        return dgacLayer;

    } catch (err) {
        console.error("❌ Erreur DGAC WFS :", err);
        return null;
    }
}


/**
 * Ajoute la couche au contrôle (checkbox)
 */
async function addDGACToLayerControl() {

    const layer = await loadDGACZones();
    if (!layer) return;

    if (!window.overlayMaps) window.overlayMaps = {};

    window.overlayMaps["Restrictions DGAC (France)"] = layer;

    if (!window.layerControl) {
        window.layerControl = L.control.layers(
            window.baseMaps || {},
            window.overlayMaps,
            { collapsed: false }
        ).addTo(window.map);
    } else {
        window.layerControl.addOverlay(layer, "Restrictions DGAC (France)");
    }
}

window.loadDGACZones = loadDGACZones;
window.addDGACToLayerControl = addDGACToLayerControl;

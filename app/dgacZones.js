/**
 * DGACZONES.JS — Gestion des restrictions UAS (Geoportail / DGAC)
 * Permet l'affichage des zones de restriction pour drones
 */

let dgacLayer = null;

/**
 * Charge les données GeoJSON et prépare la couche Leaflet
 * @returns {Promise<L.GeoJSON>} La couche prête à être ajoutée au contrôle de couches
 */
async function loadDGACZones() {
    // Si la couche est déjà initialisée, on la retourne simplement
    if (dgacLayer) return dgacLayer;

    if (!window.map) {
        console.error("Map non initialisée");
        return null;
    }

    try {
        console.log("🛰️ Chargement des zones DGAC...");

        // Utilise la fonction cachedFetch définie dans cache.js
        // Assurez-vous que le fichier zones_drones.geojson est à la racine
        const geojson = await cachedFetch(
            "dgac_zones",
            "zones_drones.geojson"
        );

        dgacLayer = L.geoJSON(geojson, {
            // Utilise le pane défini dans map.js pour passer au-dessus du fond de carte
            pane: "zonesPane",
            
            style: function(feature) {
                // Logique de couleur basée sur la propriété 'limite_alti' (standard DGAC)
                // 0 = Interdit (Rouge), > 0 = Limité (Orange)
                const altitudeMax = feature.properties.limite_alti;
                
                return {
                    color: altitudeMax === 0 ? "#ff0000" : "#ff9800",
                    fillColor: altitudeMax === 0 ? "#ff0000" : "#ff9800",
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.3
                };
            },
            
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                const popupContent = `
                    <div style="font-family: 'Inter', sans-serif; padding: 5px;">
                        <strong style="color: #ef4444; display: block; border-bottom: 1px solid #eee; margin-bottom: 5px;">
                            RESTRICTION UAS
                        </strong>
                        <b>Zone :</b> ${props.nom || "Non répertoriée"}<br>
                        <b>Hauteur Max :</b> ${props.limite_alti}m AGL<br>
                        <small style="color: #666;">Source : DGAC / Géoplateforme</small>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        });

        console.log("✅ Couche DGAC créée avec succès");
        return dgacLayer;

    } catch (error) {
        console.error("❌ Erreur lors du chargement des zones DGAC :", error);
        return null;
    }
}

// Rend la fonction accessible globalement
window.loadDGACZones = loadDGACZones;

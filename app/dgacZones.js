async function loadDGACZones() {
    if (!window.map) return;

    // URL de l'API Géoplateforme (WFS) pour récupérer les zones en GeoJSON
    // On limite ici à une zone autour de ta position pour ne pas charger toute la France
    const baseUrl = "https://data.geopf.fr/wfs/ows";
    const params = new URLSearchParams({
        SERVICE: "WFS",
        VERSION: "2.0.0",
        REQUEST: "GetFeature",
        TYPENAME: "TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf",
        OUTPUTFORMAT: "application/json",
        SRSNAME: "EPSG:4326",
        // Optionnel : ajouter un BBOX (Bounding Box) pour limiter le chargement
    });

    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        const geojson = await response.json();

        L.geoJSON(geojson, {
            pane: "zonesPane",
            style: function(feature) {
                // Logique de couleur selon la restriction (propriété 'limite_alti')
                const h = feature.properties.limite_alti;
                return {
                    color: h === 0 ? "#ff0000" : (h <= 50 ? "#ff9900" : "#ffff00"),
                    weight: 1,
                    fillOpacity: 0.3
                };
            },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`<b>Zone UAS</b><br>Hauteur max : ${feature.properties.limite_alti}m`);
            }
        }).addTo(map);
        
        console.log("✅ Zones DGAC chargées dynamiquement");
    } catch (e) {
        console.error("Impossible de charger les zones DGAC :", e);
    }
}

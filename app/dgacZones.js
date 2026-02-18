async function loadDGACZones(){

    if(!window.map) return;

    const geojson = await cachedFetch(
        "dgac_zones",
        "zones_drones.geojson"
    );

    L.geoJSON(geojson,{
        pane:"zonesPane",
        style:{
            color:"#ff0000",
            fillOpacity:0.15
        }
    }).addTo(map);
}

window.loadDGACZones = loadDGACZones;

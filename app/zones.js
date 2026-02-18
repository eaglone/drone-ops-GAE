// ================================
// LOAD ALL ZONES
// ================================

function loadAllZones(){
    loadAllowedZones();
    loadRestrictionZones();
    loadUASZones();
}


// ================================
// ZONES AUTORISÉES
// ================================
function loadAllowedZones(){

    if(!allowedZones?.features || !map) return;

    const layer = L.geoJSON(allowedZones,{
        pane:"zonesPane",
        style:{
            color:"#64748b",
            weight:1,
            fillOpacity:0,
            dashArray:"4"
        }
    });

    allowedLayer.addLayer(layer);

    // visible seulement zoom > 9
    map.on("zoomend",()=>{
        if(map.getZoom() > 9){
            if(!map.hasLayer(allowedLayer)) map.addLayer(allowedLayer);
        }else{
            if(map.hasLayer(allowedLayer)) map.removeLayer(allowedLayer);
        }
    });
}




// ================================
// RESTRICTIONS
// ================================

function loadRestrictionZones(){

    if(!restrictionZones?.features || !map) return;

    const layer = L.geoJSON(restrictionZones,{
        pane:"zonesPane",
        style:getZoneStyle,
        onEachFeature:bindZonePopup
    });

    restrictionLayer.addLayer(layer);

    map.on("zoomend moveend",()=>{
        layer.setStyle(getZoneStyle);
    });
}



// ================================
// UAS ZONES (conversion SIA → GeoJSON)
// ================================
function loadUASZones(){

    if(!uasZones?.features || !map) return;

    const geojson = {type:"FeatureCollection",features:[]};

    uasZones.features.forEach(zone=>{
        zone.geometry?.forEach(g=>{
            if(!g.horizontalProjection?.coordinates) return;

            geojson.features.push({
                type:"Feature",
                geometry:g.horizontalProjection,
                properties:{
                    name:zone.name,
                    restriction:zone.restriction,
                    message:zone.message
                }
            });
        });
    });

    const layer = L.geoJSON(geojson,{
        pane:"zonesPane",
        style:getZoneStyle,
        onEachFeature:bindZonePopup
    });

    uasLayer.addLayer(layer);

    map.on("zoomend moveend",()=>{
        layer.setStyle(getZoneStyle);
    });
}


/**
 * DGAC LOCAL JSON → Leaflet
 * - fonctionne GitHub Pages
 * - pas d'API
 * - pas de clé IGN
 */

let dgacLayer = null;

// ================= CONVERSION UAS → GEOJSON =================

function convertUASZonesToGeoJSON(data){

    const features = [];

    data.features.forEach(zone => {

        zone.geometry?.forEach(g => {

            const geom = g.horizontalProjection;
            if(!geom) return;

            features.push({
                type:"Feature",
                properties:{
                    name: zone.name,
                    restriction: zone.restriction,
                    lower:g.lowerLimit,
                    upper:g.upperLimit,
                    message:zone.message
                },
                geometry:geom
            });
        });
    });

    return {
        type:"FeatureCollection",
        features
    };
}

// ================= STYLE =================

function dgacStyle(feature){
    return {
        color: feature.properties.restriction === "PROHIBITED"
            ? "#ff0000"
            : "#ff9800",
        fillOpacity:0.3,
        weight:2
    };
}

// ================= CLICK =================

function onEachDGACFeature(feature, layer){

    layer.on("click", e=>{
        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
<b>ZONE DGAC</b><hr>
<b>Nom :</b> ${feature.properties.name}<br>
<b>Restriction :</b> ${feature.properties.restriction}<br>
<b>Altitude :</b> ${feature.properties.lower} → ${feature.properties.upper} m
`)
            .openOn(window.map);
    });
}

// ================= LOAD =================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    const res = await fetch("UASZones.json");
    const data = await res.json();

    const geojson = convertUASZonesToGeoJSON(data);

    dgacLayer = L.geoJSON(geojson,{
        pane:"zonesPane",
        style:dgacStyle,
        onEachFeature:onEachDGACFeature
    });

    return dgacLayer;
}

window.loadDGACZones = loadDGACZones;

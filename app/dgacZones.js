/**
 * DGAC LOCAL JSON → Leaflet (ROBUST VERSION)
 */

let dgacLayer = null;


// ================= CONVERSION SAFE =================

function isValidGeometry(geom){

    if(!geom) return false;
    if(!geom.type) return false;
    if(!geom.coordinates) return false;

    // vérifie structure minimale
    if(
        geom.type === "Polygon" &&
        (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0)
    ) return false;

    if(
        geom.type === "MultiPolygon" &&
        (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0)
    ) return false;

    return true;
}
function convertUASZonesToGeoJSON(data){

    return {
        type:"FeatureCollection",
        features:data.features.flatMap(zone => {

            if(!zone.geometry) return [];

            return zone.geometry
                .filter(g => g.horizontalProjection)
                .map(g => ({

                    type:"Feature",

                    properties:{
                        name: zone.name,
                        restriction: zone.restriction,
                        lower:g.lowerLimit,
                        upper:g.upperLimit,
                        message:zone.message
                    },

                    geometry:{
                        type:g.horizontalProjection.type,
                        coordinates:g.horizontalProjection.coordinates
                    }
                }));
        })
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


// ================= LOAD =================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    try{

        const res = await fetch("./UASZones.json");

        if(!res.ok) throw new Error("JSON non trouvé");

        const data = await res.json();

        const geojson = convertUASZonesToGeoJSON(data);

        dgacLayer = L.geoJSON(geojson,{
            pane:"zonesPane",
            style:dgacStyle,
            onEachFeature:onEachDGACFeature
        });

        console.log("✅ DGAC chargé");

        return dgacLayer;

    }catch(err){
        console.error("❌ DGAC erreur:", err);
        return null;
    }
}


window.loadDGACZones = loadDGACZones;

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

    const features = [];
    let skipped = 0;

    if(!data?.features) throw new Error("Structure JSON invalide");

    data.features.forEach(zone => {

        if(!zone.geometry) return;

        if(Array.isArray(zone.geometry)){

            zone.geometry.forEach(g => {

                const geom = g?.horizontalProjection;
                if(!isValidGeometry(geom)){
                    skipped++;
                    return;
                }

                features.push({
                    type:"Feature",
                    properties:{
                        name: zone.name || "Zone DGAC",
                        restriction: zone.restriction || "UNKNOWN",
                        lower:g.lowerLimit || 0,
                        upper:g.upperLimit || 0
                    },
                    geometry:geom
                });
            });
        }
    });

    console.log("DGAC features valid:", features.length);
    console.log("DGAC features skipped:", skipped);

    if(features.length === 0)
        throw new Error("Aucune géométrie valide");

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


// ================= LOAD =================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    try{

        const res = await fetch("./app/UASZones.json");

        if(!res.ok) throw new Error("JSON non trouvé");

        const data = await res.json();

        const geojson = convertUASZonesToGeoJSON(data);

        dgacLayer = L.geoJSON(geojson,{
            pane:"zonesPane",
            style:dgacStyle
        });

        console.log("✅ DGAC chargé");

        return dgacLayer;

    }catch(err){
        console.error("❌ DGAC erreur:", err);
        return null;
    }
}

window.loadDGACZones = loadDGACZones;

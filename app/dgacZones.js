/**
 * DGAC LOCAL JSON → Leaflet (ROBUST VERSION)
 */

let dgacLayer = null;


// ================= CONVERSION SAFE =================

function convertUASZonesToGeoJSON(data){

    if(!data) throw new Error("UAS JSON vide");

    const features = [];

    // support FeatureCollection direct
    if(data.type === "FeatureCollection"){
        return data;
    }

    // support format SIA
    if(!Array.isArray(data.features)){
        throw new Error("Structure JSON inconnue");
    }

    data.features.forEach(zone => {

        if(!zone.geometry) return;

        // format array
        if(Array.isArray(zone.geometry)){
            zone.geometry.forEach(g => {
                if(g?.horizontalProjection){
                    features.push({
                        type:"Feature",
                        properties:{
                            name: zone.name || "Zone DGAC",
                            restriction: zone.restriction || "UNKNOWN",
                            lower:g.lowerLimit || 0,
                            upper:g.upperLimit || 0,
                            message:zone.message || ""
                        },
                        geometry:g.horizontalProjection
                    });
                }
            });
        }

        // format direct
        else if(zone.geometry.type){
            features.push({
                type:"Feature",
                properties: zone.properties || {},
                geometry: zone.geometry
            });
        }
    });

    console.log("DGAC features:", features.length);

    if(features.length === 0){
        throw new Error("Aucune géométrie DGAC trouvée");
    }

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

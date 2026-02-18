/**
 * DGAC LOCAL JSON → Leaflet
 * PRO VERSION
 * - style dynamique selon zoom
 * - hover highlight
 * - clic popup
 * - performance 7000+ zones
 */

let dgacLayer = null;
let hoveredLayer = null;

// ================= STYLE opacity =================

function getDGACOpacity(){

    if(!window.map) return 0.4;

    const z = window.map.getZoom();

    // tu peux ajuster les valeurs
    if(z <= 8) return 0.55;   // vue large → visible
    if(z <= 10) return 0.45;
    if(z <= 12) return 0.35;
    if(z <= 14) return 0.25;
    if(z <= 16) return 0.18;
    return 0.12; // très zoomé → discret
}


// ================= STYLE DYNAMIQUE =================

function dgacStyle(feature){

    const z = window.map?.getZoom() || 10;

    const isClose = z > 14;

    return {
        color: "#ff0000",
        weight: isClose ? 3 : 2,
        fillColor: "#ff0000",
        fillOpacity: isClose ? 0.08 : getDGACOpacity(),
        opacity: 0.9
    };
}




// ================= INTERACTION =================

function onEachDGACFeature(feature, layer){

    // hover highlight
    layer.on("mouseover", () => {

        if(hoveredLayer && hoveredLayer !== layer){
            hoveredLayer.setStyle(dgacStyle(hoveredLayer.feature));
        }

        hoveredLayer = layer;
        layer.setStyle({ weight:4, fillOpacity:0.6 });
    });

    layer.on("mouseout", () => {
        layer.setStyle(dgacStyle(feature));
    });

    // popup clic
    layer.on("click", e => {

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
<b>ZONE DGAC</b><hr>
<b>Nom :</b> ${feature.properties.name || "—"}<br>
<b>Restriction :</b> ${feature.properties.restriction || "—"}<br>
<b>Altitude :</b> ${feature.properties.lower ?? "—"} → ${feature.properties.upper ?? "—"} m
`)
            .openOn(window.map);
    });
}


// ================= CONVERSION UAS → GEOJSON =================
function isValidGeometry(geom){

    if(!geom) return false;
    if(!geom.type) return false;
    if(!geom.coordinates) return false;

    if(geom.type === "Polygon"){
        if(!Array.isArray(geom.coordinates)) return false;
        if(!geom.coordinates.length) return false;
        if(!Array.isArray(geom.coordinates[0])) return false;
        if(geom.coordinates[0].length < 4) return false; // min polygon
    }

    if(geom.type === "MultiPolygon"){
        if(!Array.isArray(geom.coordinates)) return false;
        if(!geom.coordinates.length) return false;
    }

    return true;
}

function convertUASZonesToGeoJSON(data){

    if(!data?.features){
        return { type:"FeatureCollection", features:[] };
    }

    let skipped = 0;

    const features = data.features.flatMap(zone => {

        if(!zone.geometry) return [];

        return zone.geometry
            .filter(g => isValidGeometry(g.horizontalProjection))
            .map(g => ({

                type:"Feature",

                properties:{
                    name: zone.name,
                    restriction: zone.restriction,
                    lower: g.lowerLimit,
                    upper: g.upperLimit,
                    message: zone.message
                },

                geometry:g.horizontalProjection
            }));
    });

    console.log("DGAC valid:", features.length);

    return {
        type:"FeatureCollection",
        features
    };
}


// ================= REFRESH STYLE =================

function updateDGACStyle(){
    if(!dgacLayer) return;
    dgacLayer.setStyle(dgacStyle);
}

// ================= LOAD =================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    try{

        const res = await fetch("app/UASZones.json");
        if(!res.ok) throw new Error("JSON non trouvé");

        const data = await res.json();
        const geojson = convertUASZonesToGeoJSON(data);

        console.log("DGAC features:", geojson.features.length);

        if(!geojson.features.length){
            console.warn("⚠️ Aucun polygone DGAC");
            return null;
        }

        dgacLayer = L.geoJSON(geojson,{
            pane:"zonesPane",
            style:dgacStyle,
            onEachFeature:onEachDGACFeature
        });

        // ajoute à la carte
        dgacLayer.addTo(window.map);

        // listener zoom une seule fois
        if(!window.dgacZoomListener){
            window.map.on("zoomend", updateDGACStyle);
            window.dgacZoomListener = true;
        }

        console.log("✅ DGAC prêt");

        return dgacLayer;

    }catch(err){
        console.error("❌ DGAC erreur:", err);
        return null;
    }
}


window.loadDGACZones = loadDGACZones;


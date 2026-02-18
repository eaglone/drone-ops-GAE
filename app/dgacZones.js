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


// ================= STYLE DYNAMIQUE =================

function dgacStyle(feature){

    const zoom = window.map?.getZoom?.() || 10;

    const baseOpacity = zoom < 9 ? 0.1 :
                        zoom < 11 ? 0.2 :
                        zoom < 13 ? 0.3 :
                        0.45;

    return {
        color: feature.properties.restriction === "PROHIBITED"
            ? "#ff0000"
            : "#ff9800",

        fillColor: feature.properties.restriction === "PROHIBITED"
            ? "#ff0000"
            : "#ff9800",

        weight: zoom >= 13 ? 2 : 1,
        fillOpacity: baseOpacity
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
                        lower: g.lowerLimit,
                        upper: g.upperLimit,
                        message: zone.message
                    },

                    geometry:g.horizontalProjection
                }));
        })
    };
}


// ================= LOAD =================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    try{

        // ⚠️ ton JSON doit être à la racine GitHub Pages
        const res = await fetch("app/UASZones.json");

        if(!res.ok) throw new Error("JSON non trouvé");

        const data = await res.json();
        const geojson = convertUASZonesToGeoJSON(data);

        console.log("DGAC features:", geojson.features.length);

        dgacLayer = L.geoJSON(geojson,{
            pane:"zonesPane",
            style:dgacStyle,
            onEachFeature:onEachDGACFeature
        });

        // refresh style quand zoom change
        window.map.on("zoomend", ()=>{
            dgacLayer.setStyle(dgacStyle);
        });

        return dgacLayer;

    }catch(err){
        console.error("❌ DGAC erreur:", err);
        return null;
    }
}

window.loadDGACZones = loadDGACZones;

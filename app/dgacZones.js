/**
 * DGAC LOCAL JSON → Leaflet (PRO VERSION)
 * - GitHub Pages compatible
 * - robuste GeoJSON
 * - clickable
 * - fade selon zoom
 * - perf optimisée
 */

let dgacLayer = null;


// =============================
// VALIDATION GEOMETRY
// =============================

function isValidGeometry(geom){

    if(!geom) return false;
    if(!geom.type) return false;
    if(!geom.coordinates) return false;

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


// =============================
// CONVERSION JSON → GEOJSON SAFE
// =============================

function convertUASZonesToGeoJSON(data){

    const features = [];

    data.features.forEach(zone => {

        if(!zone.geometry) return;

        zone.geometry.forEach(g => {

            const geom = g.horizontalProjection;
            if(!isValidGeometry(geom)) return;

            features.push({
                type:"Feature",
                properties:{
                    name: zone.name,
                    restriction: zone.restriction,
                    lower:g.lowerLimit,
                    upper:g.upperLimit,
                    message:zone.message
                },
                geometry: geom
            });

        });
    });

    console.log("DGAC features:", features.length);

    return {
        type:"FeatureCollection",
        features
    };
}


// =============================
// STYLE
// =============================

function dgacStyle(feature){

    const prohibited = feature.properties.restriction === "PROHIBITED";

    return {
        color: prohibited ? "#ff0000" : "#ff9800",
        fillColor: prohibited ? "#ff0000" : "#ff9800",
        weight: 2,
        fillOpacity: 0.35
    };
}


// =============================
// CLICK POPUP
// =============================

function onEachDGACFeature(feature, layer){

    const p = feature.properties || {};

    const statut =
        p.restriction === "PROHIBITED"
        ? "🚫 VOL INTERDIT"
        : "⚠️ Zone réglementée";

    layer.on("click", e => {

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
<b>RESTRICTION DRONE DGAC</b><hr>
<b>Statut :</b> ${statut}<br>
<b>Zone :</b> ${p.name || "N/A"}<br>
<b>Altitude :</b> ${p.lower ?? 0} → ${p.upper ?? "∞"} m AGL
`)
            .openOn(window.map);
    });
}


// =============================
// FADE SELON ZOOM (ULTRA UX)
// =============================

function updateDGACOpacity(){

    if(!window.map || !dgacLayer) return;

    const z = window.map.getZoom();

    let opacity = 0.35;

    if(z < 8) opacity = 0;
    else if(z < 10) opacity = 0.2;
    else if(z < 13) opacity = 0.35;
    else opacity = 0.6;

    dgacLayer.setStyle({ fillOpacity: opacity });
}


// =============================
// LOAD DGAC
// =============================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    try{

        // ⚠️ adapte si ton fichier est ailleurs
        const res = await fetch("app/UASZones.json");

        if(!res.ok) throw new Error("UASZones.json introuvable");

        const data = await res.json();

        const geojson = convertUASZonesToGeoJSON(data);

        dgacLayer = L.geoJSON(geojson,{
            pane:"zonesPane",
            style:dgacStyle,
            onEachFeature:onEachDGACFeature
        });

        // fade dynamique
        window.map.on("zoomend", updateDGACOpacity);

        updateDGACOpacity();

        console.log("✅ DGAC chargé");

        return dgacLayer;

    }catch(err){
        console.error("❌ DGAC erreur:", err);
        return null;
    }
}


// =============================
// EXPORT GLOBAL
// =============================

window.loadDGACZones = loadDGACZones;

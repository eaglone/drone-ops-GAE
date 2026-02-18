/**
 * DGAC LOCAL JSON → Leaflet
 * PRODUCTION VERSION
 *
 * ✔ style dynamique selon zoom
 * ✔ fade progressif
 * ✔ hover highlight
 * ✔ popup clic
 * ✔ conversion Circle → Polygon
 * ✔ validation GeoJSON robuste
 * ✔ performance 7000+ zones
 * ✔ refresh style fiable
 */

let dgacLayer = null;
let hoveredLayer = null;


// =====================================================
// ⭐ OPACITY SELON ZOOM (effet DroneAssist)
// =====================================================

function getDGACOpacity(){

    const z = window.map?.getZoom() || 10;

    if(z <= 6) return 0.45;
    if(z <= 8) return 0.38;
    if(z <= 10) return 0.30;
    if(z <= 12) return 0.22;
    if(z <= 14) return 0.15;
    return 0.08;
}


// =====================================================
// ⭐ STYLE DYNAMIQUE
// =====================================================

function dgacStyle(feature){

    const z = window.map?.getZoom() || 10;
    const restriction = feature?.properties?.restriction;

    const isProhibited = restriction === "PROHIBITED";

    const color = isProhibited ? "#ff2d2d" : "#ff9800";

    return {
        color: color,
        fillColor: color,
        fillOpacity: getDGACOpacity(),
        weight: z > 13 ? 2.5 : 1.5,
        opacity: 0.9,
        smoothFactor: 1
    };
}


// =====================================================
// ⭐ REFRESH STYLE AU ZOOM (fiable Leaflet)
// =====================================================

function updateDGACStyle(){

    if(!dgacLayer) return;

    dgacLayer.eachLayer(layer=>{
        if(layer.feature){
            layer.setStyle(dgacStyle(layer.feature));
        }
    });
}


// =====================================================
// ⭐ INTERACTION (hover + popup)
// =====================================================

function onEachDGACFeature(feature, layer){

    // hover
    layer.on("mouseover", ()=>{

        if(hoveredLayer && hoveredLayer !== layer){
            hoveredLayer.setStyle(dgacStyle(hoveredLayer.feature));
        }

        hoveredLayer = layer;

        layer.setStyle({
            weight:4,
            fillOpacity:0.6
        });
    });

    layer.on("mouseout", ()=>{
        layer.setStyle(dgacStyle(feature));
    });

    // popup clic
    layer.on("click", e=>{

        const p = feature.properties || {};

        L.popup()
            .setLatLng(e.latlng)
            .setContent(`
<b>RESTRICTION DRONE DGAC</b><hr>
<b>Zone :</b> ${p.name || "—"}<br>
<b>Statut :</b> ${p.restriction || "—"}<br>
<b>Altitude :</b> ${p.lower ?? "—"} → ${p.upper ?? "—"} m
`)
            .openOn(window.map);
    });
}


// =====================================================
// ⭐ VALIDATION GEOMETRY
// =====================================================

function isValidGeometry(geom){

    if(!geom || !geom.type || !geom.coordinates) return false;

    if(geom.type === "Polygon"){
        if(!Array.isArray(geom.coordinates)) return false;
        if(!geom.coordinates.length) return false;
        if(!Array.isArray(geom.coordinates[0])) return false;
        if(geom.coordinates[0].length < 4) return false;
    }

    if(geom.type === "MultiPolygon"){
        if(!Array.isArray(geom.coordinates)) return false;
        if(!geom.coordinates.length) return false;
    }

    return true;
}


// =====================================================
// ⭐ CONVERT UAS → GEOJSON
// =====================================================

function convertUASZonesToGeoJSON(data){

    if(!data?.features){
        return { type:"FeatureCollection", features:[] };
    }

    let skipped = 0;

    const features = data.features.flatMap(zone=>{

        if(!zone.geometry) return [];

        return zone.geometry.map(g=>{

            let geom = g.horizontalProjection;
            if(!geom) return null;

            // ===== convert Circle → Polygon =====
            if(geom.type === "Circle" && geom.center && geom.radius){

                const center = geom.center;
                const radius = geom.radius;
                const points = 32;
                const coords = [];

                const R = 6371000;
                const lat1 = center[1]*Math.PI/180;
                const lon1 = center[0]*Math.PI/180;

                for(let i=0;i<=points;i++){

                    const brng = (i*360/points)*Math.PI/180;

                    const lat2 = Math.asin(
                        Math.sin(lat1)*Math.cos(radius/R) +
                        Math.cos(lat1)*Math.sin(radius/R)*Math.cos(brng)
                    );

                    const lon2 = lon1 + Math.atan2(
                        Math.sin(brng)*Math.sin(radius/R)*Math.cos(lat1),
                        Math.cos(radius/R)-Math.sin(lat1)*Math.sin(lat2)
                    );

                    coords.push([lon2*180/Math.PI, lat2*180/Math.PI]);
                }

                geom = {
                    type:"Polygon",
                    coordinates:[coords]
                };
            }

            if(!isValidGeometry(geom)){
                skipped++;
                return null;
            }

            // ferme polygon si ouvert
            if(geom.type === "Polygon"){
                geom.coordinates = geom.coordinates.map(ring=>{
                    const first = ring[0];
                    const last = ring[ring.length-1];
                    if(first[0] !== last[0] || first[1] !== last[1]){
                        ring.push(first);
                    }
                    return ring;
                });
            }

            return {
                type:"Feature",
                properties:{
                    name: zone.name,
                    restriction: zone.restriction,
                    lower: g.lowerLimit,
                    upper: g.upperLimit,
                    message: zone.message
                },
                geometry: geom
            };

        }).filter(Boolean);

    });

    console.log("DGAC valid:", features.length, "skipped:", skipped);

    return {
        type:"FeatureCollection",
        features
    };
}


// =====================================================
// ⭐ LOAD DGAC
// =====================================================

async function loadDGACZones(){

    if(dgacLayer) return dgacLayer;
    if(!window.map) return null;

    console.log("📡 Chargement DGAC local JSON");

    try{

        const res = await fetch("app/UASZones.json");

        if(!res.ok) throw new Error("JSON non trouvé");

        const data = await res.json();
        const geojson = convertUASZonesToGeoJSON(data);

        if(!geojson.features.length){
            console.warn("⚠️ Aucun polygone DGAC");
            return null;
        }

        dgacLayer = L.geoJSON(geojson,{
            pane:"zonesPane",
            style:dgacStyle,
            onEachFeature:onEachDGACFeature
        });

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

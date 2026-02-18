/**
 * OPENAIP.JS — Aviation Airspaces Overlay
 * Version OPS production / ICAO
 */

const OPENAIP_KEY = "db8fd47e611ac318fc7716c10311d4f2";

let openAipLayer = null;
let lastFetchPosition = null;


// =============================
// LOAD AIRSPACES
// =============================

async function loadOpenAIPAirspaces(lat, lon){

    if(!window.map || !lat || !lon) return;

    // éviter reload si déplacement < 5km
    if(lastFetchPosition){
        const d = distanceKm(
            lat, lon,
            lastFetchPosition.lat,
            lastFetchPosition.lon
        );
        if(d < 5) return;
    }

    lastFetchPosition = {lat, lon};

    try{

        const bbox = buildBBoxKm(lat, lon, 80);

        const res = await fetch(
            `https://api.core.openaip.net/api/airspaces?bbox=${bbox}&limit=500`,
            { headers:{ "x-openaip-api-key": OPENAIP_KEY } }
        );

        if(!res.ok){
            console.warn("OpenAIP API error:", res.status);
            return;
        }

        const data = await res.json();
        if(!data?.items?.length) return;

        renderAirspaces(data.items);

    }catch(e){
        console.error("OpenAIP error:", e);
    }
}


// =============================
// RENDER MAP (compatible checkbox)
// =============================

function renderAirspaces(items){

    // supprimer ancienne couche
    if(openAipLayer){
        openAipLayer.clearLayers();
    }

    const features = [];

    items.forEach(a=>{
        if(!a.geometry?.coordinates) return;

        features.push({
            type:"Feature",
            geometry:a.geometry,
            properties:{
                name:a.name,
                class:a.airspaceClass,
                type:a.type,
                lower:a.lowerLimit?.value || "",
                upper:a.upperLimit?.value || ""
            }
        });
    });

    openAipLayer = L.geoJSON({
        type:"FeatureCollection",
        features
    },{
        pane:"zonesPane",
        style:getAirspaceStyle,
        onEachFeature:bindAirspacePopup
    });

    // 👉 IMPORTANT : on injecte dans map.js
    if(typeof setOpenAIPLayer === "function"){
        setOpenAIPLayer(openAipLayer);
    }else{
        openAipLayer.addTo(map);
    }
}


// =============================
// STYLE ICAO
// =============================

function getAirspaceStyle(feature){

    const zoom = map.getZoom();
    const c = feature.properties.class;

    let opacity = 0.03;
    if(zoom>9) opacity=0.06;
    if(zoom>11) opacity=0.12;
    if(zoom>13) opacity=0.25;

    return{
        color:
            c==="CTR" ? "#ef4444" :
            c==="TMA" ? "#f59e0b" :
            c==="D"   ? "#ef4444" :
            c==="R"   ? "#f97316" :
            c==="P"   ? "#dc2626" :
            c==="C"   ? "#38bdf8" :
            "#64748b",

        weight: zoom>12 ? 2 : 1,
        fillOpacity: opacity
    };
}


// =============================
// POPUP STYLE OACI
// =============================

function bindAirspacePopup(feature, layer){

    const p = feature.properties;

    layer.bindPopup(`
        <div class="oaci-popup">
            <div class="oaci-title">${p.name || "Airspace"}</div>
            <div class="oaci-status">${p.class || ""}</div>
            <div>⬆ ${p.upper || "?"}</div>
            <div>⬇ ${p.lower || "?"}</div>
        </div>
    `);
}


// =============================
// BBOX KM
// =============================

function buildBBoxKm(lat, lon, km){

    const latDiff = km / 111;
    const lonDiff = km / (111 * Math.cos(lat*Math.PI/180));

    return [
        lon-lonDiff,
        lat-latDiff,
        lon+lonDiff,
        lat+latDiff
    ].join(",");
}


// =============================
// DISTANCE KM
// =============================

function distanceKm(lat1,lon1,lat2,lon2){

    const R=6371;
    const dLat=(lat2-lat1)*Math.PI/180;
    const dLon=(lon2-lon1)*Math.PI/180;

    const a=
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}


// =============================
// AUTO UPDATE POSITION MAP
// =============================

function initOpenAIPAutoUpdate(){

    if(!window.map) return;

    map.on("moveend",()=>{
        const c = map.getCenter();
        loadOpenAIPAirspaces(c.lat, c.lng);
    });
}


// =============================
// EXPORT
// =============================

window.loadOpenAIPAirspaces = loadOpenAIPAirspaces;
window.initOpenAIPAutoUpdate = initOpenAIPAutoUpdate;

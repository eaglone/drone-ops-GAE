/**
 * OPENAIP.JS — Airspaces Aviation Overlay
 * OpenAIP Core API
 */

const OPENAIP_KEY = "db8fd47e611ac318fc7716c10311d4f2";

let openAipLayer;


// =============================
// LOAD AIRSPACES
// =============================

async function loadOpenAIPAirspaces(lat, lon){

    if(!map) return;

    // ===== CACHE 10 MIN =====
    const cacheKey = "openaip_cache";
    const cacheTime = localStorage.getItem("openaip_cache_time");

    if(cacheTime && Date.now() - cacheTime < 600000){

        const cached = localStorage.getItem(cacheKey);
        if(cached){
            renderAirspaces(JSON.parse(cached));
            return;
        }
    }

    try{

        // bounding box 80km autour position
        const bbox = getBBox(lat, lon, 0.8);

        const url =
        `https://api.core.openaip.net/api/airspaces?` +
        `bbox=${bbox}` +
        `&limit=200`;

        const res = await fetch(url,{
            headers:{
                "x-openaip-api-key": OPENAIP_KEY
            }
        });

        const data = await res.json();

        if(!data?.items) return;

        localStorage.setItem(cacheKey, JSON.stringify(data.items));
        localStorage.setItem("openaip_cache_time", Date.now());

        renderAirspaces(data.items);

    }catch(e){
        console.error("OpenAIP error", e);
    }
}


// =============================
// RENDER MAP
// =============================

function renderAirspaces(items){

    if(openAipLayer){
        map.removeLayer(openAipLayer);
    }

    const geojson={
        type:"FeatureCollection",
        features:[]
    };

    items.forEach(a=>{

        if(!a.geometry) return;

        geojson.features.push({
            type:"Feature",
            geometry:a.geometry,
            properties:{
                name:a.name,
                type:a.type,
                class:a.airspaceClass,
                lower:a.lowerLimit?.value,
                upper:a.upperLimit?.value
            }
        });

    });

    openAipLayer = L.geoJSON(geojson,{
        pane:"zonesPane",
        style:getAirspaceStyle,
        onEachFeature:bindAirspacePopup
    }).addTo(map);
}


// =============================
// STYLE ICAO
// =============================

function getAirspaceStyle(feature){

    const c = feature.properties.class;

    return{
        color:
            c==="CTR" ? "#ef4444" :
            c==="TMA" ? "#f59e0b" :
            c==="D"   ? "#ef4444" :
            c==="R"   ? "#f97316" :
            "#38bdf8",

        weight:2,
        fillOpacity:0.08
    };
}


// =============================
// POPUP
// =============================

function bindAirspacePopup(feature, layer){

    const p = feature.properties;

    layer.bindPopup(`
        <div class="oaci-popup">
            <div class="oaci-title">${p.name || "Airspace"}</div>
            <div>${p.class || ""}</div>
            <div>⬆ ${p.upper || "?"}</div>
            <div>⬇ ${p.lower || "?"}</div>
        </div>
    `);
}


// =============================
// BBOX AUTOUR POSITION
// =============================

function getBBox(lat, lon, radius){

    return [
        lon-radius,
        lat-radius,
        lon+radius,
        lat+radius
    ].join(",");
}


// =============================
// EXPORT
// =============================

window.loadOpenAIPAirspaces = loadOpenAIPAirspaces;


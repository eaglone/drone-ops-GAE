// ================= DISTANCE =================

function distanceKm(lat1, lon1, lat2, lon2){

    const R = 6371;
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;

    const a =
        Math.sin(dLat/2)**2 +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2)**2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


// ================= STYLE SIG PRO =================

function getZoneStyle(feature){

    if(!map) return {fillOpacity:0.05};

    const zoom = map.getZoom();

    const coords = feature.geometry?.coordinates?.[0]?.[0];
    if(!coords) return {fillOpacity:0.05};

    const [lon,lat] = coords;

    const dist = distanceKm(
        window.latitude,
        window.longitude,
        lat,
        lon
    );

    // ===== opacité distance =====
    let opacity = 0.04;

    if(dist < 10) opacity = 0.30;
    else if(dist < 30) opacity = 0.15;
    else if(dist < 60) opacity = 0.08;

    // correction zoom
    if(zoom > 13) opacity *= 1.4;

    const r = feature.properties?.restriction;

    return {
        color:
            r==="PROHIBITED" ? "#ef4444" :
            r==="RESTRICTED" ? "#f59e0b" :
            "#16a34a",

        weight: zoom>12 ? 2 : 1,
        fillOpacity: opacity
    };
}


// ================= POPUP =================

function bindZonePopup(feature,layer){

    const p = feature.properties || {};

    layer.bindPopup(`
        <div class="oaci-popup">
            <b>${p.name || ""}</b><br>
            ${p.restriction || ""}<br>
            ${p.message || ""}
        </div>
    `);
}


// ================= RADAR =================

let radarLastUpdate = 0;

function updateRadar(lat, lon){

    const radar = document.getElementById("radarFrame");
    if(!radar) return;

    // évite reload toutes les secondes
    const now = Date.now();
    if(now - radarLastUpdate < 120000) return; // 2 min

    radarLastUpdate = now;

    radar.src =
        `https://www.rainviewer.com/map.html?loc=${lat},${lon},11` +
        `&control=1` +
        `&map=1` +
        `&refl=1` +
        `&n=1` +
        `&p=3` +
        `&v=dark` +
        `&smooth=1`;
}


// ================= TIMER =================

function startUpdateTimer(duration){

    let timeLeft = duration;

    const bar = document.getElementById("updateProgressBar");
    const label = document.getElementById("updateTimerLabel");

    if(window.syncInterval) clearInterval(window.syncInterval);

    window.syncInterval=setInterval(()=>{

        timeLeft--;

        const m=Math.floor(timeLeft/60);
        const s=timeLeft%60;

        if(label) label.textContent=`${m}:${s<10?"0":""}${s}`;

        if(bar){
            bar.style.width=(timeLeft/duration)*100+"%";
        }

        if(timeLeft<=0) timeLeft=duration;

    },1000);
}


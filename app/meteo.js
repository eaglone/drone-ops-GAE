/**
 * METEO.JS — Drone OPS ULTRA
 * Analyse météo aviation / drone complète
 * GO / NO-GO + risque mission + turbulence + dérive
 */


/* =========================================
   LIMITES DRONES
========================================= */

const limits = {
    mini:      { max: 38, orange: 30 },
    mavic2:    { max: 36, orange: 28 },
    matrice4:  { max: 43, orange: 35 },
    matrice30: { max: 55, orange: 45 }
};

let currentKP = null;


/* =========================================
   KP SOLAIRE
========================================= */

async function loadKP(){

    try{
       const data = await cachedFetch("meteo_"+lat+"_"+lon, url);
(
            "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
        );

        const data = await r.json();

        if(data?.length){
            currentKP = parseFloat(data[data.length-1].kp_index);
            localStorage.setItem("gae_kp_cache",currentKP);
        }

    }catch{
        currentKP = localStorage.getItem("gae_kp_cache");
    }
}


/* =========================================
   ANALYSE SLOT FUTUR
========================================= */

function analyseSlot(slot,lim){

    let status="ok";
    let label="🟢 STABLE";

    if(
        slot.wind >= lim.max ||
        slot.gust >= lim.max ||
        slot.rain > 1 ||
        slot.vis < 2
    ){
        status="danger";
        label="🔴 DÉGRADATION";
    }

    else if(
        slot.wind >= lim.orange ||
        slot.gust >= lim.orange ||
        slot.rain > 0.1 ||
        slot.vis < 5
    ){
        status="warning";
        label="🟠 INSTABLE";
    }

    return {status,label,...slot};
}


/* =========================================
   CALCULS AVIONICS / DRONE
========================================= */

// estimation base nuage (approx aviation)
function getCloudBase(temp){
    return Math.round((temp - 10) * 125);
}

// turbulence estimée
function getTurbulence(wind,gust){
    const diff = gust - wind;
    if(diff > 20) return "🔴 FORTE";
    if(diff > 10) return "🟠 MODÉRÉE";
    return "🟢 FAIBLE";
}

// dérive drone estimée
function getDrift(wind){
    if(wind > 45) return "⚠️ Forte dérive";
    if(wind > 25) return "↗️ Dérive moyenne";
    return "✔ Stable";
}

// score risque global
function getRiskScore(wind,rain,vis,kp,lim){

    let score=0;

    if(wind>=lim.orange) score+=2;
    if(rain>0.1) score+=2;
    if(vis<5) score+=2;
    if(kp>=4) score+=3;

    if(score>5) return "HIGH";
    if(score>2) return "MEDIUM";
    return "LOW";
}


/* =========================================
   CHARGEMENT METEO
========================================= */

async function loadMeteo(){

    const lat=window.latitude;
    const lon=window.longitude;
    if(!lat||!lon) return;

    const decisionBox=document.getElementById("decision");

    try{

      /* ================= ALTITUDE IGN ================= */

let altitude = "NC";

// altitude optionnelle — ne bloque jamais la météo
try {

    // timeout sécurité (évite freeze UI)
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);

    const altRes = await fetch(
        `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json` +
        `?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld`,
        {
            method: "GET",
            mode: "cors",
            signal: controller.signal
        }
    );

    if (!altRes.ok) throw new Error("Altitude API error");

    const altData = await altRes.json();

    if (altData?.elevations?.length) {
        altitude = Math.round(altData.elevations[0].z);
    }

} catch (e) {
    console.warn("Altitude IGN indisponible — fallback NC");
}



        /* ================= OPEN METEO ================= */

        const url=
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}`+
        `&longitude=${lon}`+
        `&current_weather=true`+
        `&hourly=windspeed_80m,windgusts_10m,winddirection_80m,precipitation,visibility,cloudcover`+
        `&timezone=auto`;

        const r=await fetch(url);
        const data=await r.json();

        const cur=data.current_weather;

        /* ================= CONDITIONS ACTUELLES ================= */

        const windNow=Math.round(data.hourly.windspeed_80m[0]);
        const gustNow=Math.round(data.hourly.windgusts_10m[0]);
        const rainNow=data.hourly.precipitation[0];
        const visNow=data.hourly.visibility[0]/1000;
        const cloudNow=data.hourly.cloudcover[0];
        const windDir=data.hourly.winddirection_80m[0];

        const droneKey=document.getElementById("droneType").value;
        const lim=limits[droneKey]||limits.mini;

        const cloudBase=getCloudBase(cur.temperature);
        const turbulence=getTurbulence(windNow,gustNow);
        const drift=getDrift(windNow);
        const risk=getRiskScore(windNow,rainNow,visNow,currentKP,lim);


        /* ================= DECISION VOL ================= */

        let niveau="ok";
        let msg="🟢 VOL AUTORISÉ";

        if(
            windNow>=lim.max ||
            gustNow>=lim.max ||
            rainNow>1 ||
            visNow<2 ||
            currentKP>=5
        ){
            niveau="danger";
            msg="🔴 VOL INTERDIT";
        }

        else if(
            windNow>=lim.orange ||
            gustNow>=lim.orange ||
            rainNow>0.1 ||
            visNow<5 ||
            currentKP>=4
        ){
            niveau="warning";
            msg="🟠 SOUS VIGILANCE";
        }

        if(decisionBox){
            decisionBox.className="decision-box "+niveau;
            decisionBox.textContent=msg;
        }


        /* ================= PREVISION +1H / +3H ================= */

        const h1={
            wind:Math.round(data.hourly.windspeed_80m[1]),
            gust:Math.round(data.hourly.windgusts_10m[1]),
            rain:data.hourly.precipitation[1],
            vis:data.hourly.visibility[1]/1000,
            cloud:data.hourly.cloudcover[1]
        };

        const h3={
            wind:Math.round(data.hourly.windspeed_80m[3]),
            gust:Math.round(data.hourly.windgusts_10m[3]),
            rain:data.hourly.precipitation[3],
            vis:data.hourly.visibility[3]/1000,
            cloud:data.hourly.cloudcover[3]
        };

        const slot1=analyseSlot(h1,lim);
        const slot3=analyseSlot(h3,lim);

        const windTrend=
            h3.wind>windNow?"⬆️":
            h3.wind<windNow?"⬇️":"→";


        document.getElementById("forecast-extended").innerHTML=`
        <div class="forecast-slot ${slot1.status}">
            <h4>⏱️ +1H</h4>
            <div>${slot1.label}</div>
            <div>💨 ${slot1.wind} km/h</div>
            <div>🌪️ ${slot1.gust} km/h</div>
            <div>🌧️ ${slot1.rain} mm</div>
            <div>👁️ ${slot1.vis.toFixed(1)} km</div>
        </div>

        <div class="forecast-slot ${slot3.status}">
            <h4>⏱️ +3H</h4>
            <div>${slot3.label}</div>
            <div>💨 ${slot3.wind} km/h</div>
            <div>🌪️ ${slot3.gust} km/h</div>
            <div>🌧️ ${slot3.rain} mm</div>
            <div>👁️ ${slot3.vis.toFixed(1)} km</div>
        </div>
        `;


        /* ================= PANNEAU METEO ================= */

        document.getElementById("meteo").innerHTML=`
            <div class="item">💨 Vent: <b>${windNow} km/h</b></div>
            <div class="item">🌪️ Rafales: ${gustNow} km/h</div>
            <div class="item">🧭 Direction: ${windDir}°</div>
            <div class="item">🌧️ Pluie: ${rainNow} mm</div>
            <div class="item">👁️ Visibilité: ${visNow.toFixed(1)} km</div>
            <div class="item">☁️ Nuages: ${cloudNow}%</div>
            <div class="item">☁️ Base nuage: ${cloudBase} m</div>
            <div class="item">🌡️ Temp: ${cur.temperature}°C</div>
            <div class="item">📈 Tendance vent: ${windTrend}</div>
            <div class="item">🌪️ Turbulence: ${turbulence}</div>
            <div class="item">🛰️ Dérive drone: ${drift}</div>
            <div class="item">🎯 Risk: ${risk}</div>
            <div class="item ${(currentKP>=5)?"danger":""}">
                🧲 KP: ${currentKP ?? "N/A"}
            </div>
        `;


        /* ================= SORA ================= */

        renderSafety(altitude,cur.temperature,slot3);

    }
    catch(e){

        console.error("METEO ERROR:",e);

        if(decisionBox){
            decisionBox.className="decision-box danger";
            decisionBox.textContent="❌ ERREUR DONNÉES";
        }
    }
}


/* =========================================
   SORA / SECURITE
========================================= */

function renderSafety(alt,temp,slot3){

    const box=document.getElementById("safety-alerts");
    if(!box) return;

    let html="";

    if(alt!=="NC"){
        html+=`<div class="safety-item">🏔️ Sol: ${alt} m → Plafond ${+alt+120} m</div>`;
    }

    if(currentKP>=5){
        html+=`<div class="safety-item danger">🛰️ Risque GNSS (KP ${currentKP})</div>`;
    }

    if(temp<5){
        html+=`<div class="safety-item danger">❄️ Froid batterie (${temp}°C)</div>`;
    }

    if(slot3.status!=="ok"){
        html+=`<div class="safety-item warning">⚠️ Dégradation prévue < 3h</div>`;
    }

    box.innerHTML=html;
}


/* =========================================
   INIT
========================================= */

function initMeteo(){

    const drone=document.getElementById("droneType");

    if(drone){
        drone.addEventListener("change",()=>{
            if(window.latitude) loadMeteo();
        });
    }

    loadKP();
}

window.loadMeteo=loadMeteo;
window.initMeteo=initMeteo;


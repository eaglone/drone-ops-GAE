/**
 * METEO.JS — Drone OPS ULTRA
 * Version production stable + prévisions 1h 3h 6h
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
        const data = await cachedFetch(
            "gae_kp",
            "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
        );

        if(data?.length){
            currentKP = parseFloat(data[data.length-1].kp_index);
            localStorage.setItem("gae_kp_cache", currentKP);
        }

    }catch{
        currentKP = localStorage.getItem("gae_kp_cache") || null;
    }
}


/* =========================================
   ANALYSE SLOT FUTUR
========================================= */

function analyseSlot(slot, lim){

    if(!slot) return {status:"ok", label:"N/A"};

    let status="ok";
    let label="🟢 STABLE";

    if(slot.wind>=lim.max || slot.gust>=lim.max || slot.rain>1 || slot.vis<2){
        status="danger";
        label="🔴 DÉGRADATION";
    }
    else if(slot.wind>=lim.orange || slot.gust>=lim.orange || slot.rain>0.1 || slot.vis<5){
        status="warning";
        label="🟠 INSTABLE";
    }

    return {status, label, ...slot};
}


/* =========================================
   CALCULS DRONE
========================================= */

const getCloudBase = temp => Math.round((temp-10)*125);

const getTurbulence = (wind,gust)=>{
    const diff=gust-wind;
    if(diff>20) return "🔴 FORTE";
    if(diff>10) return "🟠 MODÉRÉE";
    return "🟢 FAIBLE";
};

const getDrift = wind=>{
    if(wind>45) return "⚠️ Forte dérive";
    if(wind>25) return "↗️ Dérive moyenne";
    return "✔ Stable";
};

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
   ALTITUDE IGN
========================================= */

async function getAltitude(lat,lon){

    try{
        const controller=new AbortController();
        setTimeout(()=>controller.abort(),3000);

        const r=await fetch(
            `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld`,
            {signal:controller.signal}
        );

        if(!r.ok) return "NC";

        const d=await r.json();
        if(d?.elevations?.length) return Math.round(d.elevations[0].z);

    }catch{}

    return "NC";
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

        const altitudePromise=getAltitude(lat,lon);

        const url=
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}`+
        `&longitude=${lon}`+
        `&current_weather=true`+
        `&hourly=windspeed_80m,windgusts_10m,winddirection_80m,precipitation,visibility,cloudcover`+
        `&timezone=auto`;

        const data=await cachedFetch("meteo_"+lat+"_"+lon,url);

        if(!data?.hourly) throw new Error("meteo data invalid");

        const altitude=await altitudePromise;
        const cur=data.current_weather;

        /* ================= INDEX ACTUEL ================= */

        let nowIndex = data.hourly.time.findIndex(t=>{
            const d=new Date(t);
            const n=new Date();
            return d.getHours()===n.getHours() && d.getDate()===n.getDate();
        });

        if(nowIndex<0) nowIndex=0;

        const buildSlot = (i)=>({
            wind: Math.round(data.hourly.windspeed_80m[i] || 0),
            gust: Math.round(data.hourly.windgusts_10m[i] || 0),
            rain: data.hourly.precipitation[i] || 0,
            vis: (data.hourly.visibility[i] || 0)/1000
        });

        /* ================= ACTUEL ================= */

        const nowSlot = buildSlot(nowIndex);

        const windNow=nowSlot.wind;
        const gustNow=nowSlot.gust;
        const rainNow=nowSlot.rain;
        const visNow=nowSlot.vis;
        const cloudNow=data.hourly.cloudcover[nowIndex]||0;
        const windDir=data.hourly.winddirection_80m[nowIndex]||0;

        const droneKey=document.getElementById("droneType")?.value||"mini";
        const lim=limits[droneKey];

        const cloudBase=getCloudBase(cur.temperature);
        const turbulence=getTurbulence(windNow,gustNow);
        const drift=getDrift(windNow);
        const risk=getRiskScore(windNow,rainNow,visNow,currentKP||0,lim);

        /* ================= PREVISIONS ================= */

        const slot1h=analyseSlot(buildSlot(nowIndex+1),lim);
        const slot3h=analyseSlot(buildSlot(nowIndex+3),lim);
        const slot6h=analyseSlot(buildSlot(nowIndex+6),lim);

        /* ================= DECISION ================= */

        let niveau="ok";
        let msg="🟢 VOL AUTORISÉ";

        if(windNow>=lim.max || gustNow>=lim.max || rainNow>1 || visNow<2 || currentKP>=5){
            niveau="danger";
            msg="🔴 VOL INTERDIT";
        }
        else if(windNow>=lim.orange || gustNow>=lim.orange || rainNow>0.1 || visNow<5 || currentKP>=4){
            niveau="warning";
            msg="🟠 SOUS VIGILANCE";
        }

        if(decisionBox){
            decisionBox.className="decision-box "+niveau;
            decisionBox.textContent=msg;
        }

        /* ================= UI ================= */

        document.getElementById("meteo").innerHTML=`
            <div class="item">💨 Vent: <b>${windNow} km/h</b></div>
            <div class="item">🌪️ Rafales: ${gustNow} km/h</div>
            <div class="item">🧭 Direction: ${windDir}°</div>
            <div class="item">🌧️ Pluie: ${rainNow} mm</div>
            <div class="item">👁️ Visibilité: ${visNow.toFixed(1)} km</div>
            <div class="item">☁️ Nuages: ${cloudNow}%</div>
            <div class="item">☁️ Base nuage: ${cloudBase} m</div>
            <div class="item">🌡️ Temp: ${cur.temperature}°C</div>
            <div class="item">🌪️ Turbulence: ${turbulence}</div>
            <div class="item">🛰️ Dérive: ${drift}</div>
            <div class="item">🎯 Risk: ${risk}</div>
            <div class="item">🏔️ Altitude: ${altitude}</div>
            <div class="item ${(currentKP>=5)?"danger":""}">
                🧲 KP: ${currentKP ?? "N/A"}
            </div>

            <hr>
            <div class="forecast ${slot1h.status}">
                ⏱️ +1h : ${slot1h.label}
                <br>💨 ${slot1h.wind} | 🌪️ ${slot1h.gust} | 🌧️ ${slot1h.rain} | 👁️ ${slot1h.vis?.toFixed(1)} km
            </div>

            <div class="forecast ${slot3h.status}">
                ⏱️ +3h : ${slot3h.label}
                <br>💨 ${slot3h.wind} | 🌪️ ${slot3h.gust} | 🌧️ ${slot3h.rain} | 👁️ ${slot3h.vis?.toFixed(1)} km
            </div>

            <div class="forecast ${slot6h.status}">
                ⏱️ +6h : ${slot6h.label}
                <br>💨 ${slot6h.wind} | 🌪️ ${slot6h.gust} | 🌧️ ${slot6h.rain} | 👁️ ${slot6h.vis?.toFixed(1)} km
            </div>
        `;

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

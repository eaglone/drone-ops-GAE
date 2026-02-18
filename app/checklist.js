/**
 * CHECKLIST OPS — Drone Missions État / SORA Tactical
 * Version OPS terrain / aviation / sécurité
 * Analyse dynamique mission + score risque
 */


/* =========================================
   CONFIG DRONE
========================================= */

const droneSpecs = {
    mini:{diameter:0.15,windLimit:35},
    mavic2:{diameter:0.35,windLimit:36},
    matrice30:{diameter:0.9,windLimit:55},
    matrice4:{diameter:0.9,windLimit:43}
};


/* =========================================
   UTILS
========================================= */

function getWind(){
    const el=document.querySelector('#meteo .item b');
    return el?parseInt(el.textContent)||0:0;
}

function getTemperature(){
    const t=document.querySelector('#meteo');
    if(!t) return 15;
    const match=t.textContent.match(/Temp: (\d+)/);
    return match?parseInt(match[1]):15;
}

function getKP(){
    return parseFloat(localStorage.getItem("gae_kp_cache"))||0;
}

function detectUrban(addr){

    return [
        "rue","avenue","ville","place","route",
        "boulevard","centre","gare","ecole",
        "hopital","mairie","quartier"
    ].some(k=>addr.includes(k));
}

function getRiskLevel(score){
    if(score>=7) return "danger";
    if(score>=3) return "warning";
    return "ok";
}


/* =========================================
   GENERATE CHECKLIST
========================================= */

function generateSoraChecklist(){

    const drone=document.getElementById("droneType").value;
    const addr=document.getElementById("addressInput").value.toLowerCase();

    const wind=getWind();
    const temp=getTemperature();
    const kp=getKP();
    const isUrban=detectUrban(addr);

    const spec=droneSpecs[drone]||droneSpecs.mini;

    const elongation=Math.round(spec.diameter*400);

    let checks=[];
    let riskScore=0;


    /* ======================================
       ANALYSE RISQUE ENVIRONNEMENT
    ====================================== */

    if(wind>spec.windLimit){
        riskScore+=5;
        checks.push({
            cat:"danger",
            txt:`VENT CRITIQUE (${wind} km/h) — stabilité impossible`
        });
    }
    else if(wind>25){
        riskScore+=2;
        checks.push({
            cat:"warning",
            txt:`Vent modéré (${wind} km/h) — dérive possible`
        });
    }

    if(kp>=5){
        riskScore+=4;
        checks.push({
            cat:"danger",
            txt:`Perturbation GNSS (KP ${kp})`
        });
    }

    if(temp<5){
        riskScore+=2;
        checks.push({
            cat:"warning",
            txt:`Température basse (${temp}°C) — batterie dégradée`
        });
    }

    if(isUrban){
        riskScore+=3;
        checks.push({
            cat:"danger",
            txt:"Zone peuplée — cadre STS obligatoire"
        });
    }


    /* ======================================
       RISQUES OPÉRATIONNELS DRONE
    ====================================== */

    checks.push({
        cat:"etat",
        txt:`Élongation max sécurité ≈ ${elongation} m`
    });

    checks.push({
        cat:"etat",
        txt:"Hauteur max 120 m AGL (sauf dérogation)"
    });

    checks.push({
        cat:"etat",
        txt:"Vérification espace aérien / NOTAM / RTBA"
    });

    checks.push({
        cat:"etat",
        txt:"RTH calibré + point HOME validé"
    });


    /* ======================================
       MISSIONS ÉTATIQUES
    ====================================== */

    checks.push({
        cat:"etat",
        txt:"Ordre mission validé (traçabilité OPS)"
    });

    checks.push({
        cat:"etat",
        txt:"Coordination autorités / services secours"
    });

    checks.push({
        cat:"etat",
        txt:"Fréquence aéronautique surveillée"
    });


    /* ======================================
       SÉCURITÉ SOL
    ====================================== */

    checks.push({
        cat:"etat",
        txt:"Zone décollage sécurisée (>30 m tiers)"
    });

    checks.push({
        cat:"etat",
        txt:"Zone urgence / crash identifiée"
    });

    checks.push({
        cat:"etat",
        txt:"Observateur visuel si environnement complexe"
    });


    /* ======================================
       CHECK SPÉCIFIQUE DRONE
    ====================================== */

    if(drone.includes("matrice")){

        checks.push({
            cat:"etat",
            txt:"Calibration capteurs / thermique OK"
        });

        checks.push({
            cat:"etat",
            txt:"Lien data sécurisé / télémétrie stable"
        });

    }else{

        checks.push({
            cat:"ouverte",
            txt:"Drone léger — sensible aux rafales"
        });
    }


    /* ======================================
       SCORE GLOBAL MISSION
    ====================================== */

    const riskLevel=getRiskLevel(riskScore);

    checks.unshift({
        cat:riskLevel==="danger"?"danger":"etat",
        txt:`Évaluation mission : ${riskLevel.toUpperCase()} (score ${riskScore})`
    });


    /* ======================================
       RENDU HTML
    ====================================== */

    const container=document.getElementById("checklist-content");
    if(!container) return;

    checks.sort((a,b)=>a.cat==="danger"?-1:1);

    container.innerHTML=checks.map((c,i)=>`

        <div class="check-item ${c.cat==="danger"?"critical-pulse":""}">
            <input type="checkbox" id="check-${i}">
            <label for="check-${i}">
                <span class="cat-badge cat-${c.cat}">
                    ${getLabel(c.cat)}
                </span>
                <span class="txt-content">${c.txt}</span>
            </label>
        </div>

    `).join("");
}


/* =========================================
   LABELS
========================================= */

function getLabel(cat){

    return{
        etat:"OPS ÉTAT",
        deve:"DÉROGATION",
        danger:"CRITIQUE",
        warning:"RISQUE",
        ouverte:"VIGILANCE"
    }[cat]||"INFO";
}


/* =========================================
   AUTO UPDATE
========================================= */

document.getElementById("droneType")
?.addEventListener("change",generateSoraChecklist);

window.generateSoraChecklist=generateSoraChecklist;


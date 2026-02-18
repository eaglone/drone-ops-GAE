/**
 * NOTAM France SIA
 */

async function loadNotam(){

    try{

        const url =
        "https://www.sia.aviation-civile.gouv.fr/notam-json"; // exemple

        const data = await cachedFetch("notam_fr", url);

        renderNotam(data);

    }catch(e){
        console.warn("NOTAM indisponible");
    }
}

function renderNotam(data){

    const box = document.getElementById("notam");

    if(!box) return;

    box.innerHTML =
        data.slice(0,5)
        .map(n=>`<div>⚠ ${n.message}</div>`)
        .join("");
}

window.loadNotam = loadNotam;

window.lastResults = [];

function initAutocomplete() {

    const input = document.getElementById("addressInput");
    const suggs = document.getElementById("suggestions");

    let debounceTimer;

    if (!input || !suggs) return;

    // ==============================
    // SAISIE UTILISATEUR
    // ==============================

    input.addEventListener("input", () => {

        clearTimeout(debounceTimer);

        const q = input.value.trim();

        if (q.length < 3) {
            suggs.style.display = "none";
            return;
        }

        debounceTimer = setTimeout(() => {
            searchIGN(q);
        }, 300);

    });


    // ==============================
    // RECHERCHE IGN
    // ==============================

    async function searchIGN(text) {

        try {

            const url =
                `https://data.geopf.fr/geocodage/completion/?` +
                `text=${encodeURIComponent(text)}` +
                `&terr=METROPOLE` +
                `&type=StreetAddress,PositionOfInterest` +
                `&maximumResponses=6`;

            const res = await fetch(url);

            const data = await res.json();

            window.lastResults = data.results || [];

            renderSuggestions();

        }
        catch (err) {
            console.error("Erreur Autocomplete IGN :", err);
        }
    }


    // ==============================
    // AFFICHAGE SUGGESTIONS
    // ==============================

    function renderSuggestions() {

        suggs.innerHTML = "";

        if (!window.lastResults.length) {
            suggs.style.display = "none";
            return;
        }

        window.lastResults.forEach(item => {

            const div = document.createElement("div");

            div.className = "suggestion-item";

            div.textContent = item.fulltext;

            div.onclick = () => selectLocation(item);

            suggs.appendChild(div);

        });

        suggs.style.display = "block";
    }


    // ==============================
    // SELECTION
    // ==============================

   function selectLocation(item) {

    // Coordonnées IGN = lon/lat
    window.longitude = item.x;
    window.latitude  = item.y;

    input.value = item.fulltext;
    suggs.style.display = "none";

    // ⭐ déplacer la carte (IMPORTANT)
    if (typeof updateMapPosition === "function") {
        updateMapPosition(window.latitude, window.longitude);
    }

    // ⭐ mettre à jour radar
    if (typeof updateRadar === "function") {
        updateRadar(window.latitude, window.longitude);
    }

    console.log("Position IGN :", item.fulltext,
        window.latitude,
        window.longitude
    );
}


    // ==============================
    // CLICK EXTERIEUR
    // ==============================

    document.addEventListener("click", e => {

        if (e.target !== input) {
            suggs.style.display = "none";
        }

    });


    // ==============================
    // TOUCHE ENTER
    // ==============================

    input.addEventListener("keydown", e => {

        if (e.key === "Enter" && window.lastResults.length) {
            selectLocation(window.lastResults[0]);
        }

    });

}


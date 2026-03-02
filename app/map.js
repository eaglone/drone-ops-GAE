/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION GIE PRO — PRODUCTION READY
 *
 * RADAR : Météo-France Package Radar v1 UNIQUEMENT
 *         /mosaique/paquet → application/gzip → décompression pako → PNG → L.imageOverlay
 *
 * TOKEN : injecté automatiquement par GitHub Actions (sed __METEO_FRANCE_API_KEY__)
 *         NE PAS modifier la ligne MF_TOKEN manuellement
 *
 * DÉPENDANCE HTML (avant ce script) :
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"></script>
 *
 * ORDRE COUCHES :
 *   1. OSM (fond)
 *   2. OACI IGN
 *   3. DGAC officiel IGN
 *   4. DGAC vecteur cliquable (option)
 *   5. Radar Météo-France
 *   6. OpenAIP (top)
 */

// =====================================================
// CONFIGURATION GLOBALE
// =====================================================

const GIE_CONFIG = {

    // ⚙️ Injecté par GitHub Actions — NE PAS modifier
    MF_TOKEN: "__METEO_FRANCE_API_KEY__",

    MF_BASE_URL: "https://public-api.meteofrance.fr/public/DPPaquetRadar/v1",

    ANIMATION_INTERVAL: 2000,   // ms entre frames
    REFRESH_INTERVAL:  300_000, // 5 min — rafraîchissement données
    RADAR_OPACITY:     0.72,

    // Bounds France Métropole pour L.imageOverlay
    FRANCE_BOUNDS: [[41.0, -5.5], [51.5, 10.0]],
};

// =====================================================
// ÉTAT GLOBAL
// =====================================================

let map            = null;
let positionMarker = null;
let osmLayer       = null;
let oaciLayer      = null;

const radarState = {
    layer:     null,
    frames:    [],     // [{time, objectUrl, name}]
    index:     0,
    timer:     null,
    isPlaying: true,
    ready:     false,
};

// =====================================================
// MÉTÉO-FRANCE — DÉCOMPRESSION GZIP → PNG → BLOB URLS
// =====================================================

async function fetchMFRadarFrames() {

    const res = await fetch(`${GIE_CONFIG.MF_BASE_URL}/mosaique/paquet`, {
        headers: {
            "Authorization": `Bearer ${GIE_CONFIG.MF_TOKEN}`,
            "Accept":        "application/gzip"
        },
        cache: "no-cache"
    });

    if (!res.ok) throw new Error(`MF API ${res.status} — ${res.statusText}`);

    const arrayBuffer = await res.arrayBuffer();
    const uint8       = new Uint8Array(arrayBuffer);

    // Décompression gzip
    let decompressed;
    try {
        decompressed = pako.inflate(uint8);
    } catch {
        decompressed = pako.ungzip(uint8);
    }

    // Cas 1 : résultat = PNG unique
    if (isPNG(decompressed)) {
        const blob = new Blob([decompressed], { type: "image/png" });
        return [{ time: new Date(), objectUrl: URL.createObjectURL(blob), name: "mosaique.png" }];
    }

    // Cas 2 : résultat = ZIP contenant plusieurs PNGs
    const files = parseZipEntries(decompressed);
    if (!files.length) throw new Error("MF: aucun fichier PNG dans le paquet");

    files.sort((a, b) => a.name.localeCompare(b.name));

    return files.map(f => ({
        time:      extractTimeFromFilename(f.name),
        objectUrl: URL.createObjectURL(new Blob([f.data], { type: "image/png" })),
        name:      f.name,
    }));
}

function isPNG(data) {
    return data[0] === 0x89 && data[1] === 0x50 &&
           data[2] === 0x4E && data[3] === 0x47;
}

function parseZipEntries(data) {
    const entries = [];
    let i = 0;

    while (i < data.length - 4) {
        // Local File Header signature: PK\x03\x04
        if (data[i] === 0x50 && data[i+1] === 0x4B &&
            data[i+2] === 0x03 && data[i+3] === 0x04) {

            const compressionMethod = data[i+8]  | (data[i+9]  << 8);
            const compressedSize    = data[i+18] | (data[i+19] << 8) | (data[i+20] << 16) | (data[i+21] << 24);
            const filenameLength    = data[i+26] | (data[i+27] << 8);
            const extraLength       = data[i+28] | (data[i+29] << 8);

            const filenameStart = i + 30;
            const filename      = new TextDecoder().decode(data.slice(filenameStart, filenameStart + filenameLength));
            const dataStart     = filenameStart + filenameLength + extraLength;
            const dataEnd       = dataStart + compressedSize;

            if (filename.toLowerCase().endsWith(".png")) {
                let fileData = data.slice(dataStart, dataEnd);
                if (compressionMethod === 8) {
                    try { fileData = pako.inflateRaw(fileData); } catch {}
                }
                entries.push({ name: filename, data: fileData });
            }

            i = dataEnd;
        } else {
            i++;
        }
    }
    return entries;
}

function extractTimeFromFilename(filename) {
    const match = filename.match(/(\d{8})T(\d{4})Z?/);
    if (match) {
        const [, date, time] = match;
        const iso = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${time.slice(0,2)}:${time.slice(2,4)}:00Z`;
        return new Date(iso);
    }
    return new Date();
}

function revokeMFFrames(frames) {
    frames.forEach(f => { if (f.objectUrl) URL.revokeObjectURL(f.objectUrl); });
}

// =====================================================
// INIT RADAR MF
// =====================================================

async function initMFRadar() {

    const token = GIE_CONFIG.MF_TOKEN;

    if (!token || token === "__METEO_FRANCE_API_KEY__") {
        throw new Error("Token MF non injecté — vérifiez votre secret GitHub et le workflow CI/CD");
    }

    if (typeof pako === "undefined") {
        throw new Error("pako non chargé — ajoutez le script pako dans votre HTML");
    }

    console.log("🇫🇷 Init Radar Météo-France — téléchargement paquet gzip…");

    const frames = await fetchMFRadarFrames();

    radarState.frames = frames;
    radarState.index  = 0;
    radarState.ready  = true;

    if (!radarState.layer) {
        radarState.layer = L.imageOverlay(
            frames[0].objectUrl,
            GIE_CONFIG.FRANCE_BOUNDS,
            {
                pane:        "weatherPane",
                opacity:     GIE_CONFIG.RADAR_OPACITY,
                interactive: false,
                attribution: "© Météo-France — Radar mosaïque officiel"
            }
        );
    } else {
        radarState.layer.setUrl(frames[0].objectUrl);
    }

    startRadarAnimation();
    updateRadarPanel();

    console.log(`✅ MF Radar prêt — ${frames.length} frame(s)`);
    return radarState.layer;
}

// =====================================================
// ANIMATION
// =====================================================

function startRadarAnimation() {

    if (radarState.timer) clearInterval(radarState.timer);

    radarState.timer     = setInterval(() => {
        if (radarState.layer && radarState.ready) stepRadar(1);
    }, GIE_CONFIG.ANIMATION_INTERVAL);

    radarState.isPlaying = true;
}

function stopRadarAnimation() {
    if (radarState.timer) { clearInterval(radarState.timer); radarState.timer = null; }
    radarState.isPlaying = false;
}

function stepRadar(direction = 1) {

    const { layer, frames } = radarState;
    if (!layer || !frames.length) return;

    radarState.index = (radarState.index + direction + frames.length) % frames.length;

    const FADE = 150;
    layer.setOpacity(0);
    setTimeout(() => {
        layer.setUrl(frames[radarState.index].objectUrl);
        setTimeout(() => { layer.setOpacity(GIE_CONFIG.RADAR_OPACITY); updateRadarPanel(); }, FADE);
    }, FADE);
}

// =====================================================
// AUTO-REFRESH (5 min)
// =====================================================

function startRadarAutoRefresh() {

    setInterval(async () => {
        console.log("🔄 Refresh radar Météo-France");
        try {
            const newFrames = await fetchMFRadarFrames();
            if (newFrames.length) {
                revokeMFFrames(radarState.frames);
                radarState.frames = newFrames;
                radarState.index  = 0;
                console.log(`✅ MF: ${newFrames.length} frame(s) rafraîchie(s)`);
            }
            updateRadarPanel();
        } catch (e) {
            console.warn("⚠️ Refresh MF échoué :", e.message);
        }
    }, GIE_CONFIG.REFRESH_INTERVAL);
}

// =====================================================
// PANNEAU DE CONTRÔLE RADAR — UI TACTIQUE GIE
// =====================================================

function getRadarFrameInfo() {

    const { frames, index, isPlaying, ready } = radarState;

    if (!ready || !frames.length) {
        return { time: "--:-- UTC", type: "CHARGEMENT…", isPlaying: false, total: 0, current: 0 };
    }

    const frame = frames[index];
    const t     = frame?.time;

    return {
        time:    t ? t.toUTCString().slice(5, 22) + " UTC" : "--:-- UTC",
        type:    "OFFICIEL MF",
        isPlaying,
        total:   frames.length,
        current: index + 1,
    };
}

function createRadarPanel() {

    const panel = document.createElement("div");
    panel.id    = "gie-radar-panel";

    Object.assign(panel.style, {
        position:       "fixed",
        bottom:         "24px",
        left:           "50%",
        transform:      "translateX(-50%)",
        background:     "linear-gradient(135deg, rgba(8,14,26,0.96) 0%, rgba(12,22,40,0.96) 100%)",
        border:         "1px solid rgba(56,189,248,0.25)",
        borderRadius:   "10px",
        padding:        "10px 18px",
        display:        "flex",
        alignItems:     "center",
        gap:            "14px",
        zIndex:         "9999",
        fontFamily:     "'JetBrains Mono', 'Fira Code', monospace",
        fontSize:       "11px",
        color:          "#e2e8f0",
        backdropFilter: "blur(12px)",
        boxShadow:      "0 4px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        userSelect:     "none",
        whiteSpace:     "nowrap",
    });

    const btn = (id, label, title, primary = false) => `
        <button id="${id}" title="${title}" style="
            background: ${primary ? "rgba(56,189,248,0.12)" : "transparent"};
            border: 1px solid rgba(56,189,248,0.2);
            color: #38bdf8; border-radius: 5px;
            padding: 4px 10px; cursor: pointer;
            font-family: inherit; font-size: 13px;
        " onmouseover="this.style.background='rgba(56,189,248,0.22)'"
           onmouseout="this.style.background='${primary ? "rgba(56,189,248,0.12)" : "transparent"}'"
        >${label}</button>`;

    panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:2px;min-width:130px;">
            <span style="font-size:9px;color:#22c55e;letter-spacing:1px;text-transform:uppercase;">Météo-France</span>
            <span id="gie-radar-type" style="font-weight:700;letter-spacing:1px;font-size:10px;color:#22c55e;">OFFICIEL MF</span>
        </div>
        <div style="width:1px;height:32px;background:rgba(56,189,248,0.15);"></div>
        ${btn("gie-prev", "◀", "Frame précédente")}
        ${btn("gie-play", "⏸", "Play / Pause", true)}
        ${btn("gie-next", "▶", "Frame suivante")}
        <div style="width:1px;height:32px;background:rgba(56,189,248,0.15);"></div>
        <div style="display:flex;flex-direction:column;gap:2px;align-items:flex-end;">
            <span id="gie-radar-timestamp" style="color:#94a3b8;letter-spacing:0.5px;">--:-- UTC</span>
            <span id="gie-radar-progress"  style="font-size:9px;color:#475569;">— / —</span>
        </div>
    `;

    panel.querySelector("#gie-prev").onclick = () => {
        stopRadarAnimation(); stepRadar(-1);
        panel.querySelector("#gie-play").textContent = "▶";
    };
    panel.querySelector("#gie-next").onclick = () => {
        stopRadarAnimation(); stepRadar(1);
        panel.querySelector("#gie-play").textContent = "▶";
    };
    panel.querySelector("#gie-play").onclick = () => {
        if (radarState.isPlaying) {
            stopRadarAnimation();
            panel.querySelector("#gie-play").textContent = "▶";
        } else {
            startRadarAnimation();
            panel.querySelector("#gie-play").textContent = "⏸";
        }
    };

    document.body.appendChild(panel);
    return panel;
}

function updateRadarPanel() {

    let panel = document.getElementById("gie-radar-panel");
    if (!panel) panel = createRadarPanel();

    const info = getRadarFrameInfo();
    const q    = id => panel.querySelector(id);

    const typeEl = q("#gie-radar-type");
    if (typeEl) typeEl.textContent = info.type;

    const tsEl = q("#gie-radar-timestamp");
    if (tsEl) tsEl.textContent = info.time;

    const progEl = q("#gie-radar-progress");
    if (progEl) progEl.textContent = info.total ? `${info.current} / ${info.total}` : "— / —";

    const playBtn = q("#gie-play");
    if (playBtn) playBtn.textContent = info.isPlaying ? "⏸" : "▶";
}

// =====================================================
// INIT MAP
// =====================================================

async function initMap() {

    if (!document.getElementById("map")) return;
    if (map) return;

    console.log("🗺️ Initialisation carte GIE Drone OPS");

    map = L.map("map", {
        zoomControl:  true,
        preferCanvas: true
    }).setView([
        window.latitude  || 48.783057,
        window.longitude || 2.213649
    ], 10);

    window.map = map;

    // ================= PANES

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;

    map.createPane("weatherPane");
    map.getPane("weatherPane").style.zIndex = 675;

    map.createPane("airspacePane");
    map.getPane("airspacePane").style.zIndex = 700;

    // ================= OSM BASE

    osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom:     19,
        attribution: "© OpenStreetMap"
    }).addTo(map);

    // ================= OACI IGN

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/private/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        { opacity: 0.7, maxZoom: 18, attribution: "© IGN — Carte OACI" }
    ).addTo(map);

    // ================= DGAC IGN OFFICIEL

    const dgacIgnLayer = L.tileLayer(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=TRANSPORTS.DRONES.RESTRICTIONS" +
        "&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
        { opacity: 0.75, attribution: "© IGN — Restrictions drones" }
    );

    // ================= OPENAIP

    window.openAipLayer = L.layerGroup([], { pane: "airspacePane" }).addTo(map);

    // ================= DGAC VECTEUR (optionnel)

    let dgacLayer = null;
    if (typeof window.loadDGACZones === "function") {
        try {
            dgacLayer = await window.loadDGACZones();
            console.log("✅ DGAC vecteur prêt");
        } catch (e) {
            console.warn("DGAC erreur", e);
        }
    }

    // ================= RADAR MF

    let radarLayer = null;
    try {
        radarLayer = await initMFRadar();
        if (radarLayer) radarLayer.addTo(map);
    } catch (e) {
        console.error("❌ Radar MF indisponible :", e.message);
        // Affiche un message d'erreur discret sur la carte
        const errDiv = document.createElement("div");
        errDiv.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:rgba(239,68,68,0.9);color:#fff;padding:6px 14px;border-radius:6px;font-size:11px;font-family:monospace;z-index:9999;";
        errDiv.textContent = `⚠️ Radar MF indisponible — ${e.message}`;
        document.body.appendChild(errDiv);
        setTimeout(() => errDiv.remove(), 8000);
    }

    // ================= CONTRÔLE COUCHES

    const baseMaps = { "Fond OSM": osmLayer };

    const overlays = {
        "Carte OACI IGN":          oaciLayer,
        "Restrictions drones IGN": dgacIgnLayer,
        "Espaces aériens OpenAIP": window.openAipLayer,
    };

    if (radarLayer) overlays["Radar Météo-France officiel"] = radarLayer;
    if (dgacLayer)  overlays["DGAC Zones cliquables"]       = dgacLayer;

    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

    // ================= AUTO-REFRESH + OPENAIP

    if (radarLayer) startRadarAutoRefresh();

    setTimeout(() => {
        if (typeof initOpenAIPAutoUpdate === "function") initOpenAIPAutoUpdate();
    }, 500);

    console.log("✅ MAP READY — radar: Météo-France");
}

// =====================================================
// UPDATE POSITION
// =====================================================

function updateMapPosition(lat, lon) {

    if (!map || !lat || !lon) return;

    map.flyTo([lat, lon], 11, { duration: 0.6 });

    if (positionMarker) map.removeLayer(positionMarker);

    positionMarker = L.circle([lat, lon], {
        radius:      500,
        color:       "#38bdf8",
        weight:      2,
        fillOpacity: 0.15
    }).addTo(map);

    if (typeof loadOpenAIPAirspaces === "function") loadOpenAIPAirspaces(lat, lon);
}

// =====================================================
// OPENAIP SUPPORT
// =====================================================

function setOpenAIPLayer(layer) {
    if (!window.openAipLayer) return;
    try {
        window.openAipLayer.clearLayers();
        if (layer) window.openAipLayer.addLayer(layer);
    } catch (e) {
        console.warn("OpenAIP layer error", e);
    }
}

// =====================================================
// EXPORT GLOBAL
// =====================================================

window.initMap           = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer   = setOpenAIPLayer;
window.radarState        = radarState;  // debug console
window.GIE_CONFIG        = GIE_CONFIG;  // accès config runtime

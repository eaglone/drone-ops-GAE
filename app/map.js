/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION GIE PRO — PRODUCTION READY
 *
 * RADAR ARCHITECTURE :
 *   PRIMARY  → Météo-France Package Radar v1
 *              /mosaique/paquet → application/gzip → décompression → PNG → L.imageOverlay
 *   FALLBACK → RainViewer (tiles animés, nowcast +20 min)
 *
 * TOKEN : injecté automatiquement par GitHub Actions (sed __METEO_FRANCE_API_KEY__)
 *         NE PAS modifier la ligne MF_TOKEN manuellement
 *
 * DÉPENDANCES EXTERNES (à inclure dans votre HTML avant ce script) :
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js"></script>
 *   → pako : décompression gzip côté navigateur
 *
 * ORDRE COUCHES :
 *   1. OSM (fond)
 *   2. OACI IGN
 *   3. DGAC officiel IGN
 *   4. DGAC vecteur cliquable (option)
 *   5. Radar météo (MF primaire ou RainViewer fallback)
 *   6. OpenAIP (top)
 */

// =====================================================
// CONFIGURATION GLOBALE
// =====================================================

const GIE_CONFIG = {

    // ⚙️ Injecté par GitHub Actions — NE PAS modifier
    MF_TOKEN: "__METEO_FRANCE_API_KEY__",

    MF_BASE_URL: "https://public-api.meteofrance.fr/public/DPPaquetRadar/v1",

    ANIMATION_INTERVAL: 2000,    // ms entre frames MF (données lourdes)
    REFRESH_INTERVAL:  300_000,  // 5 min — rafraîchissement données
    RADAR_OPACITY:     0.72,

    RV_FRAMES_PAST:   12,        // frames historiques RainViewer
    RV_FRAMES_FUTURE:  4,        // frames nowcast RainViewer

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
    source:    null,   // "meteofrance" | "rainviewer" | null
    layer:     null,
    mfFrames:  [],     // [{time, objectUrl}] — URLs blob PNG décompressées
    rvFrames:  [],     // RainViewer frames [{time, path, type}]
    index:     0,
    timer:     null,
    isPlaying: true,
};

// =====================================================
// MÉTÉO-FRANCE — DÉCOMPRESSION GZIP → PNG → BLOB URL
// =====================================================

/**
 * Télécharge le paquet gzip MF, décompresse avec pako,
 * extrait les fichiers PNG internes et retourne des blob URLs.
 *
 * Format du zip : fichiers nommés ex. "METROFR_LAME_20240301T1200Z.png"
 * On trie par nom (= chronologique) et on crée des object URLs.
 */
async function fetchMFRadarFrames() {

    const res = await fetch(`${GIE_CONFIG.MF_BASE_URL}/mosaique/paquet`, {
        headers: {
            "Authorization": `Bearer ${GIE_CONFIG.MF_TOKEN}`,
            "Accept": "application/gzip"
        },
        cache: "no-cache"
    });

    if (!res.ok) throw new Error(`MF API ${res.status} — ${res.statusText}`);

    // Récupération du buffer binaire gzip
    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Décompression gzip → données brutes (ZIP ou PNG unique)
    let decompressed;
    try {
        decompressed = pako.inflate(uint8);
    } catch (e) {
        // Parfois double-gzip, on tente ungzip
        decompressed = pako.ungzip(uint8);
    }

    // Cas 1 : le résultat est un PNG direct (mosaïque unique)
    if (isPNG(decompressed)) {
        const blob    = new Blob([decompressed], { type: "image/png" });
        const url     = URL.createObjectURL(blob);
        return [{ time: new Date(), objectUrl: url }];
    }

    // Cas 2 : le résultat est un ZIP contenant plusieurs PNGs
    // On parse le ZIP manuellement (structure ZIP locale)
    const files = parseZipEntries(decompressed);

    if (!files.length) throw new Error("MF: aucun fichier PNG dans le paquet");

    // Tri chronologique par nom de fichier
    files.sort((a, b) => a.name.localeCompare(b.name));

    // Conversion en blob URLs + extraction timestamp depuis le nom
    return files.map(f => ({
        time:      extractTimeFromFilename(f.name),
        objectUrl: URL.createObjectURL(new Blob([f.data], { type: "image/png" })),
        name:      f.name
    }));
}

/** Vérifie la magic bytes PNG */
function isPNG(data) {
    return data[0] === 0x89 && data[1] === 0x50 &&
           data[2] === 0x4E && data[3] === 0x47;
}

/**
 * Parse basique d'un ZIP pour extraire les entrées PNG.
 * Implémentation minimaliste — gère les ZIP non-chiffrés standard.
 */
function parseZipEntries(data) {

    const entries = [];
    let i = 0;

    while (i < data.length - 4) {

        // Signature Local File Header : PK\x03\x04
        if (data[i]     === 0x50 && data[i + 1] === 0x4B &&
            data[i + 2] === 0x03 && data[i + 3] === 0x04) {

            const compressionMethod = data[i + 8]  | (data[i + 9]  << 8);
            const compressedSize    = data[i + 18] | (data[i + 19] << 8) |
                                     (data[i + 20] << 16) | (data[i + 21] << 24);
            const filenameLength    = data[i + 26] | (data[i + 27] << 8);
            const extraLength       = data[i + 28] | (data[i + 29] << 8);

            const filenameStart = i + 30;
            const filename = new TextDecoder().decode(
                data.slice(filenameStart, filenameStart + filenameLength)
            );

            const dataStart = filenameStart + filenameLength + extraLength;
            const dataEnd   = dataStart + compressedSize;

            // On extrait uniquement les PNG
            if (filename.toLowerCase().endsWith(".png")) {
                let fileData = data.slice(dataStart, dataEnd);

                // Décompression si DEFLATE (méthode 8)
                if (compressionMethod === 8) {
                    try { fileData = pako.inflateRaw(fileData); } catch (e) {}
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

/**
 * Extrait un timestamp Date depuis le nom de fichier MF.
 * Format typique : QUELQUECHOSE_20240301T1200Z.png
 */
function extractTimeFromFilename(filename) {
    // Cherche un pattern YYYYMMDDTHHMMZ ou YYYYMMDD_HHMM
    const match = filename.match(/(\d{8})T(\d{4})Z?/);
    if (match) {
        const [, date, time] = match;
        const iso = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${time.slice(0,2)}:${time.slice(2,4)}:00Z`;
        return new Date(iso);
    }
    return new Date();
}

/**
 * Libère les blob URLs précédentes pour éviter les fuites mémoire.
 */
function revokeMFFrames(frames) {
    frames.forEach(f => {
        if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
    });
}

// =====================================================
// MÉTÉO-FRANCE — INIT
// =====================================================

async function initMFRadar() {

    const token = GIE_CONFIG.MF_TOKEN;

    if (!token || token === "__METEO_FRANCE_API_KEY__") {
        console.warn("⚠️ Token MF non injecté → fallback RainViewer");
        return false;
    }

    if (typeof pako === "undefined") {
        console.warn("⚠️ pako non chargé → fallback RainViewer");
        return false;
    }

    try {
        console.log("🇫🇷 Init Radar Météo-France — téléchargement paquet gzip…");

        const frames = await fetchMFRadarFrames();

        radarState.mfFrames = frames;
        radarState.source   = "meteofrance";
        radarState.index    = 0;

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
        return true;

    } catch (e) {
        console.warn("❌ MF Radar échoué :", e.message);
        return false;
    }
}

// =====================================================
// RAINVIEWER — FALLBACK MONDIAL
// =====================================================

function buildRVUrl(path) {
    // 512px / Titan color (6) / Smooth / Snow
    return `https://tilecache.rainviewer.com${path}/512/{z}/{x}/{y}/6/1_1.png`;
}

async function fetchRVFrames() {

    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
        cache: "no-cache"
    });

    if (!res.ok) throw new Error(`RainViewer API ${res.status}`);

    const data = await res.json();

    const past   = (data?.radar?.past    || []).slice(-GIE_CONFIG.RV_FRAMES_PAST)    .map(f => ({ ...f, type: "past"    }));
    const future = (data?.radar?.nowcast || []).slice(0, GIE_CONFIG.RV_FRAMES_FUTURE) .map(f => ({ ...f, type: "nowcast" }));

    return [...past, ...future];
}

async function initRainViewer() {

    console.log("🌧️ Init RainViewer (fallback)");

    const frames = await fetchRVFrames();
    if (!frames.length) throw new Error("RainViewer: aucune frame");

    radarState.rvFrames = frames;
    radarState.source   = "rainviewer";
    radarState.index    = 0;

    // On passe d'un imageOverlay (MF) à un tileLayer (RV)
    // → on recrée toujours la couche ici
    radarState.layer = L.tileLayer(buildRVUrl(frames[0].path), {
        pane:              "weatherPane",
        opacity:           GIE_CONFIG.RADAR_OPACITY,
        maxNativeZoom:     10,
        maxZoom:           18,
        keepBuffer:        8,
        updateWhenIdle:    true,
        updateWhenZooming: false,
        updateInterval:    200,
        detectRetina:      true,
        crossOrigin:       true,
        attribution:       "© RainViewer (fallback)"
    });

    startRadarAnimation();
    updateRadarPanel();

    console.log(`✅ RainViewer prêt — ${frames.length} frames`);
}

// =====================================================
// ANIMATION RADAR (commune MF + RainViewer)
// =====================================================

function startRadarAnimation() {

    if (radarState.timer) clearInterval(radarState.timer);

    radarState.timer     = setInterval(() => {
        if (radarState.layer) stepRadar(1);
    }, GIE_CONFIG.ANIMATION_INTERVAL);

    radarState.isPlaying = true;
}

function stopRadarAnimation() {
    if (radarState.timer) { clearInterval(radarState.timer); radarState.timer = null; }
    radarState.isPlaying = false;
}

function stepRadar(direction = 1) {

    const { source, layer } = radarState;
    if (!layer) return;

    const FADE = 150; // ms

    if (source === "meteofrance") {

        const frames = radarState.mfFrames;
        if (!frames.length) return;

        radarState.index = (radarState.index + direction + frames.length) % frames.length;

        layer.setOpacity(0);
        setTimeout(() => {
            layer.setUrl(frames[radarState.index].objectUrl);
            setTimeout(() => { layer.setOpacity(GIE_CONFIG.RADAR_OPACITY); updateRadarPanel(); }, FADE);
        }, FADE);

    } else if (source === "rainviewer") {

        const frames = radarState.rvFrames;
        if (!frames.length) return;

        radarState.index = (radarState.index + direction + frames.length) % frames.length;
        const frame      = frames[radarState.index];

        layer.setOpacity(0);
        setTimeout(() => {
            layer.setUrl(buildRVUrl(frame.path));
            setTimeout(() => {
                layer.setOpacity(
                    frame.type === "nowcast"
                        ? GIE_CONFIG.RADAR_OPACITY * 0.8
                        : GIE_CONFIG.RADAR_OPACITY
                );
                updateRadarPanel();
            }, FADE);
        }, FADE);
    }
}

// =====================================================
// INIT RADAR — MF primaire → RainViewer fallback
// =====================================================

async function initRadar() {

    try {
        const mfOk = await initMFRadar();
        if (!mfOk) await initRainViewer();
    } catch (e) {
        console.warn("MF échoué, tentative RainViewer :", e);
        try { await initRainViewer(); }
        catch (e2) { console.error("❌ Aucun radar disponible :", e2); }
    }

    return radarState.layer;
}

// =====================================================
// AUTO-REFRESH (5 min)
// =====================================================

function startRadarAutoRefresh() {

    setInterval(async () => {
        console.log(`🔄 Refresh radar [${radarState.source}]`);
        try {
            if (radarState.source === "meteofrance") {

                const newFrames = await fetchMFRadarFrames();
                if (newFrames.length) {
                    // Libération mémoire des anciens blobs
                    revokeMFFrames(radarState.mfFrames);
                    radarState.mfFrames = newFrames;
                    radarState.index    = 0;
                    console.log(`✅ MF: ${newFrames.length} frame(s) rafraîchie(s)`);
                }

            } else if (radarState.source === "rainviewer") {

                const frames = await fetchRVFrames();
                if (frames.length) {
                    radarState.rvFrames = frames;
                    radarState.index    = 0;
                }
            }

            updateRadarPanel();

        } catch (e) {
            console.warn("⚠️ Refresh radar échoué :", e);
        }

    }, GIE_CONFIG.REFRESH_INTERVAL);
}

// =====================================================
// PANNEAU DE CONTRÔLE RADAR — UI TACTIQUE GIE
// =====================================================

function getRadarFrameInfo() {

    const { source, index, mfFrames, rvFrames, isPlaying } = radarState;

    if (source === "meteofrance" && mfFrames.length) {
        const frame = mfFrames[index];
        const t     = frame?.time;
        return {
            time:      t ? t.toUTCString().slice(5, 22) + " UTC" : "--:-- UTC",
            type:      "OFFICIEL MF",
            typeColor: "#22c55e",
            source:    "Météo-France",
            isPlaying,
            total:     mfFrames.length,
            current:   index + 1,
        };
    }

    if (source === "rainviewer" && rvFrames.length) {
        const frame     = rvFrames[index];
        const isNowcast = frame?.type === "nowcast";
        return {
            time:      frame?.time
                ? new Date(frame.time * 1000).toUTCString().slice(5, 22) + " UTC"
                : "--:-- UTC",
            type:      isNowcast ? "▶ NOWCAST" : "◀ HISTORIQUE",
            typeColor: isNowcast ? "#f59e0b" : "#38bdf8",
            source:    "RainViewer (fallback)",
            isPlaying,
            total:     rvFrames.length,
            current:   index + 1,
        };
    }

    return {
        time: "--:-- UTC", type: "CHARGEMENT…", typeColor: "#64748b",
        source: "—", isPlaying: false, total: 0, current: 0
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
            <span id="gie-radar-source" style="font-size:9px;color:#64748b;letter-spacing:1px;text-transform:uppercase;">—</span>
            <span id="gie-radar-type"   style="font-weight:700;letter-spacing:1px;font-size:10px;">CHARGEMENT…</span>
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
    if (typeEl) { typeEl.textContent = info.type; typeEl.style.color = info.typeColor; }

    const srcEl = q("#gie-radar-source");
    if (srcEl) srcEl.textContent = info.source;

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

    // ================= RADAR (MF → RainViewer fallback)

    const radarLayer = await initRadar();
    if (radarLayer) radarLayer.addTo(map);

    // ================= CONTRÔLE COUCHES

    const baseMaps = { "Fond OSM": osmLayer };

    const overlays = {
        "Carte OACI IGN":          oaciLayer,
        "Restrictions drones IGN": dgacIgnLayer,
        "Espaces aériens OpenAIP": window.openAipLayer,
    };

    if (radarLayer) {
        overlays[radarState.source === "meteofrance"
            ? "Radar Météo-France officiel"
            : "Radar pluie animé (RainViewer)"
        ] = radarLayer;
    }

    if (dgacLayer) overlays["DGAC Zones cliquables"] = dgacLayer;

    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

    // ================= AUTO-REFRESH + OPENAIP

    startRadarAutoRefresh();

    setTimeout(() => {
        if (typeof initOpenAIPAutoUpdate === "function") initOpenAIPAutoUpdate();
    }, 500);

    console.log(`✅ MAP READY — radar: ${radarState.source || "aucun"}`);
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
window.radarState        = radarState;   // debug console
window.GIE_CONFIG        = GIE_CONFIG;   // accès config runtime

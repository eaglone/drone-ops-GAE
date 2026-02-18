// DGAC CACHE GLOBAL

const DGAC_DB_NAME = "dgacCacheDB";
const DGAC_STORE = "zones";

function openDGACDB() {
    return new Promise((resolve, reject) => {

        const req = indexedDB.open(DGAC_DB_NAME, 1);

        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(DGAC_STORE);
        };

        req.onsuccess = e => resolve(e.target.result);
        req.onerror = reject;
    });
}

window.saveDGAC = async function(data) {
    const db = await openDGACDB();
    const tx = db.transaction(DGAC_STORE, "readwrite");

    tx.objectStore(DGAC_STORE).put({
        timestamp: Date.now(),
        data
    }, "dgac");
};

window.loadDGAC = async function() {
    const db = await openDGACDB();

    return new Promise(resolve => {
        const tx = db.transaction(DGAC_STORE, "readonly");
        const req = tx.objectStore(DGAC_STORE).get("dgac");

        req.onsuccess = () => {
            const result = req.result;

            if (!result) return resolve(null);

            if (Date.now() - result.timestamp > 86400000)
                return resolve(null);

            resolve(result.data);
        };
    });
};

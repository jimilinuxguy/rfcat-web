export const RFCAT_DB_NAME = "rfcat-web";
export const RFCAT_DB_VERSION = 1;
export const RFCAT_DB_STORES = Object.freeze(["workspace"]);

export function openDatabase({
    name = RFCAT_DB_NAME,
    version = RFCAT_DB_VERSION,
    stores = RFCAT_DB_STORES,
} = {}) {
    return new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) return reject(new Error("IndexedDB unavailable"));
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = () => {
            const database = request.result;
            for (const store of stores) {
                if (!database.objectStoreNames.contains(store)) database.createObjectStore(store);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
    });
}

export async function getStoredValue(storeName, key, options = {}) {
    const database = await openDatabase(options);
    try {
        return await new Promise((resolve, reject) => {
            const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally {
        database.close();
    }
}

export async function putStoredValue(storeName, key, value, options = {}) {
    const database = await openDatabase(options);
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, "readwrite");
            transaction.objectStore(storeName).put(value, key);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

export async function deleteStoredValue(storeName, key, options = {}) {
    const database = await openDatabase(options);
    try {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(storeName, "readwrite");
            transaction.objectStore(storeName).delete(key);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

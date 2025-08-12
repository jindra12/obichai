import localforage from "localforage";
import persist from "node-persist";
import isBrowser from "is-browser";

let forage: LocalForage = null!;

const initStorage = () => {
    if (forage) {
        return forage;
    }
    if (!isBrowser) {
        localforage.defineDriver({
            _driver: "node-persist",
            _initStorage: () => {
                persist.init();
            },
            clear: async () => {
                await persist.clear();
            },
            getItem: async (key) => {
                return persist.getItem(key);
            },
            iterate: async (iteratee) => {
                const keys = await persist.keys();
                for (let i = 0; i < keys.length - 1; i++) {
                    const value = await persist.getItem(keys[i]!);
                    iteratee(value, keys[i]!, i);
                }
                const value = await persist.getItem(keys[keys.length - 1]!);
                return iteratee(value, keys[keys.length - 1]!, keys.length - 1);
            },
            key: async (index) => {
                const keys = await persist.keys();
                return keys[index]!
            },
            keys: async () => {
                return await persist.keys();
            },
            length: async () => {
                return (await persist.keys()).length;
            },
            removeItem: async (key) => {
                await persist.removeItem(key);
            },
            setItem: async (key, value) => {
                await persist.setItem(key, value);
                return value;
            },
        });
        return forage = localforage.createInstance({
            driver: "node-persist",
        });
    } else {
        return forage = localforage.createInstance({});
    }
}

export const Storage = {
    get instance() {
        return initStorage();
    }
};
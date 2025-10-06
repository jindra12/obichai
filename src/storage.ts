import localforage from "localforage";
import nodePersist from "node-persist";
import isBrowser from "is-browser";
import { get, set, keys, clear, del } from "idb-keyval";
import { queryByHash, registerResponse, unregisterResponse } from "./message";

let forage: LocalForage = null!;

const initStorage = () => {
    if (forage) {
        return forage;
    }
    const persist = isBrowser
        ? {
            init: () => {},
            getItem: (key: string) => get(key),
            setItem: <T>(key: string, value: T) => set(key, value),
            keys: async () => (await keys()).map(k => k.toString()),
            removeItem: (key: string) => del(key),
            clear: () => clear(),
        }
        : nodePersist;
    localforage.defineDriver({
        _driver: "persist",
        _initStorage: () => {
            persist.init();
        },
        clear: async () => {
            await persist.clear();
        },
        getItem: async (key) => {
            const item = persist.getItem(key)
            if (!item) {
                const fromApi = await queryByHash(Buffer.from(key, "base64"));
                if (fromApi) {
                    const value = fromApi.toString("base64");
                    await persist.setItem(key, value);
                    return value;
                }
            }
            return item;
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
            unregisterResponse(key);
            await persist.removeItem(key);
        },
        setItem: async (key, value) => {
            await persist.setItem(key, value);
            registerResponse(key, async () => Buffer.from(await persist.getItem(key) as string, "base64"));
            return value;
        },
    });
    return forage = localforage.createInstance({
        driver: "persist",
    });
}

export const Storage = {
    get instance() {
        return initStorage();
    }
};
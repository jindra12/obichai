import { get, ExtractObjectPaths } from "typedots";
import { Type } from "avsc";
import { sha256CompactKey } from "./utils";
import { Storage } from "./storage";
import { getArgon } from "./argon";
import { MainBlockType } from "./types";
import { mainBlockType } from "./serializer";
import { Throw } from "throw-expression";

export const makeIndex = <T extends {}>(obj: T, properties: ExtractObjectPaths<T>[]) => {
    return sha256CompactKey(properties.map(p => get(obj, p)));
};

const incrementKey = async (key: string) => {
    const current = BigInt((await Storage.instance.getItem(key)) || '0');
    await Storage.instance.setItem(key, (current + 1n).toString());
    return current;
};

const decrementKey = async (key: string) => {
    const current = BigInt((await Storage.instance.getItem(key)) || '0');
    if (current === 0n) {
        Throw(`${key} cannot be decremented`);
    }
    await Storage.instance.setItem(key, (current - 1n).toString());
    return current;
};

const addIndexToKey = (index: bigint, hash: string) => sha256CompactKey([index.toString(), hash]);

export const pushItems = async <T extends {} = Record<string, string>>(
    objs: Buffer[],
    serializer: Type,
    properties: ExtractObjectPaths<T>[],
    mainBlockHash: Buffer,
    type: Buffer,
    index: bigint,
) => {
    const storage = Storage.instance;
    for (let i = 0; i < objs.length; i++) {
        const obj = objs[i]!;
        const deser: Record<string, object> = serializer.fromBuffer(obj);
        const hash = sha256CompactKey(obj);
        
        const latestKey = makeIndex(deser, properties);
        const hashKey = sha256CompactKey(
            Buffer.concat([mainBlockHash, type])
        );
        const indexKey = sha256CompactKey(
            Buffer.concat([Buffer.from(`0x${index.toString(16)}`), type])
        );
        const [
            latestIndex,
            hashIndex,
            countIndex,
        ] = await Promise.all([
            (async () => addIndexToKey(await incrementKey(latestKey), latestKey))(),
            (async () => addIndexToKey(await incrementKey(hashKey), hashKey))(),
            (async () => addIndexToKey(await incrementKey(indexKey), indexKey))(),
        ]);
        await Promise.all([
            storage.setItem(hash, obj.toString("base64")),
            storage.setItem(latestIndex, hash),
            storage.setItem(hashIndex, hash),
            storage.setItem(countIndex, hash),
        ]);
    }
};

export const popItems = async <T extends {} = Record<string, string>>(
    objs: Buffer[],
    serializer: Type,
    properties: ExtractObjectPaths<T>[],
    mainBlockHash: Buffer,
    type: Buffer,
    index: bigint,
) => {
   const storage = Storage.instance;
    for (let i = 0; i < objs.length; i++) {
        const obj = objs[i]!;
        const deser: Record<string, object> = serializer.fromBuffer(obj);
        const hash = sha256CompactKey(obj);
        const latestKey = makeIndex(deser, properties);
        const hashKey = sha256CompactKey(
            Buffer.concat([mainBlockHash, type])
        );
        const indexKey = sha256CompactKey(
            Buffer.concat([Buffer.from(`0x${index.toString(16)}`), type])
        );
        const [
            latestIndex,
            hashIndex,
            countIndex,
        ] = await Promise.all([
            (async () => addIndexToKey(await decrementKey(latestKey), latestKey))(),
            (async () => addIndexToKey(await decrementKey(hashKey), hashKey))(),
            (async () => addIndexToKey(await decrementKey(indexKey), indexKey))(),
        ]);
        await Promise.all([
            storage.removeItem(hash),
            storage.removeItem(latestIndex),
            storage.removeItem(hashIndex),
            storage.removeItem(countIndex),
        ]);
    }
}

export const getBlockHashes = async (blocks: Buffer[]) => {
    const lastHash = await getArgon(blocks[blocks.length - 1]!)
    const hashes: Buffer[] = [];
    for (let i = 1; i < blocks.length; i++) {
        const block: MainBlockType = mainBlockType.fromBuffer(blocks[i]!);
        hashes.push(block.prevHash)
    }
    hashes.push(lastHash);
    return hashes;
};

export const storeMainBlocks = async (blocks: Buffer[]) => {
    const storage = Storage.instance;
    const hashes = await getBlockHashes(blocks);
    for (let i = 0; i < blocks.length; i++) {
        await storage.setItem(hashes[i]!.toString("base64"), blocks[i]!.toString("base64"));
    }
    return hashes;
};

export const getLatestItem = async <T extends {}>(obj: Buffer, serializer: Type, properties: ExtractObjectPaths<T>[]): Promise<T> => {
    const deser: Record<string, object> = serializer.fromBuffer(obj);
    const latestKey = makeIndex(deser, properties);
    const index = BigInt((await Storage.instance.getItem(latestKey)) || '0');
    const itemKey = addIndexToKey(index, latestKey);
    const hash = await Storage.instance.getItem(itemKey) as string;
    const item = await Storage.instance.getItem(hash) as string;
    const buffer = Buffer.from(item, "base64");
    return serializer.fromBuffer(buffer);
};

const getItems = async <T extends {}>(key: string, serializer: Type): Promise<T[]> => {
    const length = BigInt((await Storage.instance.getItem(key)) || '0');
    const promises: Promise<T>[] = [];
    for (let i = 0n; i < length; i++) {
        promises.push(new Promise<T>(async (resolve) => {
            const itemHash = addIndexToKey(i, key);
            const hash = await Storage.instance.getItem(itemHash) as string;
            const buffer = Buffer.from(await Storage.instance.getItem(hash) as string, "base64");
            resolve(serializer.fromBuffer(buffer));
        }));
    }
    return Promise.all(promises);
};

export const getItemsByIndex = async <T extends {}>(index: bigint, type: Buffer, serializer: Type): Promise<T[]> => {
    const indexKey = sha256CompactKey(
        Buffer.concat([Buffer.from(`0x${index.toString(16)}`), type])
    );
    return await getItems(indexKey, serializer);
};

export const getItemsByBlock = async <T extends {}>(blockHash: Buffer, type: Buffer, serializer: Type): Promise<T[]> => {
    const indexKey = sha256CompactKey(
        Buffer.concat([blockHash, type])
    );
    return await getItems(indexKey, serializer);
};

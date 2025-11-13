import { get, ExtractObjectPaths } from "typedots";
import { Type } from "avsc";
import { compareBuffers, sha256CompactKey } from "./utils";
import { Storage } from "./storage";
import { getArgon } from "./argon";
import { MainBlockType, MessageFormat, PaddingFormat, TransactionWithMetadata } from "./types";
import { mainBlockType, messageType, paddingArray, transactionWithMetadata } from "./serializer";
import { Throw } from "throw-expression";
import { Types } from "./dynamic-types";

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

export const getBlock = async (hash: string | Buffer): Promise<MainBlockType> => {
    const key = typeof hash === "string" ? hash : hash.toString("base64");
    return mainBlockType.fromBuffer(Buffer.from(await Storage.instance.getItem(key) as string, "base64"));
};

export const getItemByHash = async <T>(hash: Buffer, index: bigint): Promise<null | { item: T, type: Type }> => {
    const key = hash.toString("base64");
    const withMetadata = Buffer.from(await Storage.instance.getItem(key) as string, "base64");
    const deserialized: TransactionWithMetadata = transactionWithMetadata.fromBuffer(withMetadata);
    if (deserialized.index !== index) {
        return null;
    }
    const message: MessageFormat = messageType.fromBuffer(deserialized.transaction);
    const { schema } = await (await Types.instance).getTypeFromShort(message.to);
    return {
        item: schema.fromBuffer(message.data) as T,
        type: schema,
    };
};

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
        const withMetadata: TransactionWithMetadata = {
            blockHash: mainBlockHash,
            index,
            transaction: obj,
        };
        const withMetadataBuffer = transactionWithMetadata.toBuffer(withMetadata);
        const transactionObj: MessageFormat = messageType.fromBuffer(obj);
        const deser: Record<string, object> = serializer.fromBuffer(transactionObj.data);
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
            storage.setItem(hash, withMetadataBuffer.toString("base64")),
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
        const withMetadata: TransactionWithMetadata = transactionWithMetadata.fromBuffer(obj);
        const transactionObj: MessageFormat = messageType.fromBuffer(withMetadata.transaction);
        const deser: Record<string, object> = serializer.fromBuffer(transactionObj.data);
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
        hashes.push(block.prevHash);
    }
    hashes.push(lastHash);
    return hashes;
};

export const storeMainBlocks = async (blocks: Buffer[]) => {
    const storage = Storage.instance;
    const hashes = await getBlockHashes(blocks);
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!;
        const blockType: MainBlockType = mainBlockType.fromBuffer(block);
        const base64 = hashes[i]!.toString("base64");
        await storage.setItem(sha256CompactKey(["MainBlock", blockType.id.toString()]), base64)
        await storage.setItem(base64, block.toString("base64"));
        const latestBlock = await storage.getItem("latestBlock") as string;
        if (!latestBlock) {
            
        }
    }
    return hashes;
};

export const getBlockById = async (blockIndex: bigint): Promise<MainBlockType> => {
    const storage = Storage.instance;
    const base64 = await storage.getItem(sha256CompactKey(["MainBlock", blockIndex.toString()])) as string;
    return mainBlockType.fromBuffer(Buffer.from((await storage.getItem(base64)) as string, "base64"));
};

export const getSmallPadding = async (blockHash: Buffer, type: Buffer) => {
    const hash = sha256CompactKey(
        Buffer.concat([
            Buffer.from("padding", "utf-8"), 
            blockHash,
            type,
        ])
    );
    return paddingArray.fromBuffer(
        Buffer.from(await Storage.instance.getItem(hash) as string, "base64"),
    );
};


export const storeSmallPadding = async (blockHash: Buffer, type: Buffer, padding: PaddingFormat[]) => {
    const hash = sha256CompactKey(
        Buffer.concat([
            Buffer.from("padding", "utf-8"), 
            blockHash,
            type,
        ])
    );
    await Storage.instance.setItem(hash, paddingArray.toBuffer(padding).toString("base64"));
};

export const getLatestItem = async <T extends {}>(
    obj: Buffer,
    serializer: Type,
    properties: ExtractObjectPaths<T>[]
): Promise<{ latest: T, blockIndex: bigint, latestKey: string }> => {
    const withMetadataEntry: TransactionWithMetadata = transactionWithMetadata.fromBuffer(obj);
    const transactionEntry: MessageFormat = messageType.fromBuffer(withMetadataEntry.transaction);
    const deser: Record<string, object> = serializer.fromBuffer(transactionEntry.data);
    const latestKey = makeIndex(deser, properties);
    const index = BigInt((await Storage.instance.getItem(latestKey)) || '0');
    const itemKey = addIndexToKey(index, latestKey);
    const hash = await Storage.instance.getItem(itemKey) as string;
    const item = await Storage.instance.getItem(hash) as string;
    const withMetadata: TransactionWithMetadata = transactionWithMetadata.fromBuffer(Buffer.from(item, "base64"));
    const transactionWithObject: MessageFormat = messageType.fromBuffer(withMetadata.transaction);
    return {
        latest: serializer.fromBuffer(transactionWithObject.data),
        blockIndex: withMetadata.index,
        latestKey,
    };
};

const getItems = async <T extends {}>(key: string, type: Buffer, serializer: Type): Promise<T[]> => {
    const length = BigInt((await Storage.instance.getItem(key)) || '0');
    const promises: Promise<T | undefined>[] = [];
    for (let i = 0n; i < length; i++) {
        promises.push(new Promise<T | undefined>(async (resolve) => {
            const itemHash = addIndexToKey(i, key);
            const hash = await Storage.instance.getItem(itemHash) as string;
            const buffer = Buffer.from(await Storage.instance.getItem(hash) as string, "base64");
            const withMetadata: TransactionWithMetadata = transactionWithMetadata.fromBuffer(buffer);
            const transactionWithObject: MessageFormat = messageType.fromBuffer(withMetadata.transaction);
            if (compareBuffers(transactionWithObject.to, type.subarray(0, transactionWithObject.to.length))) {
                resolve(undefined);
            }
            resolve(serializer.fromBuffer(transactionWithObject.data));
        }));
    }
    return (await Promise.all(promises)).filter((value: T | undefined): value is T => Boolean(value)) as T[];
};

export const getItemsByIndex = async <T extends {}>(index: bigint, type: Buffer, serializer: Type): Promise<T[]> => {
    const indexKey = sha256CompactKey(
        Buffer.concat([Buffer.from(`0x${index.toString(16)}`), type])
    );
    return await getItems(indexKey, type, serializer);
};

export const getItemsByBlock = async <T extends {}>(blockHash: Buffer, type: Buffer, serializer: Type): Promise<T[]> => {
    const indexKey = sha256CompactKey(
        Buffer.concat([blockHash, type])
    );
    return await getItems(indexKey, type, serializer);
};

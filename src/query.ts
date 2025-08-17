import { NUMBER_OF_TRANSACTIONS } from "./constants";
import { createMerkle, verifyMerkleProof } from "./merkle";
import { mainBlockType } from "./serializer";
import { Storage } from "./storage";
import { MainBlockType, MultiBlockQueriesType, QueriesType } from "./types";
import { compareBuffers, sha256CompactKey } from "./utils";

export const storeMainBlocks = async (blocks: Buffer[]) => {
    const storage = Storage.instance;
    const pairs = blocks.map(block => [sha256CompactKey(block), block] as const);
    await Promise.all(pairs.map(async ([key, value]) => storage.setItem(key, value.toString("base64"))));
    return pairs.map(([key]) => key);
};

export const getBlock = async (hash: string | Buffer) => {
    const key = typeof hash === "string" ? hash : hash.toString("base64");
    return Buffer.from(await Storage.instance.getItem(key) as string, "base64");
};

export const getHash = (block: Buffer | MainBlockType) => {
    return sha256CompactKey(Buffer.isBuffer(block) ? block : mainBlockType.toBuffer(block));
};

export const validateQuery = (block: MainBlockType, queries: QueriesType) => {
    if (getHash(block) !== queries.hash.toString("base64")) {
        return false;
    }
    for (let i = 0; i < queries.results.length; i++) {
        const blob = block.blobs[i]!;
        const query = queries.results[i]!;
        if (compareBuffers(query.type, blob.type) !== 0) {
            return false;
        }
        const full = query.queries.length === NUMBER_OF_TRANSACTIONS;
        if (full) {
            if (compareBuffers(blob.merkle, createMerkle(query.queries.map(q => q.transaction)).root) !== 0) {
                return false;
            }
        } else {
            if (query.queries.some(q => !verifyMerkleProof(blob.merkle, { positive: { leaf: q.transaction, proof: q.proof } }))) {
                return false;
            }
        }
    }
    return true;
};

export const validateMultiBlockQuery = async (multiQuery: MultiBlockQueriesType) => {
    const storage = Storage.instance;
    const blocks = await Promise.all(multiQuery.queries.map(async q => storage.getItem(q.hash.toString("base64")) as Promise<string>));
    const mains: MainBlockType[] = blocks.map(b => mainBlockType.fromBuffer(Buffer.from(b, "base64")));
    for (let i = 0; i < mains.length; i++) {
        if (!validateQuery(mains[i]!, multiQuery.queries[i]!)) {
            return false;
        }
    }
    return true;
};

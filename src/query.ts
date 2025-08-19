import { getArgon, verifyArgon } from "./argon";
import { NUMBER_OF_BLOBS, NUMBER_OF_TRANSACTIONS } from "./constants";
import { getDifficulty } from "./difficulty";
import { Types } from "./dynamic-types";
import { storeItems } from "./indexer";
import { createMerkle, verifyMerkleProof } from "./merkle";
import { blobHashType, mainBlockType, paddingType } from "./serializer";
import { Storage } from "./storage";
import { MainBlockType, MultiBlockQueriesType, PaddingFormat, QueriesType } from "./types";
import { blobSha256, compareBuffers } from "./utils";

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

export const getBlock = async (hash: string | Buffer) => {
    const key = typeof hash === "string" ? hash : hash.toString("base64");
    return Buffer.from(await Storage.instance.getItem(key) as string, "base64");
};

export const storeQueries = async (
    queries: QueriesType,
) => {
    const types = await Types.instance;
    for (let i = 0; i < queries.results.length; i++) {
        const result = queries.results[i]!;
        const {
            schema,
            query,
        } = await types.getType(result.type);
        const items: Buffer[] = [];
        for (let j = 0; j < result.queries.length; j++) {
            items.push(result.queries[j]!.transaction);
        }
        await storeItems(items, schema, query);
    }
};

export const validateQuery = async (
    block: MainBlockType,
    queries: QueriesType,
) => {
    for (let i = 0; i < queries.results.length; i++) {
        const blob = block.blobs[i]!;
        const query = queries.results[i]!;
        if (compareBuffers(query.type, blob.type) !== 0) {
            return false;
        }
        const full = query.queries.length === NUMBER_OF_TRANSACTIONS;
        const hashes = await blobSha256(query.queries.map(q => q.transaction));
        if (full) {
            if (compareBuffers(blob.merkle, createMerkle(hashes).root) !== 0) {
                return false;
            }
        } else {
            if (query.queries.some((q, i) => !verifyMerkleProof(blob.merkle, { positive: { leaf: hashes[i]!, proof: q.proof } }))) {
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

export const validatePadding = async (paddings: Buffer[], hash: Buffer, type: "PADDING_BIG" | "PADDING_SMALL") => {
    const difficulty = await getDifficulty(type);
    for (let i = 0; i < paddings.length; i++) {
        const padding: PaddingFormat = paddingType.fromBuffer(paddings[i]!);
        if (padding.index !== BigInt(i)) {
            return false;
        }
        if (compareBuffers(padding.hash, hash) !== 0) {
            return false;
        }
        const [isValid] = await verifyArgon(paddings[i]!, type, difficulty);
        if (!isValid) {
            return false;
        }
    }
    return true;
};

export const validateMainDifficulty = async (block: Buffer, prevHash?: Buffer, prevId?: bigint) => {
    const parsed: MainBlockType = mainBlockType.fromBuffer(block);
    if (prevHash && compareBuffers(prevHash, parsed.prevHash) !== 0) {
        return [false] as const;
    }
    if (prevId && prevId + 1n !== parsed.id) {
        return [false] as const;
    }

    const main = await getDifficulty("MAIN");
    const [isValid, nextBlock, nextHash] = await verifyArgon(block, "MAIN", main);
    
    if (!isValid) {
        return [false] as const;
    }
    if (parsed.blobs.length + parsed.padding.length !== NUMBER_OF_BLOBS) {
        return [false] as const;
    }
    if (!validatePadding(parsed.padding.map(p => paddingType.toBuffer(p)), parsed.prevHash, "PADDING_BIG")) {
        return [false] as const;
    }
    for (let i = 0; i < parsed.blobs.length; i++) {
        const blob = parsed.blobs[i]!;
        const [isValid] = await getArgon(blobHashType.toBuffer(blob));
        if (!isValid) {
            return [false] as const;
        }
    }
    return [isValid, nextBlock, nextHash] as const;
};

export const validateMainsDifficulty = async (blocks: Buffer[]) => {
    let prevHash: Buffer = undefined!;
    let prevId: bigint = undefined!;
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!;
        const [isValid, parsed, hash] = await validateMainDifficulty(
            block, prevHash, prevId
        );
        if (!isValid) {
            return false;
        }
        prevId = parsed.id;
        prevHash = hash;
    }
    return true;
};

export const parallelValidation = async (
    blocks: Buffer[],
    splitBy: number,
    validate: (blocks: Buffer[], index: number) => Promise<boolean>,
) => {
    const splits: Buffer[][] = [];
    const add = (block: Buffer) => {
        if (splits.length === 0) {
            splits.push([block]);
        } else {
            const last = splits[splits.length - 1]!;
            if (last.length === splitBy) {
                splits.push([block]);
            } else {
                last.push(block);
            }
        }
    };
    blocks.forEach(add);
    for (let i = 1; i < splits.length; i++) {
        const prev = splits[i - 1]!;
        const current = splits[i]!;
        const first = prev[prev.length - 1]!;
        const second = current[0]!;
        if (!await validateMainsDifficulty([first, second])) {
            return false;
        }
    }
    return (await Promise.all(splits.map((b, i) => validate(b, i)))).every(Boolean);
};
import groupBy from "lodash/groupBy";
import { getArgon, verifyArgon } from "./argon";
import { BIG_PADDING_COEFF, NUMBER_OF_BLOBS, NUMBER_OF_TRANSACTIONS, SMALL_PADDING_COEFF } from "./constants";
import { getDifficulty } from "./difficulty";
import { Types } from "./dynamic-types";
import { getBlock, getLatestItem, pushItems } from "./indexer";
import { createMerkle, verifyMerkleProof } from "./merkle";
import { blobHashType, mainBlockType, messageType, paddingArray, paddingType } from "./serializer";
import { Storage } from "./storage";
import { MainBlockType, MultiBlockQueriesType, PaddingFormat, QueriesType, MessageFormat } from "./types";
import { blobSha256, compareBuffers, sha256CompactKey } from "./utils";
import { validator } from "./validator";
import { verifySignature } from "./wallet";
import { get } from "typedots";

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
        await pushItems(
            items,
            schema,
            query,
            queries.hash,
            result.type,
            queries.index,
        );
    }
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

export const validatePadding = async (paddings: (PaddingFormat | Buffer)[], hash: Buffer, type: "PADDING_BIG" | "PADDING_SMALL") => {
    const difficulty = await getDifficulty(type);
    for (let i = 0; i < paddings.length; i++) {
        const item = paddings[i]!;
        const padding: PaddingFormat = Buffer.isBuffer(item) ? paddingType.fromBuffer(item) : item;
        if (padding.index !== BigInt(i)) {
            return false;
        }
        padding.hash = hash;
        const [isValid] = await verifyArgon(paddingType.toBuffer(padding), type, difficulty);
        if (!isValid) {
            return false;
        }
    }
    return true;
};

export const validateQueriesContent = async (queries: QueriesType) => {
    const block = await getBlock(queries.hash);
    const prev = await getBlock(block.prevHash);
    const types = await Types.instance;
    for (let i = 0; i < queries.results.length; i++) {
        const results = queries.results[i]!;
        const type = results.type;
        const {
            query,
            rules,
            schema,
            unique,
        } = await types.getType(type);
        const objs = await Promise.all(results.queries.map(async q => {
            const message: MessageFormat = messageType.fromBuffer(q.transaction);
            return schema.fromBuffer(message.data);
        }));
        for (let j = 0; j < unique.length; j++) {
            const prop = unique[j]!;
            const grouped = groupBy(objs, obj => (get as any)(obj, prop));
            if (!Object.values(grouped).every(g => g.length === 1)) {
                return false;
            }
        }
        for (let j = 0; j < results.queries.length; j++ ) {
            const result = results.queries[j]!;
            const latest = await getLatestItem<Record<string, object>>(
                result.transaction,
                schema,
                query,
            );
            const message: MessageFormat = messageType.fromBuffer(result.transaction);
            const validated = await validator({
                block: block,
                prev: prev,
                current: objs[j]!,
                queried: latest,
                signer: message.from,
            }, rules);
            if (!validated) {
                return false;
            }
        }
    }
    return true;
};

export const validateQueriesSignature = async (
    queries: QueriesType,
) => {
    const transactions = queries.results.flatMap(r => r.queries).map(q => Buffer.concat([q.signature, q.transaction]));
    for (let i = 0; i < transactions.length; i++) {
        const { valid } = await verifySignature(transactions[i]!);
        if (!valid) {
            return false;
        }
    }
    return true;
}

export const validateQuery = async (
    block: MainBlockType,
    queries: QueriesType,
    type: "partial" | "full"
) => {
    if (!validateQueriesSignature(queries)) {
        return false;
    }
    for (let i = 0; i < queries.results.length; i++) {
        const blob = block.blobs[i]!;
        const query = queries.results[i]!;
        if (compareBuffers(query.type, blob.type) !== 0) {
            return false;
        }
        const hashes = await blobSha256(query.queries.map(q => q.transaction));
        const isFull = type === "full";
        if (isFull) {
            if (query.padding.length * SMALL_PADDING_COEFF + query.queries.length < NUMBER_OF_TRANSACTIONS) {
                return false;
            }
            if (!await validatePadding(query.padding, block.prevHash, "PADDING_SMALL")) {
                return false;
            }
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

export const validateMultiBlockQuery = async (multiQuery: MultiBlockQueriesType, type: "partial" | "full") => {
    const storage = Storage.instance;
    const blocks = await Promise.all(multiQuery.queries.map(async q => storage.getItem(q.hash.toString("base64")) as Promise<string>));
    const mains: MainBlockType[] = blocks.map(b => mainBlockType.fromBuffer(Buffer.from(b, "base64")));
    for (let i = 0; i < mains.length; i++) {
        if (!validateQuery(mains[i]!, multiQuery.queries[i]!, type)) {
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
    if (parsed.blobs.length + parsed.padding.length * BIG_PADDING_COEFF < NUMBER_OF_BLOBS) {
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
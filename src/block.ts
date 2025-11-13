import { getArgon, verifyArgon } from "./argon";
import { createBloom } from "./bloom";
import { BIG_PADDING_COEFF, NUMBER_OF_BLOBS } from "./constants";
import { computeDifficulty, getDifficulty } from "./difficulty";
import { Types } from "./dynamic-types";
import { makeIndex } from "./indexer";
import { createMerkle } from "./merkle";
import { createPadding, verifyPadding } from "./padding";
import { blobHashType, mainBlockType } from "./serializer";
import { BlobHashType, MainBlockType, QueriesType } from "./types";
import { compareBuffers } from "./utils";

export const manufactureBlock = async (
    prevBlock: MainBlockType,
    transactions: QueriesType,
    author: Buffer,
) => {
    const prevHash = await getArgon(mainBlockType.toBuffer(prevBlock));
    const types = await Types.instance;
    const blobCount = transactions.results.length;
    const paddingCount = (NUMBER_OF_BLOBS - blobCount) / BIG_PADDING_COEFF;
    const block: MainBlockType = {
        author,
        blobs: await Promise.all(transactions.results.map(async r => {
            const {
                schema,
                query,
            } = await types.getType(r.type);
            const latestKeys = r.queries.map(q => {
                const latestKey = makeIndex<Record<string, object>>(schema.fromBuffer(q.transaction), query);
                return Buffer.from(latestKey, "base64");
            });
            const blob: BlobHashType = {
                author: r.author,
                bloom: createBloom(latestKeys),
                difficulty: r.difficulty,
                merkle: {
                    includes: createMerkle(r.queries.map(q => q.transaction)).root,
                    query: createMerkle(latestKeys).root,
                },
                type: r.type,
            };
            return blob;
        })),
        id: prevBlock.id + 1n,
        limit: Buffer.from(`0x${(await getDifficulty("MAIN")).toString(16)}`, "hex"),
        padding: await createPadding(prevHash, paddingCount, "PADDING_BIG"),
        prevHash,
        timestamp: BigInt(Date.now()),
        difficulty: Buffer.from("0x1", "hex"),
    };
    const computed = await computeDifficulty(mainBlockType.toBuffer(block), "MAIN");
    if (!computed) {
        throw new Error("Could not compute block");
    }
    return computed;
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
    const paddingCount =  (NUMBER_OF_BLOBS - parsed.blobs.length) / BIG_PADDING_COEFF;
    const [isValid, nextBlock, nextHash] = await verifyArgon(block, "MAIN", main);
    
    if (!isValid) {
        return [false] as const;
    }
    if (parsed.blobs.length + parsed.padding.length * BIG_PADDING_COEFF < NUMBER_OF_BLOBS) {
        return [false] as const;
    }
    if (!await verifyPadding(parsed.prevHash, paddingCount, parsed.padding, "PADDING_BIG")) {
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
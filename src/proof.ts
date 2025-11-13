import { getBlockById, getItemsByIndex, getLatestItem, makeIndex } from "./indexer";
import { Types } from "./dynamic-types";
import { compareBuffers } from "./utils";
import { verifyBloom } from "./bloom";
import { NegativeProof, PositiveProof } from "./types";
import { createMerkleProof, verifyMerkleProof } from "./merkle";

export const verifyInclusionProof = async (
    negatives: NegativeProof[],
    positive: PositiveProof,
    blockIndex: bigint,
    current: Buffer,
    type: Buffer,
    currentIndex: bigint,
) => {
    const instance = await Types.instance;
    const {
        query,
        schema,
    } = await instance.getType(type);
    const latestKey = makeIndex<Record<string, object>>(schema.fromBuffer(current), query);
    const indexedBlock = await getBlockById(blockIndex);
    const blob = indexedBlock.blobs.find(blob => compareBuffers(blob.type, type) === 0);
    if (!blob) {
        return {
            success: false,
            message: "Blob not found",
        };
    }
    if (!verifyMerkleProof(blob.merkle.query, { positive })) {
        return {
            success: false,
            message: "Merkle proof inclusion failed",
        };
    }
    let negationIndex = 0;
    for (let i = blockIndex + 1n; i < currentIndex; i++) {
        const block = await getBlockById(i);
        const blob = block.blobs.find(blob => compareBuffers(blob.type, type) === 0);
        if (blob && verifyBloom(blob.bloom, latestKey)) {
            const negative = negatives[negationIndex];
            if (!negative) {
                return {
                    success: false,
                    message: `Could not find ${i}th non-inclusion proof`,
                };
            }
            const isNotIncluded = verifyMerkleProof(blob.merkle.query, { negative });
            if (!isNotIncluded) {
                return {
                    success: false,
                    message: "Non-inclusion proof failed",
                };
            }
            negationIndex++;
        }
    }
    return { success: true };
};

export const createInclusionProof = async (
    current: Buffer,
    type: Buffer,
    currentIndex: bigint,
) => {
    const instance = await Types.instance;
    const {
        query,
        schema,
    } = await instance.getType(type);
    const {
        blockIndex,
        latestKey,
    } = await getLatestItem<Record<string, object>>(current, schema, query);
    const proofs: NegativeProof[] = [];
    for (let i = blockIndex + 1n; i < currentIndex; i++) {
        const block = await getBlockById(i);
        const blob = block.blobs.find(blob => compareBuffers(blob.type, type) === 0);
        if (blob && verifyBloom(blob.bloom, latestKey)) {
            const items = await getItemsByIndex(i, type, schema);
            const indexes = items.map(item => Buffer.from(makeIndex<Record<string, object>>(item, query), "base64"))
            const negative = createMerkleProof(indexes, Buffer.from(latestKey, "base64")).negative;
            if (!negative) {
                throw Error("Created positive proof where it ought not to");
            }
            proofs.push(negative);
        }
    }
    const currentItems = await getItemsByIndex(currentIndex, type, schema);
    const indexes = currentItems.map(item => Buffer.from(makeIndex<Record<string, object>>(item, query), "base64"));
    const positive = createMerkleProof(indexes, Buffer.from(latestKey, "base64")).positive;
    if (!positive) {
        throw Error("Created negative proof where it ought not to");
    }
    return {
        negative: proofs,
        positive,
        blockIndex,
    };
};

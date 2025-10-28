import { getBlockById, getItemsByIndex, getLatestItem, makeIndex } from "./indexer";
import { Types } from "./dynamic-types";
import { compareBuffers } from "./utils";
import { verifyBloom } from "./bloom";
import { EitherProof, NegativeProof } from "./types";
import { createMerkleProof } from "./merkle";

export const verifyInclusionProof = async () => {

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
    
};

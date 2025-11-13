import { verifyArgon } from "./argon";
import { computeDifficulty, getDifficulty } from "./difficulty";
import { paddingType } from "./serializer";
import { PaddingFormat } from "./types";
import { compareBuffers } from "./utils";

export const createPadding = async (
    hash: Buffer,
    paddingCount: number,
    type: "PADDING_BIG" | "PADDING_SMALL"
) => {
    const paddings: PaddingFormat[] = [];
    for (let i = 0n; i < paddingCount; i++) {
        const padding: PaddingFormat = {
            index: i,
            hash,
            difficulty: Buffer.from(`0x1`, "hex"),
        };
        const computed = await computeDifficulty(paddingType.toBuffer(padding), type);
        if (!computed) {
            throw new Error('Could not compute padding');
        }
        paddings.push(computed);
        
    }
    return paddings;
};

export const verifyPadding = async (
    hash: Buffer,
    paddingCount: number,
    padding: (PaddingFormat | Buffer)[],
    type: "PADDING_SMALL" | "PADDING_BIG",
) => {
    const diff = await getDifficulty(type);
    if (paddingCount !== padding.length) {
        return {
            message: "Wrong count",
            success: false,
        };
    }
    for (let i = 0n; i < paddingCount; i++) {
        const converted: PaddingFormat = Buffer.isBuffer(padding) ? paddingType.fromBuffer(padding) : padding;
        if (compareBuffers(converted.hash, hash) !== 0 || converted.index !== i) {
            return {
                message: "Malformed padding",
                success: false,
            };
        }
        if (!await verifyArgon(paddingType.toBuffer(converted), type, diff)) {
            return {
                message: "Invalid difficulty",
                success: false,
            };
        }
    }
    return { success: true };
};

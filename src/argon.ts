import { argon2id } from "hash-wasm";
import { DifficultyType, DiffResult } from "./types";
import { blobHashType, mainBlockType, messageType, paddingType } from "./serializer";
import { ARGON_SALT } from "./constants";

const diffTypes: Record<DifficultyType, typeof mainBlockType | typeof blobHashType | typeof messageType | typeof paddingType> = {
    MAIN: mainBlockType,
    SIDE: blobHashType,
    TRANSACTION: messageType,
    PADDING: paddingType,
};

let running = false;

const salt = Buffer.from(ARGON_SALT, "utf-8");

export const hashArgon = async <T extends DifficultyType>(
    transaction: Buffer,
    start: bigint,
    type: T,
    difficulty: bigint,
) => {
    running = true;
    const block: DiffResult[T] = diffTypes[type].fromBuffer(transaction);
    while (running) {
        start += 1n;
        block.difficulty = Buffer.from(start.toString(16), "hex");
        const hashValue = Buffer.from(await argon2id({
            password: diffTypes[type].toBuffer(block),
            salt,
            parallelism: 1,
            iterations: 1,
            memorySize: 65536,
            hashLength: 32,
            outputType: "binary"
        }));
        if (BigInt(`0x${hashValue}`) < difficulty) {
            return block;       
        }
    }
    return undefined;
};

export const verifyArgon = async <T extends DifficultyType>(
    transaction: Buffer,
    type: T,
    difficulty: bigint,
) => {
    const block: DiffResult[T] = diffTypes[type].fromBuffer(transaction);
    const hashValue = Buffer.from(await argon2id({
        password: transaction,
        salt,
        parallelism: 1,
        iterations: 1,
        memorySize: 65536,
        hashLength: 32,
        outputType: "binary"
    }));
    return [BigInt(`0x${hashValue}`) < difficulty, block] as const;
}

export const stopArgon = () => {
    running = false;
};
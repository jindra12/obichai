import { expose } from "threads";
import { stopArgon, hashArgon, verifyArgon } from "./argon";
import { createBloom, verifyBloom } from "./bloom";
import { createMerkle, createMerkleProof, verifyMerkleProof } from "./merkle";
import { validateMainsDifficulty, validateMultiBlockQuery, validateQuery } from "./query";

const worker = {
    hashArgon,
    stopArgon,
    verifyArgon,
    createBloom,
    verifyBloom,
    createMerkle,
    createMerkleProof,
    verifyMerkleProof,
    validateMultiBlockQuery,
    validateQuery,
    validateMainsDifficulty,
};

export type WorkerType = typeof worker;

expose(worker as any);
import { expose } from "threads";
import { stopArgon, hashArgon, verifyArgon } from "./argon";
import { createBloom, verifyBloom } from "./bloom";
import { createMerkle, createMerkleProof, verifyMerkleProof } from "./merkle";

const worker = {
    hashArgon,
    stopArgon,
    verifyArgon,
    createBloom,
    verifyBloom,
    createMerkle,
    createMerkleProof,
    verifyMerkleProof,
};

export type WorkerType = typeof worker;

expose(worker as any);
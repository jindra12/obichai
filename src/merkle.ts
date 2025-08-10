import { createHash } from "crypto";
import { MerkleTree } from "merkletreejs";
import { EitherProof, NegativeProof, SubNegation } from "./types";
import { BYTE_LENGTH_TRANSACTION_COUNT, HASH_LENGTH_WITH_INDEX, NUMBER_OF_TRANSACTIONS } from "./constants";

const encodeValue = (value: number) => Buffer.from(value.toString(16).padStart(BYTE_LENGTH_TRANSACTION_COUNT * 2, "0"), "hex");

const sha256 = (data: string) => {
    return Buffer.from(createHash("sha256").update(data).digest("hex"), "hex");
};

const compareBuffers = (aBuffer: Buffer, bBuffer: Buffer) => {
    for (let i = 0; i < aBuffer.length; i++) {
        if (aBuffer[i] !== bBuffer[i]) {
            return aBuffer[i]! - bBuffer[i]!;
        }
    }
    return 0;
};

export const createMerkle = (hashes: Buffer[]) => {
    const leaves = hashes
        .sort((aValue, bValue) => compareBuffers(aValue, bValue))
        .map((value, index) => Buffer.concat([
            value,
            encodeValue(index),
        ]));

    const tree = new MerkleTree(leaves, sha256, { sortPairs: false });
    return {
        root: tree.getRoot(),
        leaves: leaves,
    };
};

const createPositiveProof = (leaves: Buffer[], hash: Buffer) => {
    const tree = new MerkleTree(
        leaves,
        sha256,
        { sortPairs: false }
    );
    return {
        proof: tree.getProof(hash),
        leaf: hash,
    };
};

const getNegationWithProof = (tree: MerkleTree, leaf: Buffer) => ({
    leaf,
    proof: tree.getProof(leaf),
});

const createNegativeProof = (leaves: Buffer[], hash: Buffer): NegativeProof => {
    const tree = new MerkleTree(
        leaves,
        sha256,
        { sortPairs: false }
    );
    const nearestRight = leaves.findIndex(aHash => compareBuffers(aHash, hash) > 0);
    if (nearestRight === -1) {
        return { left: getNegationWithProof(tree, leaves[leaves.length - 1]!), not: hash };
    }
    if (nearestRight === 0) {
        return { right: getNegationWithProof(tree, leaves[nearestRight]!), not: hash }
    }
    return {
        right: getNegationWithProof(tree, leaves[nearestRight]!),
        left: getNegationWithProof(tree, leaves[nearestRight - 1]!),
        not: hash,
    } as const;
};

export const createProof = (leaves: Buffer[], hash: Buffer): EitherProof => {
    return leaves.some(leaf => compareBuffers(leaf, hash) === 0)
        ? { positive: createPositiveProof(leaves, hash), negative: undefined }
        : { negative: createNegativeProof(leaves, hash), positive: undefined };
};

const checkNegativeProofLength = (proof: SubNegation) =>
    proof.leaf.length === HASH_LENGTH_WITH_INDEX;

export const verifyProof = (root: Buffer, proof: EitherProof) => {
    if (proof.positive) {
        return MerkleTree.verify(proof.positive.proof, proof.positive.leaf, root, sha256);
    }
    if (proof.negative.not.length !== HASH_LENGTH_WITH_INDEX) {
        return false;
    }
    if (proof.negative.left && !proof.negative.right) {
        if (!checkNegativeProofLength(proof.negative.left)) {
            return false;
        }
        const verifyLeft = MerkleTree.verify(proof.negative.left.proof, proof.negative.left.leaf, root, sha256);
        if (!verifyLeft) {
            return false;
        }
        const lastByte = proof.negative.left.leaf.subarray(-BYTE_LENGTH_TRANSACTION_COUNT).toString("hex");
        if (parseInt(lastByte, 16) !== 0) {
            return false;
        }
        return compareBuffers(proof.negative.left.leaf, proof.negative.not) < 0;
    }
    if (proof.negative.right && !proof.negative.left) {
        if (!checkNegativeProofLength(proof.negative.right)) {
            return false;
        }
        const verifyRight = MerkleTree.verify(proof.negative.right.proof, proof.negative.right.leaf, root, sha256);
        if (!verifyRight) {
            return false;
        }
        const lastByte = proof.negative.right.leaf.subarray(-BYTE_LENGTH_TRANSACTION_COUNT).toString("hex");
        if (parseInt(lastByte, 16) !== NUMBER_OF_TRANSACTIONS - 1) {
            return false;
        }
        return compareBuffers(proof.negative.right.leaf, proof.negative.not) > 0;
    }
    if (!checkNegativeProofLength(proof.negative.left) || !checkNegativeProofLength(proof.negative.right)) {
        return false;
    }
    const verifyLeft = MerkleTree.verify(proof.negative.left.proof, proof.negative.left.leaf, root, sha256);
    const verifyRight = MerkleTree.verify(proof.negative.right.proof, proof.negative.right.leaf, root, sha256);
    if (!verifyLeft || !verifyRight) {
        return false;
    }
    const lastLeftByte = proof.negative.left.leaf.subarray(-BYTE_LENGTH_TRANSACTION_COUNT).toString("hex");
    const lastRightByte = proof.negative.right.leaf.subarray(-BYTE_LENGTH_TRANSACTION_COUNT).toString("hex");
    const leftIndex = parseInt(lastLeftByte, 16);
    const rightIndex = parseInt(lastRightByte, 16);
    if (leftIndex + 1 !== rightIndex) {
        return false;
    }
    return compareBuffers(proof.negative.right.leaf, proof.negative.not) > 0 && compareBuffers(proof.negative.left.leaf, proof.negative.not) < 0;
};

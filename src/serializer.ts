import avro from "avsc";
import { DIFFICULTY_SIZE } from "./constants";

export const longType = avro.types.LongType.__with({
    fromBuffer: (buf: Buffer) => buf.readBigInt64LE(),
    toBuffer: (n: bigint) => {
        const buf = Buffer.alloc(8);
        buf.writeBigInt64LE(n);
        return buf;
    },
    fromJSON: BigInt,
    toJSON: Number,
    isValid: (n: bigint) => typeof n == "bigint",
    compare: (n1: bigint, n2: bigint) => n1 - n2,
});

export const address = {
    type: "fixed",
    size: 20,
    name: "Address",
} as const;

export const hash = {
    type: "fixed",
    size: 32,
    name: "Hash",
} as const;

export const single = {
    type: "fixed",
    size: 1,
    name: "Hash",
} as const;

export const signature = {
    type: "fixed",
    size: 65,
    name: "Signature",
} as const;

export const difficulty = {
    type: "fixed",
    size: DIFFICULTY_SIZE,
    name: "Difficulty",
} as const;

export const paddingType = avro.Type.forSchema({
    type: "record",
    name: "Padding",
    fields: [
        { name: "index", type: longType },
        { name: "difficulty", type: difficulty },
        { name: "hash", type: [hash, "null"], default: "null" },
    ],
});

export const merkleType = avro.Type.forSchema({
    type: "record",
    name: "Merkle",
    fields: [
        { name: "query", type: hash },
        { name: "includes", type: hash },
    ],
});

export const blobHashType = avro.Type.forSchema({
    type: "record",
    name: "BlobHash",
    fields: [
        { name: "type", type: hash },
        { name: "merkle", type: merkleType },
        { name: "author", type: address },
        { name: "difficulty", type: difficulty },
        { name: "bloom", type: "bytes" },
    ],
});

export const mainBlockType = avro.Type.forSchema({
    type: "record",
    name: "MainBlock",
    fields: [
        { name: "id", type: longType },
        { name: "timestamp", type: longType },
        { name: "prevHash", type: hash },
        { name: "author", type: address },
        { name: "blobs", type: { type: "array", items: blobHashType } },
        { name: "difficulty", type: difficulty },
        { name: "padding", type: paddingType },
        { name: "limit", type: hash },
    ]
});

export const messageTypeEnum = avro.Type.forSchema({
  type: "enum",
  name: "MessageType",
  symbols: ["MANUAL", "AUTO"],
});


export const transactionTypeEnum = avro.Type.forSchema({
  type: "enum",
  name: "TransactionType",
  symbols: ["MINT", "FROM", "TO", "ATTESTATION"],
});

export const nftTypeEnum = avro.Type.forSchema({
    type: "enum",
    name: "NFTType",
    symbols: ["MINT", "TRANSFER", "ATTESTATION"],
});

export const proofEnum = avro.Type.forSchema({
    type: "enum",
    name: "ProofType",
    symbols: ["left", "right"],
});

export const floodMessageEnum = avro.Type.forSchema({
    type: "enum",
    name: "FloodMessageEnum",
    symbols: ["REQUEST", "RESPONSE"],
});

export const coinType = avro.Type.forSchema({
    type: "record",
    name: "Coin",
    fields: [
        { name: "from", type: address },
        { name: "to", type: address },
        { name: "author", type: address },
        { name: "amount", type: longType },
        { name: "nextBalance", type: longType },
        { name: "type", type: transactionTypeEnum },
        { name: "relatedTo", type: ["null", hash], default: "null" },
    ],
});

export const tokenType = avro.Type.forSchema({
    type: "record",
    name: "Token",
    fields: [
        { name: "from", type: address },
        { name: "to", type: address },
        { name: "amount", type: longType },
        { name: "nextBalance", type: longType },
        { name: "type", type: transactionTypeEnum },
        { name: "relatedTo", type: ["null", hash], default: "null" },
    ],
});

export const nftType = avro.Type.forSchema({
    type: "record",
    name: "NFT",
    fields: [
        { name: "author", type: address },
        { name: "series", type: hash },
        { name: "identity", type: hash },
        { name: "from", type: address },
        { name: "to", type: address },
        { name: "type", type: nftTypeEnum },
    ],
});

export const messageType = avro.Type.forSchema({
    type: "record",
    name: "Message",
    fields: [
        { name: "from", type: address },
        { name: "to", type: address },
        { name: "data", type: "bytes" },
        { name: "note", type: "note" },
        { name: "difficulty", type: ["bytes", "null"], default: "null" }
    ]
});

export const proofType = avro.Type.forSchema({
    type: "record",
    name: "Proof",
    fields: [
        { name: "position", type: proofEnum },
        { name: "data", type: hash },
    ],
});

export const queryType = avro.Type.forSchema({
    type: "record",
    name: "Query",
    fields: [
        { name: "transaction", type: "bytes" },
        { name: "proof", type: { type: "array", items: proofType }, default: [] }
    ]
});

export const typedQueries = avro.Type.forSchema({
    type: "record",
    name: "TypedQuery",
    fields: [
        { name: "type", type: hash },
        { name: "padding", type: { type: "array", items: paddingType, default: [] } },
        { name: "queries", type: { type: "array", items: queryType } },
        { name: "difficulty", type: "bytes" },
        { name: "author", type: address },
    ],
});

export const queriesType = avro.Type.forSchema({ 
    type: "record",
    name: "Queries",
    fields: [
        { name: "index", type: longType },
        { name: "hash", type: hash },
        { name: "results", type: { type: "array", items: typedQueries } }
    ]
});

export const multiBlockQueriesType = avro.Type.forSchema({
    type: "record",
    name: "MultiBlockQueries",
    fields: [
        { name: "hash", type: hash },
        { name: "queries", type: queriesType },
    ],
});

export const paddingArray = avro.Type.forSchema({
    type: "array",
    items: paddingType,
});

export const transactionWithMetadata = avro.Type.forSchema({
    type: "record",
    name: "TransactionWithMetadata",
    fields: [
        { name: "transaction", type: "bytes" },
        { name: "blockHash", type: hash },
        { name: "index", type: longType }
    ],
});

export const signedMessage = avro.Type.forSchema({
    type: "record",
    name: "SignedMessage",
    fields: [
        { name: "r", type: hash },
        { name: "s", type: hash },
        { name: "v", type: single },
        { name: "rule", type: hash },
        { name: "hash", type: hash },
        { name: "index", type: longType },
        { name: "type", type: messageTypeEnum },
        { name: "transaction", type: "bytes" }
    ],
});

export const networkResponse = avro.Type.forSchema({
    type: "record",
    name: "FloodResponse",
    fields: [
        { name: "messages", type: { type: "array", items: "bytes" } },
    ],
});

export const floodMessage = avro.Type.forSchema({
    type: "record",
    name: "FloodMessage",
    fields: [
        { name: "keys", type: { type: "array", items: hash } },
        { name: "type", type: floodMessageEnum },
    ],
});

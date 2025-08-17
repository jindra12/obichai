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
        { name: "hash", type: hash },
    ],
});

export const blobHashType = avro.Type.forSchema({
    type: "record",
    name: "BlobHash",
    fields: [
        { name: "type", type: hash },
        { name: "merkle", type: hash },
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

export const swapTypeEnum = avro.Type.forSchema({
    type: "enum",
    name: "SwapType",
    symbols: ["FUND", "WITHDRAW", "SWAP1", "SWAP2"],
});

export const nftSaleTypeEnum = avro.Type.forSchema({
    type: "enum",
    name: "NftSaleType",
    symbols: ["BUY", "SELL"],
});

export const proofEnum = avro.Type.forSchema({
    type: "enum",
    name: "ProofType",
    symbols: ["left", "right"],
})

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
        { name: "relatedTo", type: ["null", hash] },
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
        { name: "relatedTo", type: ["null", hash] },
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

export const swapType = avro.Type.forSchema({
    type: "record",
    name: "Swap",
    fields: [
        { name: "balance1", type: longType },
        { name: "balance2", type: longType },
        { name: "token1", type: hash },
        { name: "token2", type: hash },
        { name: "lpToken", type: hash },
        { name: "type", type: swapTypeEnum },
        { name: "address", type: address },
        { name: "relatedTo1", type: hash },
        { name: "relatedTo2", type: hash },
    ],
});

export const nftSale = avro.Type.forSchema({
    type: "record",
    name: "NFTSale",
    fields: [
        { name: "series", type: hash },
        { name: "identity", type: hash },
        { name: "price", type: longType },
        { name: "token", type: hash },
        { name: "address", type: address },
        { name: "type", type: nftSaleTypeEnum },
        { name: "relatedTo", type: hash },
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
        { name: "difficulty", type: "bytes" }
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
        { name: "padding", type: longType },
        { name: "queries", type: { type: "array", items: queryType } },
    ],
});

export const queriesType = avro.Type.forSchema({ 
    type: "record",
    name: "Queries",
    fields: [
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
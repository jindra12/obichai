import avro from "avsc";
import { keccak } from "hash-wasm";
import { Storage } from "./storage";
import { DePromise } from "./types";

const longType = avro.types.LongType.__with({
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

const address = {
    type: "fixed",
    size: 20,
    name: "Address",
} as const;

const hash = {
    type: "fixed",
    size: 32,
    name: "Hash",
} as const;

const blobHashValue = avro.Type.forSchema({
    name: "BlobHash",
    type: "record",
    fields: [
        { name: "author", type: address },
        { name: "difficulty", type: "bytes" },
    ],
});

const blobHashType = avro.Type.forSchema({
    type: "record",
    name: "BlobHash",
    fields: [
        { name: "type", type: hash },
        { name: "merkle", type: hash },
        { name: "values", type: blobHashValue },
        { name: "bloom", type: "bytes" },
    ],
});

const mainBlockType = avro.Type.forSchema({
    type: "record",
    name: "MainBlock",
    fields: [
        { name: "id", type: longType },
        { name: "timestamp", type: longType },
        { name: "prevHash", type: hash },
        { name: "author", type: address },
        { name: "blobs", type: { type: "array", items: blobHashType } },
        { name: "difficulty", type: "bytes" },
    ]
});

const transactionTypeEnum = avro.Type.forSchema({
  type: "enum",
  name: "TransactionType",
  symbols: ["MINT", "FROM", "TO", "ATTESTATION"],
});

const nftTypeEnum = avro.Type.forSchema({
    type: "enum",
    name: "NFTType",
    symbols: ["MINT", "TRANSFER", "ATTESTATION"],
});

const swapTypeEnum = avro.Type.forSchema({
    type: "enum",
    name: "SwapType",
    symbols: ["FUND", "WITHDRAW", "SWAP1", "SWAP2"],
});

const nftSaleTypeEnum = avro.Type.forSchema({
    type: "enum",
    name: "NftSaleType",
    symbols: ["BUY", "SELL"],
});

const transactionType = avro.Type.forSchema({
    type: "record",
    name: "Coin",
    fields: [
        { name: "from", type: address },
        { name: "to", type: address },
        { name: "amount", type: longType },
        { name: "nextBalance", type: longType },
        { name: "type", type: transactionTypeEnum },
        { name: "relatedTo", type: ["null", hash] },
    ],
});

const tokenType = avro.Type.forSchema({
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

const nftType = avro.Type.forSchema({
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

const swapType = avro.Type.forSchema({
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

const nftSale = avro.Type.forSchema({
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

const serializeType = async (type: avro.Type) => {
    const json = JSON.stringify(type.schema());
    return {
        json,
        hash: await keccak(json, 256),
    };
};

const deserializeType = (type: string) => avro.Type.forSchema(JSON.parse(type) as avro.Schema, { registry: { "long": longType } });

const addType = (serialized: DePromise<ReturnType<typeof serializeType>>) => {
    Storage.instance.setItem(serialized.hash, serialized.json);
};

const initializeTypes = async () => {
    addType(await serializeType(mainBlockType));
    addType(await serializeType(transactionType));
    addType(await serializeType(tokenType));
    addType(await serializeType(nftType));
    addType(await serializeType(swapType));
    addType(await serializeType(nftSale));

    return {
        serializeType,
        deserializeType,
        addType,
    };
};

let types: DePromise<ReturnType<typeof initializeTypes>> = null!;

export const Types = {
    get instance() {
        return new Promise<typeof types>(async resolve => resolve(types ||= await initializeTypes()))
    }
};



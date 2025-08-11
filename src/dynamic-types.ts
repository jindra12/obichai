import avro from "avsc";
import { keccak } from "hash-wasm";

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

export const serializeType = async (type: avro.Type) => {
    const json = JSON.stringify(type.schema());
    return {
        json,
        hash: await keccak(json, 256),
    };
};
export const deserializeType = (type: string) => avro.Type.forSchema(JSON.parse(type) as avro.Schema, { registry: { "long": longType } });
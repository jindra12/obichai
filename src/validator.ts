import Ajv, { JSONSchemaType, KeywordDefinition } from "ajv";
import addFormats from "ajv-formats";
import { BlobHashType, MainBlockType, TransactionValidationFormat } from "./types";
import { NUMBER_OF_BLOBS } from "./constants";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const isBufferLength: KeywordDefinition = {
    keyword: "bufferLength",
    type: "object",
    schemaType: "number",
    validate: (expectedLength: number, data: any) => {
        return Buffer.isBuffer(data) && data.length === expectedLength;
    },
    errors: false,
};
ajv.addKeyword(isBufferLength);

const isBuffer: KeywordDefinition = {
    keyword: "isBuffer",
    type: "object",
    schemaType: "boolean",
    validate: (type: boolean, data: any) => Buffer.isBuffer(data) === type,
    errors: false,
};
ajv.addKeyword(isBuffer);

const isBigInt: KeywordDefinition = {
    keyword: "isBigInt",
    type: "object", 
    schemaType: "boolean",
    validate: (expected: boolean, data: any) => {
        return (typeof data === "bigint") === expected;
    },
    errors: false,
};
ajv.addKeyword(isBigInt);

const blobHash: JSONSchemaType<BlobHashType> = {
    type: "object",
    properties: {
        bloom: { isBuffer: true },
        merkle: { isBufferLength: 32 },
        type: { isBufferLength: 32 },
        author: { isBufferLength: 20 },
        difficulty: { isBufferLength: 8 },
    } as JSONSchemaType<BlobHashType>["properties"],
    required: [
        "bloom",
        "merkle",
        "type",
        "author",
        "difficulty",
    ],
    additionalProperties: false,
};

const mainBlock: JSONSchemaType<MainBlockType> = {
    type: "object",
    properties: {
        author: { isBufferLength: 20 },
        blobs: {
            type: "array",
            items: blobHash,
            minItems: NUMBER_OF_BLOBS,
            maxItems: NUMBER_OF_BLOBS,
        },
        difficulty: { isBufferLength: 8 },
        id: { isBigInt: true },
        prevHash: { isBufferLength: 32 },
        timestamp: { isBigInt: true },
    } as JSONSchemaType<MainBlockType>["properties"],
    required: [
        "author",
        "blobs",
        "difficulty",
        "id",
        "prevHash",
        "timestamp",
    ],
    additionalProperties: false,
};

const createValidation = <T extends object>(validation: JSONSchemaType<T>) => ({
    type: "object",
    properties: {
        prev: mainBlock,
        block: mainBlock,
        current: validation,
        queried: validation,
    },
    required: ["block", "current", "prev"],
    additionalProperties: false,
}) as JSONSchemaType<TransactionValidationFormat<T>>;

import { get } from "typedots";
import Ajv, { JSONSchemaType, KeywordDefinition } from "ajv";
import addFormats from "ajv-formats";
import uniqBy from "lodash/uniqBy";
import { BlobHashType, MainBlockType, PaddingFormat, TokenType } from "./types";
import { NUMBER_OF_BLOBS } from "./constants";
import { compareBuffers } from "./utils";

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

const equalTo: KeywordDefinition = {
    keyword: "equalTo",
    type: ["array", "boolean", "integer", "null", "number", "object", "string"],
    validate: (path: string, data: any, _, dataCxt) => {
        const found = (get as any)(dataCxt?.rootData, path);
        if (data === found) {
            return true;
        }
        return Buffer.isBuffer(data) && Buffer.isBuffer(found) && compareBuffers(data, found) === 0;
    },
    errors: false,
};
ajv.addKeyword(equalTo);

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
    schemaType: "boolean",
    validate: (expected: boolean, data: any) => {
        return (typeof data === "bigint") === expected;
    },
    errors: false,
};
ajv.addKeyword(isBigInt);

const transactionType: KeywordDefinition = {
    keyword: "transactionType",
    type: "object",
    schemaType: "string",
    validate: (expected: string, data: { type: string }) => {
        return expected === data.type;
    },
    errors: false,
};
ajv.addKeyword(transactionType);

const uniqByKeyword: KeywordDefinition = {
    keyword: "uniqBy",
    type: "array",
    schemaType: "array",
    validate: (paths: string[], array: any[]) => {
        return paths.every(path => array.length === uniqBy(array, (item) => (get as any)(item, path).toString()).length);
    },
    errors: false,
}
ajv.addKeyword(uniqByKeyword);

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

const paddingType: JSONSchemaType<PaddingFormat> = {
    type: "object",
    properties: {
        difficulty: { isBufferLength: 8 },
        hash: { isBufferLength: 32 },
        index: { isBigInt: true },
    } as JSONSchemaType<BlobHashType>["properties"],
    required: [
        "difficulty",
        "hash",
        "index",
    ],
};

const mainBlock: JSONSchemaType<MainBlockType> = {
    type: "object",
    properties: {
        author: { isBufferLength: 20 },
        blobs: {
            type: "array",
            items: blobHash,
            maxItems: NUMBER_OF_BLOBS,
            uniqBy: ["type"],
        },
        padding: {
            type: "array",
            items: paddingType,
            maxItems: NUMBER_OF_BLOBS,
            uniqBy: ["type"],
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
        "padding",
        "timestamp",
    ],
    additionalProperties: false,
};

type SubRecord<T extends string, E extends { type: T }> = Record<T, Partial<JSONSchemaType<{ block: MainBlockType, prev: MainBlockType, queried: E, current: E }>>>;

export const createTypeValidation = <T extends string, E extends { type: T }>(
    validators: Record<T, SubRecord<T, E>>
) => {
    return {
        allOf: [
            {
                type: "object",
                properties: {
                    prev: mainBlock,
                    block: mainBlock,
                },
                required: ["block", "prev", "current"],
            },
            {
                anyOf: Object.entries<SubRecord<T, E>>(validators).flatMap(([key, currents]) => {
                    const prevKey = key as T;
                    return Object.entries(currents).map(([key, validations]) => {
                        return {
                            allOf: [

                                {
                                    type: "object",
                                    properties: {
                                        prev: { transactionType: prevKey, },
                                        current: { transactionType: key },
                                    }
                                },
                                validations,
                            ]
                        };
                    });
                })
            }
        ],
    } as any as JSONSchemaType<{ block: MainBlockType, prev: MainBlockType, queried: E, current: E }>;
};

export const coinValidation = createTypeValidation<TokenType["type"], TokenType>({
    ATTESTATION: {
        ATTESTATION: {
            properties: {

            }
        },
        FROM: {

        },
        MINT: {

        },
        TO: {
            
        },
    },
    FROM: {
        ATTESTATION: {

        },
        FROM: {

        },
        MINT: {

        },
        TO: {

        }
    },
    MINT: {
        ATTESTATION: {

        },
        FROM: {

        },
        MINT: {

        },
        TO: {

        },
    },
    TO: {
        ATTESTATION: {

        },
        FROM: {

        },
        MINT: {

        },
        TO: {

        },
    }
});

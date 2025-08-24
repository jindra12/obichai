import avro from "avsc";
import { JSONSchemaType } from "ajv";
import { ExtractObjectPaths } from "typedots";
import { Storage } from "./storage";
import { DePromise } from "./types";
import { longType, nftSale, nftType, swapType, tokenType, coinType } from "./serializer"
import { sha256CompactKey } from "./utils";

const serializeType = async <T extends {}>(
    type: avro.Type,
    rules: JSONSchemaType<T> | null = null,
    query: ExtractObjectPaths<T>[] = [],
) => {
    const json = JSON.stringify({ schema: type.schema(), rules, query });
    return {
        json,
        hash: sha256CompactKey(json),
    };
};

const deserializeType = <T extends {} = Record<string, string>>(type: string) => {
    const { schema, rules, query } = JSON.parse(type) as {
        schema: avro.Schema,
        rules: JSONSchemaType<T>,
        query: ExtractObjectPaths<T>[],
    };
    return {
        schema: avro.Type.forSchema(schema, { registry: { "long": longType } }),
        rules,
        query,
    };
};

const addType = (serialized: DePromise<ReturnType<typeof serializeType>>) => {
    Storage.instance.setItem(serialized.hash, serialized.json);
};

const getType = async <T extends {} = Record<string, string>>(hash: Buffer | string) => {
    const key = typeof hash === "string" ? hash : hash.toString("base64");
    const value = await Storage.instance.getItem(key) as string;
    return deserializeType<T>(value);
};

const initializeTypes = async () => {
    addType(await serializeType(coinType));
    addType(await serializeType(tokenType));
    addType(await serializeType(nftType));
    addType(await serializeType(swapType));
    addType(await serializeType(nftSale));

    return {
        serializeType,
        deserializeType,
        addType,
        getType,
    };
};

let types: DePromise<ReturnType<typeof initializeTypes>> = null!;

export const Types = {
    get instance() {
        return new Promise<typeof types>(async resolve => resolve(types ||= await initializeTypes()))
    }
};



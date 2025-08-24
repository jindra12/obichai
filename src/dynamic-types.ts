import avro from "avsc";
import { JSONSchemaType } from "ajv";
import { ExtractObjectPaths } from "typedots";
import { Storage } from "./storage";
import { DePromise } from "./types";
import { longType, nftType, tokenType, coinType } from "./serializer"
import { sha256CompactKey } from "./utils";

const serializeType = async <T extends {}>(
    type: avro.Type,
    rules: JSONSchemaType<T> | null = null,
    query: ExtractObjectPaths<T>[] = [],
    unique: ExtractObjectPaths<T>[] = [],
) => {
    const json = JSON.stringify({ schema: type.schema(), rules, query, unique });
    return {
        json,
        short: sha256CompactKey(json, 20),
        hash: sha256CompactKey(json),
    };
};

const deserializeType = <T extends {} = Record<string, string>>(type: string) => {
    const { schema, rules, query, unique } = JSON.parse(type) as {
        schema: avro.Schema,
        rules: JSONSchemaType<T>,
        query: ExtractObjectPaths<T>[],
        unique: ExtractObjectPaths<T>[],
    };
    return {
        schema: avro.Type.forSchema(schema, { registry: { "long": longType } }),
        rules,
        query,
        unique,
    };
};

const addType = (serialized: DePromise<ReturnType<typeof serializeType>>) => {
    Storage.instance.setItem(serialized.hash, serialized.json);
    Storage.instance.setItem(serialized.short, serialized.hash);
};

const getType = async <T extends {} = Record<string, string>>(hash: Buffer | string) => {
    const key = typeof hash === "string" ? hash : hash.toString("base64");
    const value = await Storage.instance.getItem(key) as string;
    return deserializeType<T>(value);
};

const getTypeFromShort = async <T extends {} = Record<string, string>>(short: Buffer | string) => {
    const key = typeof short === "string" ? short : short.toString("base64");
    const value = await Storage.instance.getItem(key) as string;
    return getType<T>(value)
};

const initializeTypes = async () => {
    addType(await serializeType(coinType));
    addType(await serializeType(tokenType));
    addType(await serializeType(nftType));

    return {
        serializeType,
        deserializeType,
        addType,
        getType,
        getTypeFromShort,
    };
};

let types: DePromise<ReturnType<typeof initializeTypes>> = null!;

export const Types = {
    get instance() {
        return new Promise<typeof types>(async resolve => resolve(types ||= await initializeTypes()))
    }
};



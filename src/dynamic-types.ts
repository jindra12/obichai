import avro from "avsc";
import { keccak } from "hash-wasm";
import { JSONSchemaType } from "ajv";
import { ExtractObjectPaths } from "typedots";
import { Storage } from "./storage";
import { DePromise } from "./types";
import { longType, nftSale, nftType, swapType, tokenType, coinType } from "./serializer"

const serializeType = async <T extends {}>(type: avro.Type, rules: JSONSchemaType<T> | null = null, query: ExtractObjectPaths<T>[] = []) => {
    const json = JSON.stringify([type.schema(), rules, query]);
    return {
        json,
        hash: await keccak(json, 256),
    };
};

const deserializeType = <T>(type: string) => {
    const [schema, rule, query] = JSON.parse(type) as [avro.Schema, JSONSchemaType<T>, ExtractObjectPaths<T>[]]
    return [
        avro.Type.forSchema(schema, { registry: { "long": longType } }),
        rule,
        query,
    ];
};

const addType = (serialized: DePromise<ReturnType<typeof serializeType>>) => {
    Storage.instance.setItem(serialized.hash, serialized.json);
};

const getType = async <T extends {}>(hash: Buffer) => {
    const key = hash.toString("hex");
    const [schema, rules, query] = JSON.parse(
        await Storage.instance.getItem(key) as string,
    ) as [
        avro.Schema,
        JSONSchemaType<T>,
        ExtractObjectPaths<T>[],
    ];
    return [schema, rules, query] as const;
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



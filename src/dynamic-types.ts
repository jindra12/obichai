import avro from "avsc";
import { keccak } from "hash-wasm";
import { Schema } from "ajv";
import { Storage } from "./storage";
import { DePromise } from "./types";
import { longType, nftSale, nftType, swapType, tokenType, coinType } from "./serializer";

const serializeType = async (type: avro.Type, rules: Schema | null = null) => {
    const json = JSON.stringify([type.schema(), rules]);
    return {
        json,
        hash: await keccak(json, 256),
    };
};

const deserializeType = (type: string) => {
    const [schema, rule] = JSON.parse(type) as [avro.Schema, Schema]
    return [
        avro.Type.forSchema(schema, { registry: { "long": longType } }),
        rule,
    ];
};

const addType = (serialized: DePromise<ReturnType<typeof serializeType>>) => {
    Storage.instance.setItem(serialized.hash, serialized.json);
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
    };
};

let types: DePromise<ReturnType<typeof initializeTypes>> = null!;

export const Types = {
    get instance() {
        return new Promise<typeof types>(async resolve => resolve(types ||= await initializeTypes()))
    }
};



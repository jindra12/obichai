import { get, ExtractObjectPaths } from "typedots";
import { Type } from "avsc";
import { sha256CompactKey } from "./utils";
import { Storage } from "./storage";

export const makeIndex = <T extends {}>(obj: T, properties: ExtractObjectPaths<T>[]) => {
    return sha256CompactKey(properties.map(p => get(obj, p)));
};

export const storeItem = async <T extends {}>(obj: T, serializer: Type, properties: ExtractObjectPaths<T>[]) => {
    await Storage.instance.setItem(makeIndex(obj, properties), serializer.toBuffer(obj).toString("base64"));
};

export const getItem = async <T extends {}>(key: Buffer, serializer: Type): Promise<T> => {
    return await serializer.fromBuffer(Buffer.from(await Storage.instance.getItem(key.toString("base64")) as string, "base64"));
};
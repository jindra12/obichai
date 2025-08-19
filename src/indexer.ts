import { get, ExtractObjectPaths } from "typedots";
import { Type } from "avsc";
import { sha256CompactKey } from "./utils";
import { Storage } from "./storage";

export const makeIndex = <T extends {}>(obj: T, properties: ExtractObjectPaths<T>[], type: "list" | "latest") => {
    return `${type}-${sha256CompactKey(properties.map(p => get(obj, p)))}`;
};

export const storeItems = async <T extends {} = Record<string, string>>(objs: Buffer[], serializer: Type, properties: ExtractObjectPaths<T>[]) => {
    const storage = Storage.instance;
    const list = makeIndex(serializer.fromBuffer(objs[0]!) as T, properties, "list");
    const item = makeIndex(serializer.fromBuffer(objs[0]!) as T, properties, "latest");
    const current: Buffer[] = ((
        JSON.parse((await storage.getItem(list)) || "[]")
    ) as string[]).map(item => Buffer.from(item, "base64"));
    current.push(...objs);
    await Storage.instance.setItem(
        list,
        JSON.stringify(current.map(c => c.toString("base64"))),
    );
    await Storage.instance.setItem(
        item,
        objs[objs.length - 1]!.toString("base64"),
    );
};

export const getItem = async <T extends {}>(key: Buffer, serializer: Type): Promise<T> => {
    return await serializer.fromBuffer(Buffer.from(await Storage.instance.getItem(`latest-${key.toString("base64")}`) as string, "base64"));
};
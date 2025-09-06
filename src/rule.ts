import { jexl } from "./jexl";
import { Storage } from "./storage";
import { sha256CompactKey } from "./utils";

export const getRule = async (hash: Buffer) => {
    const base64 = hash.toString("base64");
    const item = await Storage.instance.getItem(base64) as string;
    return Buffer.from(item, "base64").toString("utf-8");
};

export const setRule = async (rule: Buffer | string) => {
    const compact = sha256CompactKey(rule);
    const parsed = rule.toString("utf-8");
    jexl.compile(parsed);
    Storage.instance.setItem(compact, rule.toString("base64"));
    return compact;
};

export const processRule = async <T extends Record<string, any>>(
    transaction: T,
    rule: Buffer | string
) => {
    return jexl.eval(rule.toString("utf-8"), transaction);
};
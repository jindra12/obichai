import { jexl } from "./jexl";
import { MainBlockType, ValidationCriteria } from "./types";

type FullValidator<E extends Record<string, any>> = {
    prev: MainBlockType;
    queried: E;
    current: E;
    signer: Buffer;
};

export const isMessageValid = async <E extends Record<string, any>>(validator: FullValidator<E>, rules: ValidationCriteria) => {
    return (await Promise.all(
        rules.anyOf.map(async ({ allOf }) => (await Promise.all(allOf.map((rule) => jexl.eval(rule, validator)))).every(Boolean))
    )).some(Boolean);
};
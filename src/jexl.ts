import jexl from "jexl";
import { Throw } from "throw-expression";

jexl.addTransform("n", (input: string | number | bigint) => {
    switch (typeof input) {
        case "bigint":
            return input;
        case "number":
            return BigInt(input);
        case "string":
            return input.startsWith("0x") ? BigInt(input.slice(2).trim()) : BigInt(input.trim());
        default:
            Throw(`${input} cannot be converted to bigint`);
    }
});

export {
    jexl,
};
import { Throw } from "throw-expression";

export const compareBuffers = (aBuffer: Buffer, bBuffer: Buffer) => {
    if (aBuffer.length !== bBuffer.length) {
        Throw(`Buffer a: ${aBuffer.length} !== Buffer b: ${bBuffer.length}`);
    }
    for (let i = 0; i < aBuffer.length; i++) {
        if (aBuffer[i] !== bBuffer[i]) {
            return aBuffer[i]! - bBuffer[i]!;
        }
    }
    return 0;
};
import { createHash } from "crypto";
import { Throw } from "throw-expression";

export const sha256CompactKey = (data: string[] | Buffer) => {
    return Buffer.from(createHash("sha256").update(Buffer.isBuffer(data) ? data : data.join("")).digest("base64"), "base64").toString("base64");
};

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
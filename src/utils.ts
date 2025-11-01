import { createHash } from "crypto";
import { Throw } from "throw-expression";

export const sha256CompactKey = (data: string | string[] | Buffer, bytes: number = 32) => {
    return Buffer.from(
        createHash("sha256")
            .update(Buffer.isBuffer(data) || typeof data === "string"
                ? data
                : data.join(""))
            .digest("base64"),
        "base64",
    ).subarray(0, bytes).toString("base64");
};

export const sha256 = (data: string) => {
    return Buffer.from(createHash("sha256").update(data).digest("hex"), "hex");
};

export const compareBuffers = (aBuffer: Buffer, bBuffer: Buffer) => {
    if (aBuffer.length !== bBuffer.length) {
        Throw(`Buffer a: ${aBuffer.length} !== Buffer b: ${bBuffer.length}`);
    }
    return aBuffer.compare(bBuffer);
};

export const toNumber = (big: bigint) => parseInt(big.toString());

import { createHash } from "crypto";
import { sha256 as sha256Async } from "hash-wasm";
import { Throw } from "throw-expression";

export const sha256CompactKey = (data: string | string[] | Buffer) => {
    return Buffer.from(
        createHash("sha256")
            .update(Buffer.isBuffer(data) || typeof data === "string"
                ? data
                : data.join(""))
            .digest("base64"),
        "base64",
    ).toString("base64");
};

export const sha256 = (data: string) => {
    return Buffer.from(createHash("sha256").update(data).digest("hex"), "hex");
};

export const blobSha256 = async (blobs: Buffer[]) => {
    return (
        await Promise.all(blobs.map(blob => sha256Async(blob)))
    ).map(hash => Buffer.from(hash, "hex"));
};

export const compareBuffers = (aBuffer: Buffer, bBuffer: Buffer) => {
    if (aBuffer.length !== bBuffer.length) {
        Throw(`Buffer a: ${aBuffer.length} !== Buffer b: ${bBuffer.length}`);
    }
    return aBuffer.compare(bBuffer);
};

export const toNumber = (big: bigint) => parseInt(big.toString());

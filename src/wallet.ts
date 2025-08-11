import { keccak } from "hash-wasm";
import { toChecksumAddress, privateToPublic, publicToAddress, bufferToHex, ecsign, ecrecover, pubToAddress, rlp } from "ethereumjs-util";
import { randomBytes } from "crypto";
import { compareBuffers } from "./utils";

const serializePayload = (parts: Buffer) => rlp.encode(parts)

export const generateWallet = () => {
    const privateKey = randomBytes(32);
    const publicKey = privateToPublic(privateKey);
    const addressBuffer = publicToAddress(publicKey);
    const address = toChecksumAddress(bufferToHex(addressBuffer));

    return {
        privateKey: bufferToHex(privateKey),
        publicKey: bufferToHex(publicKey),
        address
    };
}

export const signMessage = async (message: Buffer, privateKey: Buffer) => {
    const serialized = serializePayload(message);
    const hash = Buffer.from(await keccak(serialized, 256), "hex");
    const { r, s, v } = ecsign(hash, privateKey);
    const signature = Buffer.concat([r, s, Buffer.from([v])]);
    const pubKey = privateToPublic(privateKey)
    return Buffer.concat([pubKey, signature, serialized])
};

export const verifySignature = async (signed: Buffer) => {
    const expectedPubKey = signed.subarray(0, 65);
    const signature = signed.subarray(65, 130);
    const serialized = signed.subarray(130);
    const r = signature.subarray(0, 32)
    const s = signature.subarray(32, 64)
    const v = signature[64]!;
    const hash = Buffer.from(await keccak(serialized, 256), "hex");
    const pubKey = ecrecover(hash, v, r, s);
    const addrBuf = pubToAddress(pubKey, true);
    return {
        address: addrBuf,
        valid: compareBuffers(expectedPubKey, pubKey) === 0,
        message: serialized,
    };
};

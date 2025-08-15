import { toChecksumAddress, privateToPublic, publicToAddress, bufferToHex, ecsign, ecrecover, pubToAddress } from "ethereumjs-util";
import { randomBytes } from "crypto";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";

import { TransactionFormat } from "./types";
import { messageType } from "./serializer";
import { compareBuffers } from "./utils";

export const signUserReadable = ({ data, from, note, to, difficulty }: TransactionFormat) => {
    const domain = {
        name: "Obichai",
        version: "1",
        chainId: 1,
        verifyingContract: `0x${to.toString("hex")}`,
    };

    const types = {
        EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
        ],
        ContractCall: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "data", type: "bytes" },
            { name: "note", type: "string" },
            { name: "nonce", type: "uint64" },
            { name: "difficulty", type: "bytes" },
        ]
    };

    const message = {
        from: `0x${from.toString()}`,
        to: `0x${to.toString("hex")}`,
        data: `0x${data.toString("hex")}`,
        note: note.toString("utf-8"),
        nonce: Buffer.from(randomBytes(8)).toString("hex"),
        difficulty: `0x${difficulty.toString("hex")}`
    };

    const typedData = {
        types,
        domain,
        primaryType: "ContractCall" as const,
        message,
    };

    return typedData;
};

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

export const signMessage = (message: TransactionFormat, privateKey: Buffer) => {
    const msgHash = TypedDataUtils.eip712Hash(signUserReadable(message), SignTypedDataVersion.V4);
    const { r, s, v } = ecsign(msgHash, privateKey);
    const signature = Buffer.concat([r, s, Buffer.from([v])]);
    return Buffer.concat([signature, messageType.toBuffer(message)])
};

export const verifySignature = (signed: Buffer) => {
    const signature = signed.subarray(0, 65);
    const serialized = signed.subarray(65);
    const r = signature.subarray(0, 32);
    const s = signature.subarray(32, 64);
    const v = signature[64]!;
    const message: TransactionFormat = messageType.fromBuffer(serialized);
    const msgHash = TypedDataUtils.eip712Hash(signUserReadable(message), SignTypedDataVersion.V4);
    const pubKey = ecrecover(msgHash, v, r, s);
    const addrBuf = pubToAddress(pubKey, true);
    return {
        address: addrBuf,
        message: serialized,
        valid: compareBuffers(addrBuf, message.from) === 0,
    };
};

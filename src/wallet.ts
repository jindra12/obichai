import { toChecksumAddress, privateToPublic, publicToAddress, bufferToHex, ecsign, ecrecover, pubToAddress } from "ethereumjs-util";
import { randomBytes } from "crypto";
import { SignTypedDataVersion, TypedDataUtils } from "@metamask/eth-sig-util";
import { Throw } from "throw-expression";
import { Eip1193Provider, Signature } from "ethers";

import { MessageFormat, SignedMessage } from "./types";
import { messageType, signedMessage } from "./serializer";
import { compareBuffers } from "./utils";
import { verifyArgon } from "./argon";
import { computeDifficulty, getDifficulty } from "./difficulty";
import { BrowserProvider } from "ethers";
import { getItemByHash } from "./indexer";
import { Types } from "./dynamic-types";
import { getRule, processRule } from "./rule";

export const signUserReadable = ({ data, from, note, to, difficulty }: MessageFormat) => {
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

export const signMessage = async (message: Omit<MessageFormat, "difficulty">, privOrProvider: Buffer | Eip1193Provider) => {
    const full = await computeDifficulty(messageType.toBuffer(message), "TRANSACTION");
    if (!full) {
        Throw(`Hashing transaction failed`);
    }
    const userReadableTransaction = signUserReadable(
        full
    );
    const msgHash = TypedDataUtils.eip712Hash(
        userReadableTransaction, SignTypedDataVersion.V4
    );
    if (Buffer.isBuffer(privOrProvider)) {
        const { r, s, v } = ecsign(msgHash, privOrProvider);
        const signed: SignedMessage = {
            r,
            s,
            v: Buffer.from([v]),
            transaction: messageType.toBuffer(full),
            type: "manual",
        };
        return signedMessage.toBuffer(signed);
    } else {
        const provider = new BrowserProvider(privOrProvider);
        const signer = await provider.getSigner();
        const signature = await signer.signTypedData(
            userReadableTransaction.domain,
            userReadableTransaction.types,
            userReadableTransaction.message
        );
        const { r, s, v } = Signature.from(signature);
        const rBuffer = Buffer.from(r.slice(2), "hex");
        const sBuffer = Buffer.from(s.slice(2), "hex");
        const signed: SignedMessage = {
            r: rBuffer,
            s: sBuffer,
            v: Buffer.from([v]),
            transaction: messageType.toBuffer(full),
            type: "manual",
        };
        return signedMessage.toBuffer(signed);
    }
};

export const verifySignature = async (signed: Buffer) => {
    const fromBuffer = signedMessage.fromBuffer(signed) as SignedMessage;
    if (fromBuffer.type === "manual") {
        const {
            r,
            s,
            transaction,
            v,
        } = fromBuffer;
        const difficulty = await getDifficulty("TRANSACTION");
        const [isValid] = await verifyArgon(transaction, "TRANSACTION", difficulty);
        const message: MessageFormat = messageType.fromBuffer(transaction);
        const msgHash = TypedDataUtils.eip712Hash(signUserReadable(message), SignTypedDataVersion.V4);
        const pubKey = ecrecover(msgHash, v, r, s);
        const addrBuf = pubToAddress(pubKey, true);
        return {
            address: addrBuf,
            message: transaction,
            valid: isValid && compareBuffers(addrBuf, message.from) === 0,
        };
    } else {
        const {
            hash,
            index,
            transaction,
        } = fromBuffer;
        const difficulty = await getDifficulty("TRANSACTION");
        const [isValid] = await verifyArgon(transaction, "TRANSACTION", difficulty);
        const message: MessageFormat = messageType.fromBuffer(transaction);
        const {
            item: corresponding,
            type: correspondingType,
        } = (await getItemByHash(hash, index)) ?? Throw(`Could not find item ${hash.toString("base64")} at ${index}`);
        const type = await (await Types.instance).getTypeFromShort(message.to);
        const parsed = type.schema.fromBuffer(message.data);
        const storedRule = await getRule(message.from);
        const processed = processRule(parsed, storedRule);

        return {
            address: message.from,
            message: transaction,
            valid: isValid && compareBuffers(correspondingType.toBuffer(corresponding), correspondingType.toBuffer(processed)) === 0,
        };
    }
};

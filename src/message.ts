import { QUERY_TRANSACTION, TIMEOUT_RESPONSE_IN_MS } from "./constants";
import { floodMessage } from "./serializer";
import { Node } from "./subscribe";
import { FloodMessage } from "./types";

export const sendTransaction = async (message: Buffer) => {
    const { messenger } = await Node.instance;
    await messenger.services.pubsub.publish(
        QUERY_TRANSACTION,
        floodMessage.toBuffer(message),
    );
};

let timeout: NodeJS.Timeout | undefined;
let queries: Buffer[] = [];
let callbacks: ((value: Buffer | void) => void)[] = [];

const fiveSecondsInMs = 5000;
const queryLimit = 5;

export const queryByHash = async (hash: Buffer) => {
    const response = new Promise<Buffer | void>((resolve) => {
        callbacks.push(resolve);
    });
    queries.push(hash);
    if (!timeout) {
        timeout = setTimeout(executeQuery, fiveSecondsInMs);
    }
    if (queries.length >= queryLimit) {
        await executeQuery();
    }
    return response;
};

const executeQuery = async () => {
    const toCall = [...queries];
    queries = [];
    timeout = undefined;
    const response = await queryByHashes(toCall);
    callbacks.forEach((callback, i) => {
        callback(response[i]);
    });
    callbacks = [];
};

const queryByHashes = async (hashes: Buffer[]) => {
    const { messenger, waitForDirectMessage } = await Node.instance;
    const request: FloodMessage = {
        keys: hashes,
        type: "REQUEST"
    };
    await messenger.services.pubsub.publish(
        QUERY_TRANSACTION,
        floodMessage.toBuffer(request),
    );
    const timeout = () => new Promise<void>(resolve => setTimeout(resolve, TIMEOUT_RESPONSE_IN_MS));
    return await Promise.all(hashes.map(hash => Promise.race([timeout(), waitForDirectMessage(hash)])));
};

export const registerResponse = async (key: string, value: () => Promise<Buffer>) => {
    const { addFloodResponse } = await Node.instance;
    addFloodResponse(key, value);
};

export const unregisterResponse = async (key: string) => {
    const { removeFloodResponse } = await Node.instance;
    removeFloodResponse(key);
};
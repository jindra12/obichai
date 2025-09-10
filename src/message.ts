import { QUERY_TRANSACTION, TIMEOUT_RESPONSE_IN_MS } from "./constants";
import { floodMessage } from "./serializer";
import { Node } from "./subscribe";
import { FloodMessage } from "./types";

export const sendTransaction = () => {

};

export const queryByHash = async (hashes: Buffer[]) => {
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
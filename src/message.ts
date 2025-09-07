import { pipe } from "it-pipe";
import { FLOOD_TIMEOUT_RESPONSE_IN_MS, PROTOCOL, QUERY_TRANSACTION } from "./constants";
import { floodMessage } from "./serializer";
import { Node } from "./subscribe";
import { FloodMessage } from "./types";
import { sha256CompactKey } from "./utils";

export const sendTransaction = () => {

};

const getResponse = async (hash: Buffer | string, topic: string) => {
    const strHash = hash.toString("base64");
    const { messenger, waitForResponse } = await Node.instance;
    return new Promise<Buffer | undefined>(async (resolve) => {
        setTimeout(resolve, FLOOD_TIMEOUT_RESPONSE_IN_MS);
        await waitForResponse(strHash, (register, end) => async ({ detail, direct }) => {
            if (detail.topic === topic && detail.type === "signed") {
                const flood: FloodMessage = floodMessage.fromBuffer(Buffer.from(detail.data));
                if (flood.key.toString("base64") === strHash && flood.type === "RESPONSE") {
                    const stream = await messenger.dialProtocol(detail.from, PROTOCOL);
                    const readyMessage: FloodMessage = {
                        key: flood.key,
                        type: "READY",
                    };
                    register(detail.from);
                    await pipe(
                        [floodMessage.toBuffer(readyMessage)],
                        stream.sink
                    );
                    const buffer = await direct;
                    if (buffer && sha256CompactKey(buffer) === strHash) {
                        resolve(buffer);
                    } else {
                        resolve(undefined);
                    }
                    end();
                }
            }
        });
    });
}

export const queryByHash = async (hash: Buffer | string) => {
    const { messenger } = await Node.instance;
    const request: FloodMessage = {
        key: Buffer.isBuffer(hash) ? hash : Buffer.from(hash, "base64"),
        type: "REQUEST",
    };
    await messenger.services.pubsub.publish(
        QUERY_TRANSACTION,
        floodMessage.toBuffer(request),
    );
    return await getResponse(hash, QUERY_TRANSACTION);
};

export const respondByHash = async () => {

};
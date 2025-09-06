import { PROTOCOL, QUERY_TRANSACTION } from "./constants";
import { floodMessage } from "./serializer";
import { Node } from "./subscribe";
import { FloodMessage } from "./types";

export const sendTransaction = () => {

};

export const queryByHash = async (hash: Buffer | string) => {
    const { messenger, waitForResponse } = await Node.instance;
    await messenger.services.pubsub.publish(
        QUERY_TRANSACTION,
        Buffer.isBuffer(hash) ? hash : Buffer.from(hash, "base64")
    );
    await waitForResponse((trigger) => ({ detail }) => {
        if (detail.topic === QUERY_TRANSACTION && detail.type === "signed") {
            const flood: FloodMessage = floodMessage.fromBuffer(Buffer.from(detail.data));
            if (flood.key === hash.toString("base64") && flood.type === "RESPONSE") {
                messenger.handle(PROTOCOL, (data) => {
                    data.connection.
                }, {  })
                trigger();
            }
        }
    });
};

export const respondByHash = async () => {

};
import { createLibp2p, Libp2p } from "libp2p";
import { PeerId } from "@libp2p/interface";
import { pipe } from "it-pipe";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { webSockets } from "@libp2p/websockets";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@chainsafe/libp2p-identify";
import { tcp } from "@libp2p/tcp"
import isBrowser from "is-browser";
import { PROTOCOL, TOPICS } from "./constants";
import { DePromise, FloodMessage, NetworkResponse } from "./types";
import { floodMessage, networkResponse } from "./serializer";
import { sha256CompactKey } from "./utils";

const initialize = async () => {
    const messenger: Libp2p<{ pubsub: ReturnType<ReturnType<typeof gossipsub>>; identify: unknown; }> = await createLibp2p({
        transports: isBrowser ? [tcp(), webSockets()] : [webRTC()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
            pubsubPeerDiscovery({
                interval: 10000,
                topics: ["peer-discovery"],
                listenOnly: false,
            }),
        ],
        services: {
            pubsub: gossipsub(),
            identify: identify() as any,
        },
    });
    const directMessages: Record<string, (resolve: Buffer, from: PeerId) => void> = {};
    const floodMessages: Record<string, () => Promise<Buffer>> = {};

    TOPICS.forEach(topic => messenger.services.pubsub.subscribe(topic));
    messenger.services.pubsub.addEventListener("message", async (message) => {
        try {
            if (message.detail.type === "signed") {
                const data: FloodMessage = floodMessage.fromBuffer(Buffer.from(message.detail.data));
                const from = message.detail.from;
                if (data.type === "REQUEST") {
                    const stream = await messenger.dialProtocol(from, PROTOCOL);
                    const response: NetworkResponse = {
                        messages: await Promise.all(data.keys.map(key => {
                            const hash = key.toString("base64");
                            return floodMessages[hash]?.()!;
                        }).filter(Boolean)),
                    };
                    if (response.messages.length > 0) {
                        await pipe(
                            [networkResponse.toBuffer(response)],
                            stream.sink
                        );
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    });
    messenger.handle(PROTOCOL, async ({ stream, connection }) => {
        try {
            const chunks: Uint8Array[] = [];
            for await (const chunk of stream.source) {
                for (const part of chunk) {
                    chunks.push(part);
                }
            }
            const messages: NetworkResponse = networkResponse.fromBuffer(Buffer.concat(chunks));
            messages.messages.forEach((msg) => {
                const hash = sha256CompactKey(msg);
                const resolve = directMessages[hash];
                if (resolve) {
                    resolve(msg, connection.remotePeer);
                }
            });
        } catch (e) {
            console.error(e);
        } finally {
            stream.close();
        }
    });
    return {
        messenger,
        addFloodResponse: (key: string, data: () => Promise<Buffer>) => {
            floodMessages[key] = data;
        },
        removeFloodResponse: (key: string) => {
            delete floodMessages[key];
        },
        waitForDirectMessage: (hash: Buffer) => {
            const key = hash.toString("base64");
            return new Promise<Buffer>((resolve) => {
                directMessages[key] = resolve;
            });
        },
    };
};

let node: DePromise<ReturnType<typeof initialize>> = null!;

export const Node = {
    get instance() {
        return new Promise<typeof node>(async resolve => resolve(node ||= await initialize()));
    }
}
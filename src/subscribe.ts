import { createLibp2p, Libp2p } from "libp2p";
import { Message, PeerId } from "@libp2p/interface";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { webSockets } from "@libp2p/websockets";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@chainsafe/libp2p-identify";
import { tcp } from "@libp2p/tcp"
import isBrowser from "is-browser";
import { PROTOCOL, TIMEOUT_RESPONSE_IN_MS, TOPICS } from "./constants";

type Subscribers = Record<string, (resolve: { detail: Message, direct: Promise<Buffer | undefined>,  }) => void>;

const initialize = async () => {
    const subscribers: Subscribers = {};
    const callbacks: Record<string, (resolve: Buffer) => void> = {};
    const peerIds: { peerId: PeerId, id: string }[] = [];
    const messenger = await createLibp2p({
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
    TOPICS.forEach(topic => messenger.services.pubsub.subscribe(topic));
    messenger.services.pubsub.addEventListener("message", (message) => {
        let callback: (resolve: Buffer) => void = null!;
        const promise = new Promise<Buffer | undefined>((resolve) => {
            callback = resolve;
            setTimeout(resolve, TIMEOUT_RESPONSE_IN_MS);
        });
        Object.keys(subscribers).map(sub => {
            subscribers[sub]!({
                detail: message.detail,
                direct: promise,
            });
            callbacks[sub] = callback;
        });
    });
    const waitForResponse = async (
        id: string,
        waitFor: (regPeerId: (peerId: PeerId) => void,
        trigger: () => void,
    ) => Subscribers[""]) => {
        const promise = new Promise<void>((resolve) => {
            subscribers[id] = waitFor(
                (peerId: PeerId) => {
                    peerIds.push({ peerId, id });
                },
                () => {
                    delete subscribers[id];
                    resolve();
                },
            );
        });
        return promise;
    };
    messenger.handle(PROTOCOL, async ({ connection, stream }) => {
        const key = connection.remotePeer.toString();
        const callback = callbacks[key];
        if (!callback) {
            stream.close();
        } else {
            const chunks: Uint8Array[] = [];
            for await (const chunk of stream.source) {
                for (const part of chunk) {
                    chunks.push(part);
                }
            }
            const buffer = Buffer.concat(chunks);
            callback(buffer);
            stream.close();
        }
    });
    return {
        messenger,
        waitForResponse,
    };
};

let node: {
    messenger: Libp2p<{ pubsub: ReturnType<ReturnType<typeof gossipsub>>; identify: unknown; }>;
    waitForResponse: (id: string, waitFor: (regPeerId: (peerId: PeerId) => void, trigger: () => void) => Subscribers[""]) => Promise<void>;
} = null!;

export const Node = {
    get instance() {
        return new Promise<typeof node>(async resolve => resolve(node ||= await initialize()));
    }
}
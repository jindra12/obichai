import { createLibp2p, Libp2p } from "libp2p";
import { Message } from "@libp2p/interface";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { webSockets } from "@libp2p/websockets";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@chainsafe/libp2p-identify";
import { tcp } from "@libp2p/tcp"
import isBrowser from "is-browser";
import uniqueId from "lodash/uniqueId";
import { TOPICS } from "./constants";

type Subscribers = Record<string, (resolve: { detail: Message }) => void>;

const initialize = async () => {
    const subscribers: Subscribers = {};
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
        Object.keys(subscribers).map(sub => subscribers[sub]!({ detail: message.detail }));
    });
    const waitForResponse = async (waitFor: (trigger: () => void) => Subscribers[""]) => {
        const id = uniqueId("subs");
        const promise = new Promise<void>((resolve) => {
            subscribers[id] = waitFor(() => {
                delete subscribers[id];
                resolve();
            });
        });
        return promise;
    };
    return {
        messenger,
        waitForResponse,
    };
};

let node: {
    messenger: Libp2p<{ pubsub: ReturnType<ReturnType<typeof gossipsub>>; identify: unknown; }>;
    waitForResponse: (waitFor: (trigger: () => void) => Subscribers[""]) => Promise<void>;

} = null!;

export const Node = {
    get instance() {
        return new Promise<typeof node>(async resolve => resolve(node ||= await initialize()));
    }
}
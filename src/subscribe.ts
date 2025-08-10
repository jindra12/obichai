import { createLibp2p } from "libp2p";
import { webRTC } from "@libp2p/webrtc";
import { noise } from "@chainsafe/libp2p-noise";
import { webSockets } from "@libp2p/websockets";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { yamux } from "@chainsafe/libp2p-yamux";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { identify } from "@chainsafe/libp2p-identify";
import { tcp } from "@libp2p/tcp"
import isBrowser from "is-browser";
import { DePromise } from "./types";

const initialize = async () => {
    return await createLibp2p({
        transports: isBrowser ? [tcp(), webSockets()] : [webRTC()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
            pubsubPeerDiscovery({
                interval: 10000,
                topics: ['peer-discovery'],
                listenOnly: false,
            }),
        ],
        services: {
            pubsub: gossipsub(),
            identify: identify() as any,
        },
    });
};

let node: DePromise<ReturnType<typeof createLibp2p>> = null!;

export const Node = {
    get P2P() {
        return new Promise<typeof node>(async resolve => resolve(node ||= await initialize()));
    }
}
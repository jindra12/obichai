export interface Wallet {
    privateKey: string;
    publicKey: string;
    address: string;
}

export interface ProofPart {
    position: "left" | "right";
    data: Buffer;
}

export type SubNegation = {
    proof: ProofPart[];
    leaf: Buffer;
};

export type NegativeProof = ({
    left: SubNegation;
    right: SubNegation;
} | {
    left: SubNegation;
    right?: undefined;

} | {
    left?: undefined;
    right: SubNegation;
}) & {
    not: Buffer;
};

export type EitherProof = {
    positive: {
        proof: ProofPart[];
        leaf: Buffer;
    };
    negative?: undefined;
} | {
    positive?: undefined;
    negative: NegativeProof;
}

export type DePromise<T> = T extends Promise<infer P> ? P : never;
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

export type DiffResult = {
    MAIN: MainBlockType,
    SIDE: BlobHashType,
    TRANSACTION: MessageFormat;
    PADDING_BIG: PaddingFormat;
    PADDING_SMALL: PaddingFormat;
};

export interface PaddingFormat {
    index: bigint,
    difficulty: Buffer;
    hash: Buffer;
}

export interface BlobHashType {
    type: Buffer;
    merkle: Buffer;
    bloom: Buffer;
    author: Buffer;
    difficulty: Buffer;
}

export interface MainBlockType {
    id: bigint;
    timestamp: bigint;
    prevHash: Buffer;
    author: Buffer;
    blobs: BlobHashType[];
    difficulty: Buffer;
    padding: PaddingFormat[];
    limit: Buffer;
}

export type TransactionValidationFormat<T extends object> = {
    prev: MainBlockType;
    block: MainBlockType;
    queried?: T;
    current: T;
};

export interface MessageFormat {
    from: Buffer;
    to: Buffer;
    data: Buffer;
    note: Buffer;
    difficulty: Buffer;
}

export interface CoinType {
    from: Buffer;
    to: Buffer;
    author: Buffer;
    amount: bigint;
    nextBalance: bigint;
    type: "MINT" | "FROM" | "TO" | "ATTESTATION";
    relatedTo?: Buffer;
}

export interface TokenType {
    from: Buffer;
    to: Buffer;
    amount: bigint;
    nextBalance: bigint;
    type: "MINT" | "FROM" | "TO" | "ATTESTATION";
    relatedTo?: Buffer;
}

export interface NftType {
    author: Buffer;
    series: Buffer;
    identity: Buffer;
    from: Buffer;
    to: Buffer;
    type: "MINT" | "TRANSFER" | "ATTESTATION";
}

export interface SwapType {
    balance1: bigint;
    balance2: bigint;
    token1: Buffer;
    token2: Buffer;
    lpToken: Buffer;
    type: "FUND" | "WITHDRAW" | "SWAP1" | "SWAP2";
    address: Buffer;
    relatedTo1: Buffer;
    relatedTo2: Buffer;
}

export interface NftSaleType {
    series: Buffer;
    identity: Buffer;
    price: BigInt;
    token: Buffer;
    address: Buffer;
    type: "BUY" | "SELL";
    relatedTo: Buffer;
}

export interface QueryType {
    proof: ProofPart[];
    signature: Buffer;
    transaction: Buffer;
}

export interface TypedQueries {
    type: Buffer;
    queries: QueryType[];
    padding: PaddingFormat[];
}

export interface QueriesType {
    results: TypedQueries[];
    hash: Buffer;
    index: bigint;
}

export interface MultiBlockQueriesType {
    queries: QueriesType[];
}

export interface TransactionWithMetadata {
    transaction: Buffer;
    blockHash: Buffer;
    index: bigint;
}

export interface ValidationCriteria {
    anyOf: {
        allOf: string[];
    }[];
};

export interface FloodMessage {
    type: "REQUEST" | "RESPONSE" | "READY";
    key: Buffer;
}

export type SignedMessage = ({
    r: Buffer;
    s: Buffer;
    v: Buffer;
    type: "MANUAL";
} | {
    rule: Buffer;
    hash: Buffer;
    index: bigint;
    type: "AUTO";
}) & {
    transaction: Buffer;
};

export type DifficultyType = "MAIN" | "SIDE" | "TRANSACTION" | "PADDING_BIG" | "PADDING_SMALL";

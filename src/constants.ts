import { DifficultyType } from "./types";

export const NUMBER_OF_BLOBS = 10;
export const NUMBER_OF_TRANSACTIONS = 300;
export const BYTE_LENGTH_TRANSACTION_COUNT = 1;
export const HASH_LENGTH_WITH_INDEX = 33;
export const DIFFICULTY_SIZE = 8;
export const DEFAULT_DIFFICULTY = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn;
export const EXPECTED_TIME_IN_MILLIS = 60 * 1000;
export const DIFFICULTY_COEFS: Record<DifficultyType, bigint> = {
    MAIN: 1n,
    PADDING_BIG: 2n,
    SIDE: 4n,
    PADDING_SMALL: 8n,
    TRANSACTION: 16n,
};
export const GIVE_UP_HASHING = 60 * 1000;
export const ARGON_SALT = "Vítejte v systému Obichai";
export const BIG_PADDING_COEFF = 5;
export const SMALL_PADDING_COEFF = 20;
export const QUERY_TRANSACTION = "QUERY_TRANSACTION";
export const QUERIES_TRANSACTION = "QUERIES_TRANSACTION";
export const SEND_MESSAGE_TOPIC = "SEND_MESSAGE";
export const UPDATE_MAIN = "UPDATE_MAIN";
export const PROTOCOL = "/obichai/1.0.0";
export const TOPICS = [QUERY_TRANSACTION, QUERIES_TRANSACTION, SEND_MESSAGE_TOPIC, UPDATE_MAIN];
export const TIMEOUT_RESPONSE_IN_MS = 1000 * 30;

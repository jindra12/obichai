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
    SIDE: 4n,
    PADDING: 8n,
    TRANSACTION: 16n,
};
export const GIVE_UP_HASHING = 60 * 1000;
export const ARGON_SALT = "Vítejte v systému Obichai";

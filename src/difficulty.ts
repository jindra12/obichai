import BigNumber from "bignumber.js";
import { randomBytes } from "crypto";
import { Storage } from "./storage";
import { DifficultyType, DiffResult, MainBlockType } from "./types";
import { DEFAULT_DIFFICULTY, DIFFICULTY_COEFS, DIFFICULTY_SIZE, EXPECTED_TIME_IN_MILLIS } from "./constants";
import { mainBlockType } from "./serializer";
import { getWorker, workers } from "./pool";

export const setDifficulty = async (type: DifficultyType, difficulty: BigInt) => {
    await Storage.instance.setItem(type, difficulty);
};

export const getDifficulty = async (type: DifficultyType) => {
    const difficulty = await Storage.instance.getItem<string>(type);
    return difficulty ? BigInt(difficulty) : DEFAULT_DIFFICULTY;
};

export const recomputeDifficulty = async (difficulty: bigint, timestamps: bigint[]) => {
    const ratios = timestamps.reduce((ratios: BigNumber[], current, index) => {
        if (index !== 0) {
            const prev = timestamps[index - 1]!;
            const ratio = (
                BigNumber(EXPECTED_TIME_IN_MILLIS)
            )
                .div(BigNumber(current)
                    .minus(prev)
                )
            ratios.push(ratio);
        }
        return ratios;
    }, []);
    const ratio = ratios.reduce((ratio, item) => ratio.plus(item), BigNumber(0)).div(ratios.length);
    const next = BigNumber(difficulty).multipliedBy(
        ratio,
    );
    return BigInt(next.integerValue(BigNumber.ROUND_HALF_UP).toFixed(0));
};

export const addLimit = async (main: Buffer) => {
    const block: MainBlockType = mainBlockType.fromBuffer(main);
    block.limit = Buffer.from((await getDifficulty("MAIN")).toString(16), "hex");
    return mainBlockType.toBuffer(block);
};

export const getLimitFromBlock = (main: Buffer, type: DifficultyType) => {
    const block: MainBlockType = mainBlockType.fromBuffer(main);
    const limit = BigInt(`0x${block.limit}`);
    return limit * DIFFICULTY_COEFS[type];
};

export const computeDifficulty = async <T extends DifficultyType>(buffer: Buffer, type: T) => {    
    const difficulty = await getDifficulty(type);
    const hashers: Promise<DiffResult[T] | undefined>[] = [];
    for (let i = 0; i < workers.length; i++) {
        hashers.push(workers[i]!.hashArgon(
            buffer,
            BigInt(`0x${randomBytes(DIFFICULTY_SIZE).toString("hex")}`),
            type,
            difficulty,
        ));
    }
    const result = Promise.race(hashers);
    workers.forEach(worker => worker.stopArgon());
    return result;
};

export const verifyDifficulty = async <T extends DifficultyType>(buffer: Buffer, type: T) => {
    const difficulty = await getDifficulty(type);
    return await getWorker().verifyArgon(buffer, type, difficulty);
};

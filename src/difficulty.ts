import BigNumber from "bignumber.js";
import { spawn, Worker } from "threads";
import { randomBytes } from "crypto";
import shuffle from "lodash/shuffle";
import { Storage } from "./storage";
import { DifficultyType, DiffResult } from "./types";
import { DEFAULT_DIFFICULTY, DIFFICULTY_COEFS, DIFFICULTY_SIZE, EXPECTED_TIME_IN_MILLIS, GIVE_UP_HASHING } from "./constants";
import { WorkerType } from "./worker";

export const setDifficulty = async (type: DifficultyType, difficulty: BigInt) => {
    await Storage.instance.setItem(type, difficulty);
};

export const getDifficulty = async (type: DifficultyType) => {
    const difficulty = await Storage.instance.getItem<string>(type);
    return difficulty ? BigInt(difficulty) : DEFAULT_DIFFICULTY;
};

export const recomputeDifficulty = async (type: DifficultyType, timestamps: bigint[]) => {
    const ratios = timestamps.reduce((ratios: BigNumber[], current, index) => {
        if (index !== 0) {
            const prev = timestamps[index - 1]!;
            const ratio = (
                BigNumber(EXPECTED_TIME_IN_MILLIS)
            )
                .div(BigNumber(current)
                    .minus(prev)
                )
                .multipliedBy(DIFFICULTY_COEFS[type])
            ratios.push(ratio);
        }
        return ratios;
    }, []);
    const ratio = ratios.reduce((ratio, item) => ratio.plus(item), BigNumber(0)).div(ratios.length);
    const next = BigNumber(await getDifficulty(type)).multipliedBy(
        ratio,
    );
    return BigInt(next.integerValue(BigNumber.ROUND_HALF_UP).toFixed(0));
};

const workers: WorkerType[] = [];

export const initPool = async (count: number) => {
    for (let i = 0; i < count; i++) {
        workers.push((await spawn(new Worker("./worker"), { timeout: GIVE_UP_HASHING })) as any as WorkerType);
    }
};

export const getWorker = () => shuffle(workers)[0]!

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

import { spawn, Worker } from "threads";
import shuffle from "lodash/shuffle";
import { GIVE_UP_HASHING } from "./constants";
import { WorkerType } from "./worker";

export const workers: WorkerType[] = [];

export const initPool = async (count: number) => {
    for (let i = 0; i < count; i++) {
        workers.push((await spawn(new Worker("./worker"), { timeout: GIVE_UP_HASHING })) as any as WorkerType);
    }
};

export const getWorker = () => shuffle(workers)[0]!
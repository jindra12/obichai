import { BloomFilter } from "bloom-filters";

export const createBloom = (hashes: Buffer[]) => {
    const bloom = hashes.reduce((bloom, hash) => {
        bloom.add(hash);
        return bloom;
    }, BloomFilter.create(hashes.length, 0.01));
    return Buffer.from(JSON.stringify(bloom.saveAsJSON()), "utf-8");
};

export const verifyBloom = (bloom: Buffer, hash: string) => {
    return (
        (
            BloomFilter.fromJSON(JSON.parse(bloom.toString("utf-8")))
        ) as BloomFilter
    ).has(hash);
};

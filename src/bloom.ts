import { BloomFilter } from "bloom-filters";

export const createBloom = (hashes: Buffer[]) => {
    const bloom = hashes.reduce((bloom, hash) => {
        bloom.add(hash);
        return bloom;
    }, BloomFilter.create(hashes.length, 0.01));
    return JSON.stringify(bloom.saveAsJSON());
};

export const verifyBloom = (bloom: string, hash: string) => {
    return (
        (
            BloomFilter.fromJSON(JSON.parse(bloom))
        ) as BloomFilter
    ).has(hash);
};

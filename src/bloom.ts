import { BloomFilter } from "bloom-filters";

export const createBloom = (typeHashes: Record<string, Buffer[]>) => {
    const entries = Object.entries(typeHashes);
    const bloom = entries.reduce((bloom, [type, hashes]) => {
        hashes.forEach(hash => {
            bloom.add(Buffer.concat([Buffer.from(type, "hex"), hash]));
        });
        return bloom;
    }, BloomFilter.create(entries.reduce((length, [_, hashes]) => length + hashes.length, 0), 0.01));
    return JSON.stringify(bloom.saveAsJSON());
};

export const verifyBloom = (bloom: string, type: string, hash: string) => {
    return (
        (
            BloomFilter.fromJSON(JSON.parse(bloom))
        ) as BloomFilter
    ).has(type + hash);
};

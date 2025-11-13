import groupBy from "lodash/groupBy";
import { NUMBER_OF_TRANSACTIONS, SMALL_PADDING_COEFF } from "./constants";
import { Types } from "./dynamic-types";
import { getBlock, getLatestItem, pushItems } from "./indexer";
import { createMerkle, verifyMerkleProof } from "./merkle";
import { mainBlockType, messageType } from "./serializer";
import { Storage } from "./storage";
import { MainBlockType, MultiBlockQueriesType, QueriesType, MessageFormat, QueryType, TypedQueries } from "./types";
import { compareBuffers, sha256CompactKey } from "./utils";
import { verifySignature } from "./wallet";
import { get } from "typedots";
import { isMessageValid } from "./validator";
import { verifyPadding } from "./padding";

export const storeQueries = async (
    queries: QueriesType,
) => {
    const types = await Types.instance;
    for (let i = 0; i < queries.results.length; i++) {
        const result = queries.results[i]!;
        const {
            schema,
            query,
        } = await types.getType(result.type);
        const items: Buffer[] = [];
        for (let j = 0; j < result.queries.length; j++) {
            items.push(result.queries[j]!.transaction);
        }
        await pushItems(
            items,
            schema,
            query,
            queries.hash,
            result.type,
            queries.index,
        );
    }
};

export const validateQueriesContent = async (queries: QueriesType) => {
    const block = await getBlock(queries.hash);
    const prev = await getBlock(block.prevHash);
    const types = await Types.instance;
    for (let i = 0; i < queries.results.length; i++) {
        const results = queries.results[i]!;
        const type = results.type;
        const {
            query,
            rules,
            schema,
            unique,
        } = await types.getType(type);
        const objs = await Promise.all(results.queries.map(async q => {
            const message: MessageFormat = messageType.fromBuffer(q.transaction);
            return schema.fromBuffer(message.data);
        }));
        for (let j = 0; j < unique.length; j++) {
            const prop = unique[j]!;
            const grouped = groupBy(objs, obj => (get as any)(obj, prop));
            if (!Object.values(grouped).every(g => g.length === 1)) {
                return false;
            }
        }
        for (let j = 0; j < results.queries.length; j++ ) {
            const result = results.queries[j]!;
            const { latest } = await getLatestItem<Record<string, object>>(
                result.transaction,
                schema,
                query,
            );
            const message: MessageFormat = messageType.fromBuffer(result.transaction);
            const validated = await isMessageValid({
                prev: prev,
                current: objs[j]!,
                queried: latest,
                signer: message.from,
            }, rules);
            if (!validated) {
                return false;
            }
        }
    }
    return true;
};

export const validateQueriesSignature = async (
    queries: QueriesType,
) => {
    const transactions = queries.results.flatMap(r => r.queries).map(q => q.transaction);
    for (let i = 0; i < transactions.length; i++) {
        const { valid } = await verifySignature(transactions[i]!);
        if (!valid) {
            return false;
        }
    }
    return true;
}

export const validateQuery = async (
    block: MainBlockType,
    queries: QueriesType,
    type: "partial" | "full"
) => {
    if (!validateQueriesSignature(queries)) {
        return false;
    }
    for (let i = 0; i < queries.results.length; i++) {
        const blob = block.blobs[i]!;
        const query = queries.results[i]!;
        const paddingCount = (NUMBER_OF_TRANSACTIONS - query.queries.length) / SMALL_PADDING_COEFF;
        if (compareBuffers(query.type, blob.type) !== 0) {
            return false;
        }
        const transactions = query.queries.map(q => q.transaction);
        const isFull = type === "full";
        if (isFull) {
            if (query.padding.length * SMALL_PADDING_COEFF + query.queries.length < NUMBER_OF_TRANSACTIONS) {
                return false;
            }
            const paddingHash = Buffer.from(sha256CompactKey(Buffer.concat([block.prevHash, query.type])), "base64");
            if (!await verifyPadding(paddingHash, paddingCount, query.padding, "PADDING_SMALL")) {
                return false;
            }
            if (compareBuffers(blob.merkle.includes, createMerkle(transactions).root) !== 0) {
                return false;
            }
        } else {
            if (query.queries.some((q, i) => !verifyMerkleProof(blob.merkle.includes, { positive: { leaf: transactions[i]!, proof: q.proof } }))) {
                return false;
            }
        }
    }
    return true;
};

export const validateMultiBlockQuery = async (multiQuery: MultiBlockQueriesType, type: "partial" | "full") => {
    const storage = Storage.instance;
    const blocks = await Promise.all(multiQuery.queries.map(async q => storage.getItem(q.hash.toString("base64")) as Promise<string>));
    const mains: MainBlockType[] = blocks.map(b => mainBlockType.fromBuffer(Buffer.from(b, "base64")));
    for (let i = 0; i < mains.length; i++) {
        if (!validateQuery(mains[i]!, multiQuery.queries[i]!, type)) {
            return false;
        }
    }
    return true;
};

export const manufactureQuery = async (transactions: QueryType[]) => {

}

export const manufactureQueries = async (transactions: TypedQueries[]) => {

};

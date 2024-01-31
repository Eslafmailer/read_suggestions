import {printError} from "./utils";
import randomWords from "random-words";
import {Book, db, DB} from "./shared";
import {writeFileSync} from "fs";

interface Mapping {
    names: Record<string, string>;
    authors: Record<string, string>;
    categories: Record<string, string>;
    tags: Record<string, string>;
}
export const MAPPING_FILE_NAME = 'mapping.json';
export const mapping: Mapping = {
    names: {},
    authors: {},
    categories: {},
    tags: {},
};

export const DATA_FILE_NAME = 'data.json';
export const data: DB = {};

(async () => {
    for(const book of Object.values(db)) {
        book.name = anonymize('names', book.name, 5);
        anonymizeAll('authors', book);
        anonymizeAll('categories', book);
        anonymizeAll('tags', book);

        data[book.name] = book;
    }
    writeFileSync(DATA_FILE_NAME, JSON.stringify(data, null, 2));
    writeFileSync(MAPPING_FILE_NAME, JSON.stringify(mapping, null, 2));
})().catch(printError);

function anonymizeAll<K extends (keyof Mapping & keyof Book)>(key: K, book: Book) {
    book[key] = book[key].map(x => anonymize(key, x, 2));
}
function anonymize<K extends keyof Mapping>(key: K, value: string, length: number): string {
    let cache: Record<string, string> = mapping[key];
    let anonymized = cache[value];
    if(!anonymized) {
        anonymized = cache[value] = generate(key, length);
    }

    return anonymized;
}

function generate<K extends keyof Mapping>(key: K, length: number): string {
    while (true) {
        const words = randomWords({exactly: length, join: '-'});
        if(!mapping[key[words]]) {
            return words;
        }
    }
}
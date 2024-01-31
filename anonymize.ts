import {printError} from "./utils";
import randomWords from "random-words";
import {Book, db, DB} from "./shared";
import {existsSync, readFileSync, writeFileSync} from "fs";

export const MAPPING_FILE_NAME = 'mapping.json';
export const mapping: Record<string, string> =existsSync(MAPPING_FILE_NAME) ? JSON.parse(readFileSync(MAPPING_FILE_NAME, 'utf-8')) : {};

export const DATA_FILE_NAME = 'data.json';
export const data: DB = {};

(async () => {
    for(const book of Object.values(db)) {
        book.name = anonymize(book.name, 5);
        anonymizeAll('authors', book);
        anonymizeAll('categories', book);
        anonymizeAll('tags', book);

        data[book.name] = book;
    }
    writeFileSync(DATA_FILE_NAME, JSON.stringify(data, null, 2));
    writeFileSync(MAPPING_FILE_NAME, JSON.stringify(mapping, null, 2));
})().catch(printError);

function anonymizeAll<K extends 'authors' | 'categories' | 'tags'>(key: K, book: Book) {
    book[key] = book[key].map(x => anonymize(x, 2));
}
function anonymize(value: string, length: number): string {
    let anonymized = mapping[value];
    if(!anonymized) {
        anonymized = mapping[value] = generate(length);
    }

    return anonymized;
}

function generate(length: number): string {
    while (true) {
        const words = randomWords({exactly: length, join: '-'});
        if(!mapping[words]) {
            return words;
        }
    }
}
import {readFileSync} from "fs";
import {printError, promiseAll} from "./utils";
import {addToFavorites, db, enableFavorites} from "./shared";
import {loadBook} from "./load-book";
import {mapping} from "./anonymize";

export const RESULT_FILE_NAME = 'result.json';
export const result: string[] = JSON.parse(readFileSync(RESULT_FILE_NAME, 'utf-8'));

(async () => {
    await enableFavorites();

    const mappings = Object.entries(mapping);
    await promiseAll(result, async name_ => {
        const name = mappings.find(x => x[1] === name_)?.[0];
        if(!name) {
            console.warn(`Can't de-anonymize: ${name_}`);
            return;
        }

        const existingBook = db[name];
        if(existingBook?.label !== undefined) {
            console.warn(`Already marked: ${name}`);
            return;
        }

        const book = await loadBook(name);
        if(!book) {
            console.warn(`Book not found: ${name}`);
            return;
        }

        await addToFavorites(book.id, 4);
    });
})().catch(printError);
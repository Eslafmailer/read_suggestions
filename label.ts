import {db, DB_FILE_NAME, enableFavorites, loadPagedLinks, walkPagedLinks} from "./shared";
import {printError} from "./utils";
import {loadBook} from "./load-book";
import {writeFileSync} from "fs";

(async () => {
    await enableFavorites();

    console.log('Loading False labels');
    await walkPagedLinks(
        loadFalseLinks,
        async name => {
            let book = db[name];
            if (!book) {
                book = await loadBook(name);
                if (!book) {
                    return;
                }

                db[name] = book;
            }

            book.label = false;
        }, async () => {
            writeFileSync(DB_FILE_NAME, JSON.stringify(db, null, 2));
        });

    console.log('Loading True labels');
    await walkPagedLinks(
        loadTrueLinks,
        async name => {
            let book = db[name];
            if (!book) {
                book = await loadBook(name);
                if (!book) {
                    return;
                }

                db[name] = book;
            }

            book.label = true;
        }, async () => {
            writeFileSync(DB_FILE_NAME, JSON.stringify(db, null, 2));
        });
})().catch(printError);

async function loadTrueLinks(page: number): Promise<{ names: string[], last: boolean }> {
    return loadPagedLinks(page, 'Ym9va21hcmsvcmVhZGluZy9hbGwvbmFtZS1heg==');
}

async function loadFalseLinks(page: number): Promise<{ names: string[], last: boolean }> {
    return loadPagedLinks(page, 'Ym9va21hcmsvb24taG9sZC9hbGwvbmFtZS1heg==');
}
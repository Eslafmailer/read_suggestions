import {writeFileSync} from "fs";
import {printError} from "./utils";
import {db, DB_FILE_NAME, enableFavorites, Links, loadPagedLinks, walkPagedLinks} from "./shared";
import {loadBook} from "./load-book";

(async () => {
    await enableFavorites();
    await walkPagedLinks(
        loadLinksFromAll,
        async name => {
            if (db[name]) {
                console.log(`Book is already in DB: ${name}`);
                return false;
            }

            const book = await loadBook(name);
            if (book) {
                db[name] = book;
            }

            return undefined;
        }, async () => {
            writeFileSync(DB_FILE_NAME, JSON.stringify(db, null, 2));
        });
})().catch(printError);

async function loadLinksFromAll(page: number): Promise<Links> {
    return loadPagedLinks(page, 'aGVudGFpLWxpc3QvYWxsL2FueS9hbGwvbGFzdC1hZGRlZA==');
}


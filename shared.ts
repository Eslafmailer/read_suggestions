import axios, {AxiosResponse} from "axios";
import {load} from "cheerio";
import {isTruthy, promiseAll} from "./utils";
import {existsSync, readFileSync} from "fs";

export interface Book {
    name: string;
    views: number;
    year?: number;
    pages: number;
    chapters: number;
    authors: string[];
    categories: string[];
    tags: string[];
    votes: number;
    score: number;
    label?: boolean;
}


export interface Config {
    url: string;
    cookie: string;
}

export const CONFIG_FILE_NAME = 'config.json';
export const config: Config = JSON.parse(readFileSync(CONFIG_FILE_NAME, 'utf-8'));
config.url = atob(config.url)

export type DB = Record<string, Book>;
export const DB_FILE_NAME = 'db.json';
export const db: DB = existsSync(DB_FILE_NAME) ? JSON.parse(readFileSync(DB_FILE_NAME, 'utf-8')) : {};

export interface Links {
    names: string[];
    last: boolean;
}

export async function loadPagedLinks(page: number, path: string): Promise<Links> {
    console.log(`Loading page ${page}`);
    const PAGE_SIZE = 48;
    const url = config.url + `/${atob(path)}/${page}/`;
    const data = await loadWebPage(url);
    const $ = load(data);

    const pages = $('.pagination li').get().map(x => $(x).text().trim()).filter(isTruthy).at(-1);
    if(!pages) {
        throw new Error(`Can't find pagination ${url}`);
    }
    console.log(`Loaded page ${page}/${pages}`)

    const $links = $('.overlay-button .btn:nth-child(2)');
    const links = $links.get().map(x => $(x).attr('href')).filter(isTruthy);
    const lastPage = pages === page.toString();
    if (links.length < PAGE_SIZE && !lastPage) {
        throw new Error(`Missing items on the page (${links.length} instead of ${PAGE_SIZE}) ${url}`);
    }

    return {
        names: links.map(link => link.replace(config.url + '/', '').replace(/\/$/, '')),
        last: lastPage,
    };
}

export async function loadWebPage(url: string): Promise<string> {
    const MAX_ATTEMPTS = 3;
    let attempt = 0;

    while (true) {
        try {
            const {data}: AxiosResponse<string> = await axios.get(url, {
                headers: {
                    'Cookie': config.cookie
                },
            });
            return data;
        } catch (ex) {
            attempt++;
            if (attempt > MAX_ATTEMPTS) {
                throw ex;
            }
        }
    }
}

export async function walkPagedLinks(loadLinks: (page: number) => Promise<Links>, onLink: (name: string) => Promise<void>, onPage?: () => Promise<void>) {
    let page = 1;
    while (true) {
        const {names, last} = await loadLinks(page++);
        await promiseAll(names, onLink);

        onPage?.();
        if (last) {
            break;
        }
    }
}

export async function enableFavorites() {
    const {data}: AxiosResponse<{
        status: number;
    }> = await axios.post(config.url + '/api', {
        controller: "manga",
        action: "bookmark",
        mid: "38385",
        mode: "5",
    }, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Cookie': config.cookie
        },
    });
    if (data.status !== 1) {
        console.log(JSON.stringify(data, null, 2));
        throw new Error(`Failed to enable favorites`);
    } else {
        console.log('Enabled favorites');
    }
}
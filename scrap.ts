import axios, { AxiosResponse } from "axios";
import { readFileSync, writeFileSync } from "fs";
import {isTruthy, printError} from "./utils";
import {load} from "cheerio";

interface Config {
    url: string;
    cookie: string;
}
const config: Config = JSON.parse(readFileSync('config.json', 'utf-8'));

type DB = Record<string, Book>;
const DB_FILE_NAME = 'db.json';
const db: DB = JSON.parse(readFileSync(DB_FILE_NAME, 'utf-8'));

interface Book {
    name: string;
    views: number;
    year?: number;
    pages: number;
    authors: string[];
    categories: string[];
    tags: string[];
    votes?: number;
    score?: number;
}

(async () => {
    await enableFavorites();

    let page = 1;
    while(true) {
        const {names, last} = await loadPage(page++);
        for(const name of names) {
            if(db[name]) {
                console.log(`Book is already in DB: ${name}`);
                continue;
            }

            db[name] = await loadBook(name);
        }

        writeFileSync(DB_FILE_NAME, JSON.stringify(db, null, 2));
        if(last) {
            break;
        }
    }
})().catch(printError);

async function enableFavorites() {
    const {data}: AxiosResponse<{
        status: number;
    }> = await axios.post( config.url + '/api', {
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
    if(data.status !== 1) {
        console.log(JSON.stringify(data, null, 2));
        throw new Error(`Failed to enable favorites`);
    } else {
        console.log('Enabled favorites');
    }
}

async function loadPage(page: number): Promise<{names: string[], last: boolean}> {
    console.log(`Loading page ${page}`);
    const PAGE_SIZE = 48;
    const url = config.url + `/hentai-list/all/any/all/last-added/${page}/`;
    const {data}: AxiosResponse<string> = await axios.post( url, {
        headers: {
            'Cookie': config.cookie
        },
    });
    const $ = load(data);

    const pages = $('.pagination li').eq(-2).text();
    console.log(`Loaded page ${page}/${pages}`)

    const $links = $('.overlay-button .akira:nth-child(2)');
    const links = $links.get().map(x => $(x).attr('href')).filter(isTruthy);
    const lastPage = pages === page.toString();
    if(links.length < PAGE_SIZE && !lastPage) {
        throw new Error(`Missing items on the page (${links.length} instead of ${PAGE_SIZE}) ${url}`);
    }

    return {
        names: links.map(link => link.replace(config.url + '/', '').replace(/\/$/, '')),
        last: lastPage,
    };
}

async function loadBook(name: string): Promise<Book> {
    console.log(`Loading book ${name}`);
    const url = config.url + `/${name}/`;
    const {data}: AxiosResponse<string> = await axios.post( url, {
        headers: {
            'Cookie': config.cookie
        },
    });
    const $ = load(data);
    const $infos = $('.list.list-simple-mini .text-primary');
    const infos = new Map<string, string[]>();
    $infos.get().map(info => {
        let $info = $(info);
        const name = $info.find('b').text().trim().toLowerCase();
        if(!name) {
            return;
        }

        const values = $info.find('a').get().map(x => $(x).text().trim().toLowerCase()).filter(isTruthy);
        infos.set(name, values);
    });

    const getViews = (): number => {
        const [value] = infos.get('view') ?? [];
        if(!value) {
            throw new Error(`Missing view section: ${url}`);
        }

        const result = /^([\d,]+) views/.exec(value);
        const viewsStr = result?.[1];
        if(!viewsStr) {
            throw new Error(`Can't parse view: '${value}' ${url}`);
        }

        let views = Number(viewsStr.replace(',', ''));
        if(isNaN(views)) {
            throw new Error(`Can't parse views: '${value}' ${url}`);
        }

        return views;
    }
    const getPages = (): number => {
        const [value] = infos.get('page') ?? [];
        if(!value) {
            throw new Error(`Missing page section: ${url}`);
        }

        const result = /^(\d+) pages/.exec(value);
        if(!result) {
            throw new Error(`Can't parse pages: '${value}' ${url}`);
        }

        let pages = Number(result[1]);
        if(isNaN(pages)) {
            throw new Error(`Can't parse pages: '${value}' ${url}`);
        }

        return pages;
    }

    const getYear = (): number | undefined => {
        const [value] = infos.get('release year') ?? [];
        if(!value) {
            throw new Error(`Missing year section: ${url}`);
        }

        if(value === '-') {
            return undefined;
        }

        const result = /^(\d+)/.exec(value);
        if(!result) {
            throw new Error(`Can't parse year: '${value}' ${url}`);
        }

        const year = Number(result[1]);
        if(isNaN(year)) {
            throw new Error(`Can't parse year: '${value}' ${url}`);
        }

        return year;
    }

    const getAuthors = (): string[] => {
        const authors = infos.get('author');
        if(!authors) {
            throw new Error(`Missing author section: ${url}`);
        }

        return authors;
    }
    const getCategories = (): string[] => {
        const categories = infos.get('category');
        if(!categories) {
            throw new Error(`Missing category section: ${url}`);
        }

        return categories;
    }
    const getTags = (): string[] => {
        const tags = infos.get('content');
        if(!tags) {
            throw new Error(`Missing content section: ${url}`);
        }

        return tags;
    }

    const rating = $('.js-raty').siblings().first().text();
    const parsedRating = /score ([\d.]+)\/5 with (\d+) votes/.exec(rating);
    const [_, scoreStr, votesStr] = parsedRating ?? [];
    if(!scoreStr || !votesStr) {
        throw new Error(`Can't parse rating: '${rating}' ${url}`);
    }

    const score = Number(scoreStr);
    if(isNaN(score)) {
        throw new Error(`Can't parse score: '${rating}' ${url}`);
    }

    const votes = Number(votesStr);
    if(isNaN(votes)) {
        throw new Error(`Can't parse votes: '${rating}' ${url}`);
    }

    return {
        name,
        views: getViews(),
        pages: getPages(),
        year: getYear(),
        authors: getAuthors(),
        categories: getCategories(),
        tags: getTags(),
        score,
        votes,
    };
}
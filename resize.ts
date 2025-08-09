import {readdirSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import {join, parse} from 'path';
import tqdm from 'tqdm';
import sharp from 'sharp';
import {printError} from "./utils";
import joinImages from 'join-images';
import { stdin, stdout } from 'process';

const INPUT_FOLDER = join(__dirname, 'images/true');
const OUTPUT_FOLDER = join(__dirname, 'static/images');
const OUTPUT_MAPPING = join(__dirname, 'static/images.js');
const CHUNK_SIZE = 10;

const mapping: Record<string, {
    image: string;
    index: number;
}> = {};

type Chunk = { name: string, buffer: Buffer }[];
(async () => {
    const password = await askPassword();
    const files = readdirSync(INPUT_FOLDER);

    const chunk: Chunk = [];
    for(let file of tqdm(files)) {
        const input = join(INPUT_FOLDER, file);
        const buffer = await sharp(input)
            .resize(200, 200)
            .toBuffer();
        chunk.push({
            name: parse(file).name,
            buffer,
        });
        if(chunk.length === CHUNK_SIZE) {
            await writeChunk(chunk, password);
            chunk.length = 0;
        }
    }

    if(chunk.length) {
        await writeChunk(chunk, password);
    }

    writeFileSync(OUTPUT_MAPPING, `var images = ${JSON.stringify(mapping, null, 2)};`);
})().catch(printError);

let chunks = 0;
async function writeChunk(chunk: Chunk, password: string) {
    const dataFileName = chunks.toString() + '.jpeg';
    const dataFilePath = join(OUTPUT_FOLDER, dataFileName);
    const imageFilePath = join(OUTPUT_FOLDER, `${chunks}.jpg`);

    const result = await joinImages(chunk.map(x => x.buffer));
    await result.toFile(imageFilePath);
    const buffer = readFileSync(imageFilePath);
    const base64String = buffer.toString('base64');
    writeFileSync(dataFilePath, xorBase64String(base64String, password));
    unlinkSync(imageFilePath)

    chunks++;

    for (let i = 0; i < chunk.length; i++){
        const item = chunk[i];
        if(!item) {
            throw new Error(`No way!`);
        }

        const {name} = item;
        mapping[name] = {
            image: dataFileName,
            index: i,
        };
    }
}

function xorBase64String(base64String: string, password: string, position = 212) {
    const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const charToIndex = {};
    for (let i = 0; i < base64Chars.length; i++) {
        charToIndex[base64Chars[i]!] = i;
    }

    // Work on string as array for easy mutation
    let chars = base64String.split('');

    // Determine how many characters to modify
    for (let i = 0; i < password.length && (position + i) < chars.length; i++) {
        const char = chars[position + i]!;

        // Skip padding '='
        if (char === '=') continue;

        const originalIndex = charToIndex[char];
        if (originalIndex === undefined) continue; // skip non-base64 chars

        const passwordByte = password.charCodeAt(i);

        // XOR within the 0–63 range
        const newIndex = originalIndex ^ (passwordByte & 63);
        chars[position + i] = base64Chars[newIndex]!;
    }

    return chars.join('');
}

async function askPassword(): Promise<string> {
    stdout.write('Enter password:');
    // Disable echo
    stdin.setRawMode(true);
    stdin.resume();
    let password = '';
    for await (const chunk of stdin) {
        const char = chunk.toString();

        if (char === '\u0003') { // Ctrl+C
            stdout.write('\n');
            stdin.setRawMode(false);
            process.exit(130); // 130 = terminated by Ctrl+C
        }

        if (char === '\n' || char === '\r' || char === '\u0004') break;
        password += char;
    }
    stdin.setRawMode(false);
    stdout.write('\n');
    return password;
}
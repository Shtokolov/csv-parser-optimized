// src/utils/testHelpers.ts
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { CsvParserOptions, ICsvParser } from '@/types';
import CsvParser from "@/index";

const PROJECT_ROOT = join(__dirname, '../..');
export const TEST_DATA_DIR = join(PROJECT_ROOT, 'test-data');
export const TEMP_CSV_PATH = join(TEST_DATA_DIR, 'temp.csv');

export function ensureTestDir(): void {
    if (!existsSync(TEST_DATA_DIR)) {
        mkdirSync(TEST_DATA_DIR, { recursive: true });
    }
}

export function createTestFile(content: string, filePath: string = TEMP_CSV_PATH): string {
    ensureTestDir();
    const normalizedContent = content.endsWith('\n') ? content : `${content}\n`;
    writeFileSync(filePath, normalizedContent);
    return filePath;
}



export const DEFAULT_PARSER_OPTIONS: CsvParserOptions = {
    hasHeaders: true,
    delimiter: 44,
    quote: 34,
    escape: 92,
    chunkSize: 1024 * 1024
};

export function createParser(options: Partial<CsvParserOptions> = {}): ICsvParser {
    return new CsvParser({
        ...DEFAULT_PARSER_OPTIONS,
        ...options
    });
}

export function generateTestData(rowCount: number): string {
    const headers = ['name', 'age', 'city', 'salary'];
    const rows = [headers.join(',')];

    for (let i = 0; i < rowCount; i++) {
        const row = [
            `Person${i}`,
            Math.floor(Math.random() * 50 + 20).toString(),
            `"City, ${i}"`,
            Math.floor(Math.random() * 100000).toString()
        ].join(',');
        rows.push(row);
    }

    return rows.join('\n') + '\n';
}



export function cleanupTestFile(filePath: string): void {
    try {
        if (existsSync(filePath)) {
            unlinkSync(filePath);

            // Verify cleanup
            if (existsSync(filePath)) {
                console.warn(`Warning: File still exists after cleanup: ${filePath}`);
            }
        }
    } catch (error) {
        console.warn(`Warning: Failed to cleanup file ${filePath}: ${error}`);
    }
}

export async function measurePerformance<T>(
    operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
    const startTime = process.hrtime();

    try {
        const result = await operation();
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds + nanoseconds / 1e9;
        return { result, duration };
    } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds + nanoseconds / 1e9;
        console.error(`Operation failed after ${duration.toFixed(2)} seconds:`, error);
        throw error;
    }}
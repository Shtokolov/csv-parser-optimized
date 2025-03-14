import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import {
    createParser,
    createTestFile,
    cleanupTestFile,
    generateTestData,
    TEST_DATA_DIR,
    ensureTestDir
} from '@/utils/testHelpers';

describe('CsvParser', () => {
    const testFilePath = join(TEST_DATA_DIR, 'parser-test.csv');

    beforeAll(() => {
        // Ensure test directory exists
        if (!existsSync(TEST_DATA_DIR)) {
            mkdirSync(TEST_DATA_DIR, { recursive: true });
        }
    });

    beforeEach(() => {
        // Ensure clean state before each test
        if (existsSync(testFilePath)) {
            cleanupTestFile(testFilePath);
        }
    });

    afterEach(() => {
        // Cleanup after each test
        if (existsSync(testFilePath)) {
            cleanupTestFile(testFilePath);
        }
    });

    describe('Batch Processing', () => {
        it('should process records in batches with headers', async () => {
            const csvContent = 'header1,header2,header3\nvalue1,value2,value3\nvalue4,value5,value6';
            writeFileSync(testFilePath, csvContent);

            const parser = createParser();
            const batchSize = 2;
            const batches: string[][][] = [];

            for await (const batch of parser.parseFileInBatches(testFilePath, batchSize)) {
                batches.push(batch);
            }

            expect(batches).toHaveLength(2);
            expect(batches[0]).toHaveLength(2);
            expect(batches[1]).toHaveLength(1);
            expect(batches[0][0]).toEqual(['header1', 'header2', 'header3']);
            expect(batches[0][1]).toEqual(['value1', 'value2', 'value3']);
            expect(batches[1][0]).toEqual(['value4', 'value5', 'value6']);
        });

        it('should handle empty files in batch processing', async () => {
            writeFileSync(testFilePath, '');
            const parser = createParser();
            const batches: string[][][] = [];

            for await (const batch of parser.parseFileInBatches(testFilePath, 2)) {
                batches.push(batch);
            }

            expect(batches).toHaveLength(0);
        });

        it('should handle files with only headers in batch processing', async () => {
            writeFileSync(testFilePath, 'header1,header2,header3');
            const parser = createParser();
            const batches: string[][][] = [];

            for await (const batch of parser.parseFileInBatches(testFilePath, 2)) {
                batches.push(batch);
            }

            expect(batches).toHaveLength(1);
            expect(batches[0]).toHaveLength(1);
            expect(batches[0][0]).toEqual(['header1', 'header2', 'header3']);
        });

        it('should process records in batches without headers', async () => {
            const csvContent = 'value1,value2,value3\nvalue4,value5,value6';
            writeFileSync(testFilePath, csvContent);

            const parser = createParser({ hasHeaders: false });
            const batchSize = 2;
            const batches: string[][][] = [];

            for await (const batch of parser.parseFileInBatches(testFilePath, batchSize)) {
                batches.push(batch);
            }

            expect(batches).toHaveLength(1);
            expect(batches[0]).toHaveLength(2);
            expect(batches[0][0]).toEqual(['value1', 'value2', 'value3']);
            expect(batches[0][1]).toEqual(['value4', 'value5', 'value6']);
        });

        it('should throw error for invalid batch size', async () => {
            writeFileSync(testFilePath, 'header1,header2,header3');
            const parser = createParser();
            await expect(async () => {
                for await (const _ of parser.parseFileInBatches(testFilePath, 0)) {
                    // Should not reach here
                }
            }).rejects.toThrow('Batch size must be greater than 0');
        });
    });

    describe('Custom Options', () => {
        it('should handle custom options', async () => {
            const csvContent = 'header1,header2,header3\nvalue1,value2,value3';
            writeFileSync(testFilePath, csvContent);

            const parser = createParser({
                delimiter: 44, // comma
                hasHeaders: true,
                chunkSize: 1024
            });

            const records = await parser.parseFile(testFilePath);
            expect(records).toHaveLength(2);
            expect(records[0]).toEqual(['header1', 'header2', 'header3']);
            expect(records[1]).toEqual(['value1', 'value2', 'value3']);
        });
    });
});
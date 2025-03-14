import { join } from 'path';
import { writeFileSync } from 'fs';
import { createParser, TEST_DATA_DIR } from '@/utils/testHelpers';

describe('CsvParser', () => {
    const testFilePath = join(TEST_DATA_DIR, 'test.csv');

    beforeEach(() => {
        const csvContent = 'header1,header2,header3\nvalue1,value2,value3\nvalue4,value5,value6';
        writeFileSync(testFilePath, csvContent);
    });

    it('should parse CSV file correctly', async () => {
        const parser = createParser();
        const records = await parser.parseFile(testFilePath);

        expect(records).toHaveLength(3);
        expect(records[0]).toEqual(['header1', 'header2', 'header3']);
        expect(records[1]).toEqual(['value1', 'value2', 'value3']);
        expect(records[2]).toEqual(['value4', 'value5', 'value6']);
    });

    it('should handle custom options', async () => {
        const csvContent = 'header1,header2,header3\nvalue1,value2,value3\nvalue4,value5,value6';
        writeFileSync(testFilePath, csvContent);

        const parser = createParser({
            delimiter: 44, // comma
            hasHeaders: true,
            chunkSize: 1024
        });

        const records = await parser.parseFile(testFilePath);
        expect(records).toHaveLength(3);
        expect(records[0]).toEqual(['header1', 'header2', 'header3']);
    });

    it('should process records in batches', async () => {
        const parser = createParser();
        const batches: string[][][] = [];

        for await (const batch of parser.parseFileInBatches(testFilePath, 2)) {
            batches.push(batch);
        }

        expect(batches).toHaveLength(2);
        expect(batches[0]).toHaveLength(2); // Header + first row
        expect(batches[1]).toHaveLength(1); // Second row
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

    it('should handle single record in batch processing', async () => {
        writeFileSync(testFilePath, 'single1,single2,single3');
        const parser = createParser({ hasHeaders: false });
        const batches: string[][][] = [];

        for await (const batch of parser.parseFileInBatches(testFilePath, 2)) {
            batches.push(batch);
        }

        expect(batches).toHaveLength(1);
        expect(batches[0]).toHaveLength(1);
        expect(batches[0][0]).toEqual(['single1', 'single2', 'single3']);
    });
});
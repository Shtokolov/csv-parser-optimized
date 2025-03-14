// src/__tests__/unit/basic.test.ts
import {
    createParser,
    createTestFile,
    cleanupTestFile,
    ensureTestDir,
    TEST_DATA_DIR
} from '@/utils/testHelpers';
import { join } from 'path';

describe('CsvParser Basic Functionality', () => {
    const testFilePath = join(TEST_DATA_DIR, 'basic-test.csv');

    beforeAll(() => {
        ensureTestDir();
    });

    afterEach(() => {
        cleanupTestFile(testFilePath);
    });

    describe('File Parsing', () => {
        it('should parse simple CSV with headers', async () => {
            const csv = 'name,age\nJohn,30\nJane,25';
            createTestFile(csv, testFilePath);

            const parser = createParser();
            const records = await parser.parseFile(testFilePath);

            expect(records).toHaveLength(3);
            expect(records[0]).toEqual(['name', 'age']);
            expect(records[1]).toEqual(['John', '30']);
            expect(records[2]).toEqual(['Jane', '25']);
        });

        it('should parse CSV without headers', async () => {
            const csv = 'John,30\nJane,25';
            createTestFile(csv, testFilePath);

            const parser = createParser({ hasHeaders: false });
            const records = await parser.parseFile(testFilePath);

            expect(records).toHaveLength(2);
            expect(records[0]).toEqual(['John', '30']);
            expect(records[1]).toEqual(['Jane', '25']);
        });

        it('should handle empty files', async () => {
            createTestFile('', testFilePath);

            const parser = createParser();
            const records = await parser.parseFile(testFilePath);

            expect(records).toHaveLength(0);
        });

        it('should handle files with only whitespace', async () => {
            createTestFile('   \n  \n\t  ', testFilePath);

            const parser = createParser();
            const records = await parser.parseFile(testFilePath);

            expect(records).toHaveLength(0);
        });

        it('should handle files with only a newline', async () => {
            createTestFile('\n', testFilePath);

            const parser = createParser();
            const records = await parser.parseFile(testFilePath);

            expect(records).toHaveLength(0);
        });
    });
});
import {
    createParser,
    createTestFile,
    cleanupTestFile,
    generateTestData,
    TEMP_CSV_PATH,
    ensureTestDir
} from '@/utils/testHelpers';

describe('CsvParser Batch Processing', () => {
    beforeAll(() => {
        ensureTestDir();
    });

    afterEach(() => {
        cleanupTestFile(TEMP_CSV_PATH);
    });

    it('should process records in correct batch sizes', async () => {
        const rowCount = 100;
        const batchSize = 10;
        const csv = generateTestData(rowCount);
        createTestFile(csv);  // Using default TEMP_CSV_PATH

        const parser = createParser();
        let batchCount = 0;
        let totalRecords = 0;

        for await (const batch of parser.parseFileInBatches(TEMP_CSV_PATH, batchSize)) {
            batchCount++;
            totalRecords += batch.length;
            expect(batch.length).toBeLessThanOrEqual(batchSize);
        }

        expect(totalRecords).toBe(rowCount + 1);  // +1 for header
        expect(batchCount).toBe(Math.ceil((rowCount + 1) / batchSize));
    });

    it('should handle batch size larger than record count', async () => {
        const rowCount = 5;
        const batchSize = 10;
        const csv = generateTestData(rowCount);
        createTestFile(csv);  // Using default TEMP_CSV_PATH

        const parser = createParser();
        let batchCount = 0;

        for await (const batch of parser.parseFileInBatches(TEMP_CSV_PATH, batchSize)) {
            batchCount++;
            expect(batch.length).toBe(rowCount + 1);  // +1 for header
        }

        expect(batchCount).toBe(1);
    });

    it('should handle empty files in batch processing', async () => {
        createTestFile('');  // Using default TEMP_CSV_PATH
        const parser = createParser();
        let batchCount = 0;

        for await (const batch of parser.parseFileInBatches(TEMP_CSV_PATH, 10)) {
            batchCount++;
        }

        expect(batchCount).toBe(0);
    });
});
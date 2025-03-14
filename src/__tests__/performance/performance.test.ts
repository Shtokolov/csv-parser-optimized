import {
    createParser,
    createTestFile,
    cleanupTestFile,
    generateTestData,
    measurePerformance,
    ensureTestDir,
    TEST_DATA_DIR
} from '@/utils/testHelpers';
import { join } from 'path';
import { existsSync } from 'fs';

describe('CsvParser Performance', () => {
    const LARGE_ROW_COUNT = 100000;
    const PERFORMANCE_FILE = join(TEST_DATA_DIR, 'performance.csv');

    function ensureTestFile(): void {
        if (!existsSync(PERFORMANCE_FILE)) {
            const csv = generateTestData(LARGE_ROW_COUNT);
            createTestFile(csv, PERFORMANCE_FILE);

            if (!existsSync(PERFORMANCE_FILE)) {
                throw new Error(`Failed to create test file at ${PERFORMANCE_FILE}`);
            }
        }
    }

    beforeAll(() => {
        ensureTestDir();
        ensureTestFile();
    });

    afterAll(() => {
        cleanupTestFile(PERFORMANCE_FILE);
    });

    beforeEach(() => {
        // Always verify file exists before each test
        ensureTestFile();
    });

    it('should parse large files within acceptable time', async () => {
        const parser = createParser();
        const { result, duration } = await measurePerformance(async () =>
            parser.parseFile(PERFORMANCE_FILE)
        );

        console.log(`Parsed ${result.length} records in ${duration.toFixed(2)} seconds`);
        expect(duration).toBeLessThan(10); // Should parse within 10 seconds
        expect(result.length).toBe(LARGE_ROW_COUNT + 1); // +1 for header
    });

    it('should process large files in batches efficiently', async () => {
        const parser = createParser();
        const batchSize = 1000;
        let totalRecords = 0;

        const { duration } = await measurePerformance(async () => {
            for await (const batch of parser.parseFileInBatches(PERFORMANCE_FILE, batchSize)) {
                totalRecords += batch.length;
            }
        });

        console.log(`Processed ${totalRecords} records in batches in ${duration.toFixed(2)} seconds`);
        expect(duration).toBeLessThan(10);
        expect(totalRecords).toBe(LARGE_ROW_COUNT + 1); // +1 for header
    });

    it('should handle different chunk sizes efficiently', async () => {
        ensureTestFile(); // Extra verification before chunk size tests
        const chunkSizes = [1024, 4096, 16384, 65536];
        const results = [];

        for (const chunkSize of chunkSizes) {
            const parser = createParser({ chunkSize });

            // Verify file exists before each chunk test
            ensureTestFile();

            const { duration } = await measurePerformance(async () => {
                const result = await parser.parseFile(PERFORMANCE_FILE);
                // Verify correct number of records
                expect(result.length).toBe(LARGE_ROW_COUNT + 1);
            });

            results.push({ chunkSize, duration });
            console.log(`Chunk size ${chunkSize}: ${duration.toFixed(2)} seconds`);
        }

        expect(results.length).toBe(chunkSizes.length);
        results.forEach(({ chunkSize, duration }) => {
            expect(duration).toBeLessThan(10);
            console.log(`Chunk size ${chunkSize} completed in ${duration.toFixed(2)} seconds`);
        });
    });
});
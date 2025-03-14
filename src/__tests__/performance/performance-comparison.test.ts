import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

import Table from 'cli-table3';
import CsvParser from "@/index";
import {runBatchBenchmark} from "@/utils/batch-benchmark";

// Extend Jest timeout
jest.setTimeout(300000); // 5 minutes

interface BenchmarkResult {
    fileSize: number;
    csvParseTime: number;
    rustParserTime: number;
    improvement: number;
    csvParseMemory: number;
    rustParserMemory: number;
    recordsPerSecond: number;
}

interface BatchResult {
    fileSize: number;
    batchSize: number;
    timeSeconds: number;
    recordsPerSecond: number;
    memoryUsage: number;
}

const PERFORMANCE_TEST_DIR = join(__dirname, '../../performance-test');
const WARMUP_RUNS = 2;
const BENCHMARK_RUNS = 3;

// Utility to format numbers
const formatNumber = (num: number): string => {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
};

const formatFileSize = (size: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
};

async function generateTestFile(size: number): Promise<string> {
    const filePath = join(PERFORMANCE_TEST_DIR, `test_${size}_records.csv`);


    // Check if file exists and has content
    if (existsSync(filePath)) {
        const stats = statSync(filePath);
        if (stats.size > 0) {
            console.log(`Using existing test file for ${formatNumber(size)} records (${formatFileSize(stats.size)})`);
            return filePath;
        }
    }

    console.log(`Generating test file with ${formatNumber(size)} records...`);


    const headers = ['id', 'name', 'email', 'age', 'city', 'country', 'salary', 'date'];
    const stream = require('fs').createWriteStream(filePath);

    // Write headers
    stream.write(headers.join(',') + '\n');

    // Write records in chunks to handle large files
    const chunkSize = 10000;
    for (let i = 0; i < size; i += chunkSize) {
        const chunk = [];
        for (let j = 0; j < Math.min(chunkSize, size - i); j++) {
            const id = i + j;
            chunk.push([
                id,
                `Name${id}`,
                `email${id}@test.com`,
                20 + (id % 50),
                `City${id % 100}`,
                `Country${id % 50}`,
                30000 + (id % 70000),
                new Date(2020, id % 12, 1 + (id % 28)).toISOString()
            ].join(','));
        }
        stream.write(chunk.join('\n') + '\n');
    }

    await new Promise(resolve => stream.end(resolve));
    return filePath;
}

async function measureCsvParse(filePath: string): Promise<{ time: number; memory: number }> {
    const initialMemory = process.memoryUsage().heapUsed;
    const startTime = process.hrtime();

    return new Promise((resolve, reject) => {
        const records: any[] = [];
        createReadStream(filePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }))
            .on('data', (record) => records.push(record))
            .on('end', () => {
                const [seconds, nanoseconds] = process.hrtime(startTime);
                const duration = seconds + nanoseconds / 1e9;
                const memoryUsed = (process.memoryUsage().heapUsed - initialMemory) / (1024 * 1024);
                resolve({ time: duration, memory: memoryUsed });
            })
            .on('error', reject);
    });
}

async function measureRustParser(filePath: string): Promise<{ time: number; memory: number }> {
    const initialMemory = process.memoryUsage().heapUsed;
    const parser = new CsvParser();

    const startTime = process.hrtime();
    await parser.parseFile(filePath);
    const [seconds, nanoseconds] = process.hrtime(startTime);

    const duration = seconds + nanoseconds / 1e9;
    const memoryUsed = (process.memoryUsage().heapUsed - initialMemory) / (1024 * 1024);

    return { time: duration, memory: memoryUsed };
}

async function runBenchmark(filePath: string, recordCount: number): Promise<BenchmarkResult> {
    // Warm-up runs
    for (let i = 0; i < WARMUP_RUNS; i++) {
        await measureCsvParse(filePath);
        await measureRustParser(filePath);
        if (global.gc) global.gc();
    }

    // Actual benchmark runs
    let csvParseTotal = 0;
    let rustParserTotal = 0;
    let csvParseMemoryTotal = 0;
    let rustParserMemoryTotal = 0;

    for (let i = 0; i < BENCHMARK_RUNS; i++) {
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));

        const csvResult = await measureCsvParse(filePath);
        csvParseTotal += csvResult.time;
        csvParseMemoryTotal += csvResult.memory;

        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));

        const rustResult = await measureRustParser(filePath);
        rustParserTotal += rustResult.time;
        rustParserMemoryTotal += rustResult.memory;
    }

    const csvParseTime = csvParseTotal / BENCHMARK_RUNS;
    const rustParserTime = rustParserTotal / BENCHMARK_RUNS;
    const csvParseMemory = csvParseMemoryTotal / BENCHMARK_RUNS;
    const rustParserMemory = rustParserMemoryTotal / BENCHMARK_RUNS;

    return {
        fileSize: recordCount,
        csvParseTime,
        rustParserTime,
        improvement: ((csvParseTime - rustParserTime) / csvParseTime) * 100,
        csvParseMemory,
        rustParserMemory,
        recordsPerSecond: recordCount / rustParserTime
    };
}
//
// describe('CSV Parser Performance Benchmark', () => {
//     const testSizes = [1000, 10000, 100000, 1000000];
//     const batchSizes = [100, 1000, 10000];
//     let results: BenchmarkResult[] = [];
//     let batchResults: BatchResult[] = [];
//
//     // Run tests sequentially
//     beforeAll(async () => {
//         console.log('\nPreparing benchmark...');
//         console.log('=====================\n');
//
//         for (const size of testSizes) {
//             const filePath = await generateTestFile(size);
//             const result = await runBenchmark(filePath, size);
//             results.push(result);
//
//             // Clean up after each test
//             if (global.gc) global.gc();
//             await new Promise(resolve => setTimeout(resolve, 1000));
//         }
//     });
//
//     it('should show performance comparison results', () => {
//         const table = new Table({
//             head: ['File Size', 'csv-parse', 'Rust Parser', 'Improvement', 'Records/sec'],
//             style: { head: ['cyan'] }
//         });
//
//         results.forEach(result => {
//             table.push([
//                 formatNumber(result.fileSize),
//                 `${result.csvParseTime.toFixed(3)}s`,
//                 `${result.rustParserTime.toFixed(3)}s`,
//                 `${result.improvement.toFixed(1)}%`,
//                 formatNumber(result.recordsPerSecond)
//             ]);
//         });
//
//         console.log('\nPerformance Comparison:');
//         console.log(table.toString());
//
//         // Assertions
//         results.forEach(result => {
//             expect(result.rustParserTime).toBeLessThan(result.csvParseTime);
//             expect(result.improvement).toBeGreaterThan(0);
//         });
//     });
//
//     it('should show memory usage comparison', () => {
//         const table = new Table({
//             head: ['File Size', 'csv-parse (MB)', 'Rust Parser (MB)', 'Difference'],
//             style: { head: ['cyan'] }
//         });
//
//         results.forEach(result => {
//             const memoryDiff = ((result.csvParseMemory - result.rustParserMemory) / result.csvParseMemory * 100).toFixed(1);
//             table.push([
//                 formatNumber(result.fileSize),
//                 result.csvParseMemory.toFixed(2),
//                 result.rustParserMemory.toFixed(2),
//                 `${memoryDiff}%`
//             ]);
//         });
//
//         console.log('\nMemory Usage Comparison:');
//         console.log(table.toString());
//
//         // Assertions
//         results.forEach(result => {
//             expect(result.rustParserMemory).toBeLessThan(result.csvParseMemory);
//         });
//     });
//
//
// });


describe('CSV Parser Performance Benchmark', () => {
    const testSizes = [1000, 10000, 100000, 1000000];
    const batchSizes = [100, 1000, 10000];
    let results: BenchmarkResult[] = [];
    let testFiles: { [size: number]: string } = {};

    // Run tests sequentially
    beforeAll(async () => {
        console.log('\nPreparing benchmark...');
        console.log('=====================\n');

        // Generate or verify all test files first
        for (const size of testSizes) {
            testFiles[size] = await generateTestFile(size);
        }

        // Run benchmarks
        for (const size of testSizes) {
            const result = await runBenchmark(testFiles[size], size);
            results.push(result);

            // Clean up after each test
            if (global.gc) global.gc();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    });

    it('should show performance comparison results', () => {
        const table = new Table({
            head: ['File Size', 'csv-parse', 'Rust Parser', 'Improvement', 'Records/sec'],
            style: { head: ['cyan'] }
        });

        results.forEach(result => {
            table.push([
                formatNumber(result.fileSize),
                `${result.csvParseTime.toFixed(3)}s`,
                `${result.rustParserTime.toFixed(3)}s`,
                `${result.improvement.toFixed(1)}%`,
                formatNumber(result.recordsPerSecond)
            ]);
        });

        console.log('\nPerformance Comparison:');
        console.log(table.toString());

        // Assertions
        results.forEach(result => {
            expect(result.rustParserTime).toBeLessThan(result.csvParseTime);
            expect(result.improvement).toBeGreaterThan(0);
        });
    });

    it('should show memory usage comparison', () => {
        const table = new Table({
            head: ['File Size', 'csv-parse (MB)', 'Rust Parser (MB)', 'Difference'],
            style: { head: ['cyan'] }
        });

        results.forEach(result => {
            const memoryDiff = ((result.csvParseMemory - result.rustParserMemory) / result.csvParseMemory * 100).toFixed(1);
            table.push([
                formatNumber(result.fileSize),
                result.csvParseMemory.toFixed(2),
                result.rustParserMemory.toFixed(2),
                `${memoryDiff}%`
            ]);
        });

        console.log('\nMemory Usage Comparison:');
        console.log(table.toString());

        // Assertions
        results.forEach(result => {
            expect(result.rustParserMemory).toBeLessThan(result.csvParseMemory);
        });
    });

    it('should compare batch processing performance', async () => {
        console.log('\nBatch Processing Performance:');
        console.log('===========================\n');

        const testSize = 1000000; // Use 1M records for batch testing
        const filePath = testFiles[testSize];

        const batchTable = new Table({
            head: ['Batch Size', 'csv-parse', 'Rust Parser', 'Improvement', 'Records/sec'],
            style: { head: ['cyan'] }
        });

        for (const batchSize of batchSizes) {
            const result = await runBatchBenchmark(filePath, batchSize, testSize);

            batchTable.push([
                formatNumber(batchSize),
                `${result.csvParseTime.toFixed(3)}s`,
                `${result.rustTime.toFixed(3)}s`,
                `${result.improvement.toFixed(1)}%`,
                formatNumber(result.recordsPerSecond)
            ]);

            // Assertions
            expect(result.rustTime).toBeLessThan(result.csvParseTime);
            expect(result.improvement).toBeGreaterThan(0);
        }

        console.log(batchTable.toString());
    });

    it('should compare batch processing memory usage', async () => {
        const testSize = 1000000;
        const filePath = testFiles[testSize];

        const memoryTable = new Table({
            head: ['Batch Size', 'csv-parse (MB)', 'Rust Parser (MB)', 'Difference'],
            style: { head: ['cyan'] }
        });

        for (const batchSize of batchSizes) {
            const result = await runBatchBenchmark(filePath, batchSize, testSize);
            const memoryDiff = ((result.csvParseMemory - result.rustMemory) / result.csvParseMemory * 100).toFixed(1);

            memoryTable.push([
                formatNumber(batchSize),
                result.csvParseMemory.toFixed(2),
                result.rustMemory.toFixed(2),
                `${memoryDiff}%`
            ]);

            // Assertions
            expect(result.rustMemory).toBeLessThan(result.csvParseMemory);
        }

        console.log('\nBatch Processing Memory Usage:');
        console.log('=============================\n');
        console.log(memoryTable.toString());
    });
});


import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import CsvParser from "@/index";

interface BatchBenchmarkResult {
    batchSize: number;
    rustTime: number;
    csvParseTime: number;
    rustMemory: number;
    csvParseMemory: number;
    improvement: number;
    recordsPerSecond: number;
}

async function measureCsvParseBatch(
    filePath: string,
    batchSize: number
): Promise<{ time: number; memory: number; recordCount: number }> {
    const initialMemory = process.memoryUsage().heapUsed;
    const startTime = process.hrtime();
    let recordCount = 0;
    let currentBatch: any[] = [];

    return new Promise((resolve, reject) => {
        createReadStream(filePath)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }))
            .on('data', (record) => {
                currentBatch.push(record);
                if (currentBatch.length >= batchSize) {
                    // Process the batch
                    recordCount += currentBatch.length;
                    currentBatch = [];
                }
            })
            .on('end', () => {
                // Process any remaining records
                if (currentBatch.length > 0) {
                    recordCount += currentBatch.length;
                }
                const [seconds, nanoseconds] = process.hrtime(startTime);
                const duration = seconds + nanoseconds / 1e9;
                const memoryUsed = (process.memoryUsage().heapUsed - initialMemory) / (1024 * 1024);
                resolve({
                    time: duration,
                    memory: memoryUsed,
                    recordCount
                });
            })
            .on('error', reject);
    });
}

async function measureRustBatch(
    filePath: string,
    batchSize: number
): Promise<{ time: number; memory: number; recordCount: number }> {
    const initialMemory = process.memoryUsage().heapUsed;
    const parser = new CsvParser({ hasHeaders: true });
    let recordCount = 0;

    const startTime = process.hrtime();

    try {
        for await (const batch of parser.parseFileInBatches(filePath, batchSize)) {
            recordCount += batch.length;
        }
    } catch (error) {
        console.error('Error in Rust batch processing:', error);
        throw error;
    }

    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    const memoryUsed = (process.memoryUsage().heapUsed - initialMemory) / (1024 * 1024);

    return {
        time: duration,
        memory: memoryUsed,
        recordCount
    };
}

async function runBatchBenchmark(
    filePath: string,
    batchSize: number,
    totalRecords: number,
    warmupRuns: number = 2,
    benchmarkRuns: number = 3
): Promise<BatchBenchmarkResult> {
    console.log(`\nRunning batch benchmark with batch size: ${batchSize}`);
    console.log('Performing warmup runs...');

    // Warm-up runs
    for (let i = 0; i < warmupRuns; i++) {
        await measureCsvParseBatch(filePath, batchSize);
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));

        await measureRustBatch(filePath, batchSize);
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('Starting benchmark runs...');

    // Actual benchmark runs
    let csvParseTotal = 0;
    let rustTotal = 0;
    let csvParseMemoryTotal = 0;
    let rustMemoryTotal = 0;
    let csvRecordCount = 0;
    let rustRecordCount = 0;

    for (let i = 0; i < benchmarkRuns; i++) {
        console.log(`Run ${i + 1}/${benchmarkRuns}`);

        // CSV Parse measurement
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        const csvResult = await measureCsvParseBatch(filePath, batchSize);
        csvParseTotal += csvResult.time;
        csvParseMemoryTotal += csvResult.memory;
        csvRecordCount = csvResult.recordCount;

        // Rust implementation measurement
        if (global.gc) global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        const rustResult = await measureRustBatch(filePath, batchSize);
        rustTotal += rustResult.time;
        rustMemoryTotal += rustResult.memory;
        rustRecordCount = rustResult.recordCount;
    }

    // Calculate averages
    const csvParseTime = csvParseTotal / benchmarkRuns;
    const rustTime = rustTotal / benchmarkRuns;
    const csvParseMemory = csvParseMemoryTotal / benchmarkRuns;
    const rustMemory = rustMemoryTotal / benchmarkRuns;

    // Verify record counts match
    if (csvRecordCount !== rustRecordCount) {
        console.warn(`Warning: Record count mismatch! CSV-Parse: ${csvRecordCount}, Rust: ${rustRecordCount}`);
    }

    // Calculate metrics
    const improvement = ((csvParseTime - rustTime) / csvParseTime) * 100;
    const recordsPerSecond = totalRecords / rustTime;

    return {
        batchSize,
        rustTime,
        csvParseTime,
        rustMemory,
        csvParseMemory,
        improvement,
        recordsPerSecond
    };
}

export {
    runBatchBenchmark,
    BatchBenchmarkResult
};
import { CsvParser } from '@/index.js';
import { writeFileSync } from 'fs';

// Initialize parser with options
const parser = new CsvParser({
    hasHeaders: true,
    delimiter: 44,  // comma
    quote: 34,     // double quote
    escape: 92,    // backslash
    chunkSize: 1024
});

async function main() {
    try {
        // Basic usage - parse entire file
        const records = await parser.parseFile('test.csv');
        console.log('=== Full file parse results ===');
        console.log('Total records:', records.length);
        console.table(records);

        // Advanced usage - process in batches
        console.log('\n=== Batch processing results ===');
        const batchSize = 2;
        for await (const batch of parser.parseFileInBatches('test.csv', batchSize)) {
            console.log(`Processing batch of ${batch.length} records:`);
            console.table(batch);
        }
    } catch (error) {
        console.error('Parse error:', error);
    }
}

main().catch(console.error);
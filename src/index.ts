import {CsvParserOptions, ICsvParser, NativeParser} from './types';
import {loadNativeModule} from "@/utils/nativeLoader";

export class CsvParser implements ICsvParser {
    private parser: NativeParser;
    private hasHeaders: boolean;

    constructor(options?: CsvParserOptions) {
        try {
            const nativeBinding = loadNativeModule();
            this.hasHeaders = options?.hasHeaders ?? true;

            this.parser = new nativeBinding.CsvParser({
                delimiter: options?.delimiter ?? 44,
                quote: options?.quote ?? 34,
                escape: options?.escape ?? 92,
                has_headers: this.hasHeaders ? 1 : 0,
                chunk_size: options?.chunkSize ?? 64 * 1024, // 64KB
                buffer_capacity: options?.bufferCapacity ?? 8192
            });
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to load native binding: ${error.message}\nMake sure to run 'npm run build' first.`);
            }
            throw error;
        }
    }

    async parseFile(filePath: string): Promise<string[][]> {
        try {
            return await this.parser.parseFile(filePath);
        } catch (error) {
            throw new Error(`Failed to parse CSV file: ${error}`);
        }
    }

    async *parseFileInBatches(filePath: string, batchSize: number): AsyncGenerator<string[][], void, unknown> {
        if (batchSize <= 0) {
            throw new Error('Batch size must be greater than 0');
        }

        const records = await this.parseFile(filePath);
        if (records.length === 0) {
            return;
        }

        if (this.hasHeaders) {
            // First batch includes header row plus records up to batchSize - 1
            const headerRow = records[0];
            const firstBatchSize = Math.min(batchSize - 1, records.length - 1);

            if (firstBatchSize > 0) {
                yield [headerRow, ...records.slice(1, firstBatchSize + 1)];
            } else {
                yield [headerRow];
            }

            // Process remaining records in full-sized batches
            let i = firstBatchSize + 1;
            while (i < records.length) {
                yield records.slice(i, Math.min(i + batchSize, records.length));
                i += batchSize;
            }
        } else {
            // No headers - process in regular batches
            for (let i = 0; i < records.length; i += batchSize) {
                yield records.slice(i, Math.min(i + batchSize, records.length));
            }
        }
    }



}

export type { CsvParserOptions, ICsvParser };
export default CsvParser;
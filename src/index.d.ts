export interface CsvParserOptions {
    delimiter?: number;
    quote?: number;
    escape?: number;
    hasHeaders?: boolean;
    chunkSize?: number;
}

export class CsvParser {
    constructor(options?: CsvParserOptions);
    parseFile(filePath: string): Promise<string[][]>;
    parseFileInBatches(filePath: string, batchSize: number): AsyncGenerator<string[][], void, unknown>;
}

export default CsvParser;
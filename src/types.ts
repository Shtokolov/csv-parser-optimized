export interface CsvParserOptions {
    delimiter?: number;
    quote?: number;
    escape?: number;
    hasHeaders?: boolean;
    chunkSize?: number;
    bufferCapacity?: number;
}

export interface NativeParser {
    parseFile(path: string): Promise<string[][]>;
}

export interface ICsvParser {
    parseFile(filePath: string): Promise<string[][]>;
    parseFileInBatches(filePath: string, batchSize: number): AsyncGenerator<string[][], void, unknown>;
}
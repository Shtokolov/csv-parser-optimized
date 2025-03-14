import { ensureTestDir, cleanupTestFile, TEST_DATA_DIR } from '@/utils/testHelpers';
import { join } from 'path';
import {existsSync, mkdirSync, readdirSync} from 'fs';

beforeAll(() => {
    ensureTestDir();
});

afterAll(() => {
    // Clean up all test files
    const files = readdirSync(TEST_DATA_DIR);
    files.forEach(file => {
        cleanupTestFile(join(TEST_DATA_DIR, file));
    });
});

beforeEach(() => {
    console.log('\n');
});

jest.setTimeout(30000);

describe('Test Setup', () => {
    it('should ensure test directory exists', () => {
        if (!existsSync(TEST_DATA_DIR)) {
            mkdirSync(TEST_DATA_DIR, { recursive: true });
        }
        expect(existsSync(TEST_DATA_DIR)).toBe(true);
    });
});
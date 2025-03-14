const { resolve } = require('path');

/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': resolve(__dirname, './src/$1')
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/utils/setup.ts'],
    moduleDirectories: ['node_modules', 'src'],
    moduleFileExtensions: ['ts', 'js', 'json', 'node'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    verbose: true
};
const { pathsToModuleNameMapper } = require('ts-jest/utils');
const { compilerOptions } = require('./tsconfig');

module.exports = {
    preset: 'jest-preset-angular',
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
    testMatch: ['**/?(*.)test.ts'],
    collectCoverageFrom: [
        'src/**/*.{ts,html}',
        '!src/tests/**/*',
    ],
    transform: {
        '^.+\\.(ts|html)$': 'ts-jest',
    },
    transformIgnorePatterns: ['node_modules/(?!@ionic-native|@ionic)'],
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/src/' }),
    globals: {
        'ts-jest': {
            tsConfig: './tsconfig.test.json',
        },
    },
};

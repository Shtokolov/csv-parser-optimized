import { join } from 'path';
import { platform, arch } from 'os';
import { existsSync, copyFileSync, mkdirSync } from 'fs';

export function getNativeModuleName(): string {
    const platformMap = {
        darwin: arch() === 'arm64' ? 'darwin-arm64' : 'darwin-x64',
        win32: `win32-${arch()}-msvc`,
        linux: `linux-${arch()}-gnu`
    };

    // @ts-ignore
    const extension = platformMap[platform()];
    if (!extension) {
        throw new Error(`Unsupported platform: ${platform()}`);
    }

    return `csv-parser-optimized.${extension}.node`;
}

export function getModulePath(): string {
    const moduleName = getNativeModuleName();
    const isTest = process.env.NODE_ENV === 'test';
    const projectRoot = join(__dirname, '../../');

    if (isTest) {
        const nativeDir = join(projectRoot, 'native');
        if (!existsSync(nativeDir)) {
            mkdirSync(nativeDir, { recursive: true });
        }

        // Check if module exists in project root and copy to native dir
        const rootModule = join(projectRoot, moduleName);
        const nativeModule = join(nativeDir, moduleName);

        if (existsSync(rootModule)) {
            copyFileSync(rootModule, nativeModule);
            return nativeModule;
        }

        return nativeModule;
    }

    return join(projectRoot, moduleName);
}

export function loadNativeModule() {
    const modulePath = getModulePath();
    if (!existsSync(modulePath)) {
        throw new Error(`Native module not found at ${modulePath}`);
    }
    return require(modulePath);
}
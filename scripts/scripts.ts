import type { BuildOptions } from 'esbuild';
import { networkInterfaces } from 'os';
import browserSync from "browser-sync";
import historyApiFallback = require('connect-history-api-fallback');
// import { build as esbuild } from 'esbuild';
import { remove, mkdir, copy, readFile, writeFile, existsSync, ensureDirSync } from 'fs-extra';
import path, { join, resolve } from 'path';
import { debounceTimeOut, wait } from '@giveback007/util-lib';
import { BuilderUtil, transpileBrowser } from './build.util';
import chalk from 'chalk';

const { log } = console;

function network() {
    let ip: string | undefined;
    const ifaces = networkInterfaces();
    const wifiKey = Object.keys(ifaces).find((k) => k.search('Wi-Fi') > -1);
    if (wifiKey) {
        const x = ifaces[wifiKey] || [];
        const y = x.find((x) => x.family === 'IPv4');
        ip = y?.address;
    }

    return ip;
}

export const browserFiles = () => ({
    'package.json': /* json */
`{
    "name": "playground",
    "version": "0.0.1",
    "description": "",
    "main": "index.js",
    "author": "",
    "dependencies": {}
}`,

    'index.html': /* html */
`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <link rel="icon" type="image/png" sizes="256x256" href="fav.ico">
        <link rel="stylesheet" href="./index.css">
        <title>Browser Playground</title>
    </head>
    <body>
        <div id='root'></div>
        <script src='index.js'></script>
    </body>
</html>`,

    'index.tsx': /* tsx */
`import './index.scss';
const { log } = console;`,

    'index.scss': /* scss */ '',
})


export async function browserPlayground(options: {
    fromDir?: string;
    entryFile?: string;
    toDir?: string;
    watchOtherDirs?: string[];
    cssExts?: string[];
    jsExts?: string[];
    projectRoot?: string;
    copyFiles?: string[];
} = {}) {
    log('STARTING...');

    const {
        fromDir = 'playground/browser',
        entryFile = 'index.tsx',
        toDir = '.temp/browser',
        watchOtherDirs = ['src'],
        jsExts = ['tsx', 'ts', 'js', 'jsx'],
        cssExts = ['sass', 'scss', 'css'],
        projectRoot = '../',
        copyFiles = ['fav.ico']
    } = options;

    // Prepare the playground folders with files //
    [fromDir, toDir].forEach(async dir => {
        ensureDirSync(dir);
        await copy(join('assets/fav.ico'), join(dir, 'fav.ico'));
    });

    Object.entries(browserFiles()).forEach(([fileName, txt]) => {
        if (!existsSync(join(fromDir, fileName)))
            writeFile(join(fromDir, fileName), txt);
    });

    // clearing and canceling on exit //
    [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]
    .forEach((eventType) => process.on(eventType, () => {
        bs.pause();
        bs.cleanup();
        bs.exit();
        process.exit();
    }));

    // initialized builder //
    const builder = new BuilderUtil({
        fromDir,
        toDir,
        projectRoot,
        copyFiles: copyFiles,
        buildFct: () => transpileBrowser(entryFile, toDir, { changeBuildOpts: { incremental: true } })
    });

    // Create browserSync
    const bs = browserSync.create('Browser-Playground').init({
        server: toDir,
        middleware: [ historyApiFallback() ],
        reloadDelay: 0,
        reloadDebounce: 150,
        reloadOnRestart: true,
        port: 4000,
        ghostMode: false,
        host: network(),
    });

    // Setup the watchers
    const allWatchDirs = [fromDir, ...watchOtherDirs.map(dir => resolve(dir))];
    const jsWatch: string[] = [];
    const cssWatch: string[] = [];

    allWatchDirs.forEach((dir) => {
        jsExts.forEach(ext =>
            jsWatch.push(path.join(dir, '**', '*.' + ext)));

        cssExts.forEach(ext =>
            cssWatch.push(path.join(dir, '**', '*.' + ext)));
    });

    let cssChanged = false;
    let jsChanged = false;
    const debounce = debounceTimeOut();
    
    const watchHandler = (type: 'css' | 'js') => {
        type === 'js' ? (jsChanged = true) : (cssChanged = true);
        debounce(async () => {
            await builder.build();

            if (jsChanged) {
                cssChanged = jsChanged = false;
                bs.reload("*.html");
            } else if (cssChanged) {
                cssChanged = false;
                bs.reload("*.css");
            } else {
                log(chalk`Failed to Reload...`);
            }
        }, 250);
    };

    bs.watch(
        jsWatch as never as string,
        { ignoreInitial: true },
        async () => watchHandler('js')
    );
    
    bs.watch(
        cssWatch as never as string,
        { ignoreInitial: true },
        async () => watchHandler('css')
    );

    // Start
    await builder.copyUtil?.watchCopyFiles(() => bs.reload("*.html"));

    await wait(0);
    await builder.build();
    bs.reload("index.html");
}


function nodejsPlayGround() {

}

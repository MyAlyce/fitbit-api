import { remove, mkdir, copy, readFile, writeFile, existsSync, ensureDirSync } from 'fs-extra';
import { join, resolve } from 'path';
import { browserFiles, browserPlayground } from './scripts/scripts';

const { log } = console;

(async function run([type]: string[]) {
    
    if (type === 'playground:browser') {
        browserPlayground();
        // const fromDir = 'playground/browser', toDir = '.temp/browser';

        // ensureDirSync('playground/browser');
        // await copy(join('assets/fav.ico'), join(toDir, 'fav.ico'));
        // Object.entries(browserFiles()).forEach(([fileName, txt]) => {
        //     if (!existsSync(join(fromDir, fileName)))
        //         writeFile(join(fromDir, fileName), txt);
        // });


        // copy the icon file
    }

})(process.argv.slice(2));

// setup a type of playground that runs from a 'higher' root & replace node modules version when in playground mode
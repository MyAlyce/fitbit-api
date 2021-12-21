import { browserPlayground } from './scripts/scripts';

// const { log } = console;

(async function run([type]: string[]) {
    
    if (type === 'playground:browser') {
        browserPlayground();
    }

})(process.argv.slice(2));

// setup a type of playground that runs from a 'higher' root & replace node modules version when in playground mode
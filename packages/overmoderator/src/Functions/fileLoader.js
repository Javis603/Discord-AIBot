const path = require('path');
const { glob } = require('glob');

async function deleteCachedFile(file) {
    const filePath = path.resolve(file);
    if (require.cache[filePath]) {
        delete require.cache[filePath];
    }
}

async function loadFiles(dirName) {
    const files = await glob(path.join(process.cwd(), dirName, '**/*.js').replace(/\\/g, '/'));
    const jsFiles = files.filter(file => path.extname(file) === '.js');
    await Promise.all(jsFiles.map(deleteCachedFile));
    return jsFiles;
}

module.exports = { loadFiles };

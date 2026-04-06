/**
 * @file fileLoader.js
 * @description Load files
 * @author Javis
 * @license MIT
 * @copyright Copyright (c) 2025
 */
const { glob } = require("glob");
const path = require("path");

async function deleteCachedFile(file) {
    const filePath = path.resolve(file);
    if (require.cache[filePath]) {
        delete require.cache[filePath];
    }
}

async function loadFiles(dirName){
    try {
        const files = await glob(path.join(process.cwd(), dirName, "**/*.js").replace(/\\/g, "/"));
        const jsFiles = files.filter(file => path.extname(file) === '.js');
        await Promise.all(jsFiles.map(deleteCachedFile));
        return jsFiles;
    } catch (error) {
        console.error(`Error loading files from directory ${dirName}: ${error}`);
        throw error;
    }
}

module.exports = { loadFiles }
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const fileName = path.basename(__filename);

const resxDir = __dirname + '/lang';
let resxData = {};

fs.readdirSync(resxDir).forEach(file => {
    const filePath = path.join(resxDir, file);
    const xmlData = fs.readFileSync(filePath, 'utf-8');

    xml2js.parseString(xmlData, (err, result) => {
        if (err) {
            console.error(`Failed to parse ${file}:`, err);
            return;
        }
        const lang = file.split(".")[0];
        resxData[lang] = result;
        console.log(`Loading LangFile : ${file}`);
    });
});
console.log(`Loading complete : ${fileName}`);
module.exports = resxData;
import * as pdf from 'pdf-parse';
console.log('pdf-parse exports:', Object.keys(pdf));
console.log('pdf-parse default:', typeof (pdf as any).default);
try {
    const pdfImport = require('pdf-parse');
    console.log('pdf-parse require keys:', Object.keys(pdfImport));
} catch (e) {
    console.log('pdf-parse require failed');
}

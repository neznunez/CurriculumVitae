// Script simples para alternar entre versões do index.html
const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
    console.log('Uso: node switch.js [terminal|formal]');
    console.log('Exemplo: node switch.js formal');
    process.exit(1);
}

const validVersions = ['terminal', 'formal'];

if (!validVersions.includes(version)) {
    console.error(`Versão inválida: ${version}`);
    console.log(`Versões disponíveis: ${validVersions.join(', ')}`);
    process.exit(1);
}

const sourceFile = `index-${version}.html`;
const targetFile = 'index.html';

// Verificar se o arquivo fonte existe
if (!fs.existsSync(sourceFile)) {
    console.error(`Arquivo não encontrado: ${sourceFile}`);
    process.exit(1);
}

// Fazer backup do index.html atual se existir
if (fs.existsSync(targetFile)) {
    const backupFile = `index-backup-${Date.now()}.html`;
    fs.copyFileSync(targetFile, backupFile);
    console.log(`Backup criado: ${backupFile}`);
}

// Copiar a versão escolhida para index.html
try {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✓ ${sourceFile} copiado para ${targetFile}`);
    console.log(`✓ Versão "${version}" está agora ativa e pronta para commit!`);
} catch (error) {
    console.error('Erro ao copiar arquivo:', error.message);
    process.exit(1);
}

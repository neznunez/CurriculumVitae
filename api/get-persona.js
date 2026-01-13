// api/get-persona.js - Função serverless para obter a persona
const fs = require('fs').promises;
const path = require('path');

const personaFilePath = path.join(process.cwd(), 'chat-backend', 'persona_data.json');
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

async function readPersonaData() {
    try {
        const dir = path.dirname(personaFilePath);
        try {
            await fs.access(dir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dir, { recursive: true });
            } else {
                throw error;
            }
        }
        const data = await fs.readFile(personaFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                nomeCompleto: "Assistente Padrão",
                descricaoCurta: "Um assistente virtual prestativo.",
                tomDeVoz: "Neutro",
                interesses: [],
                detalhesAdicionais: {}
            };
        }
        throw error;
    }
}

// Função para sanitizar dados da persona antes de enviar
function sanitizePersonaData(data) {
    if (!data || typeof data !== 'object') {
        return {};
    }
    
    const sanitized = {};
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            
            // Sanitiza chaves
            const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
            if (!sanitizedKey) continue;
            
            // Sanitiza valores baseado no tipo
            if (typeof value === 'string') {
                // Remove caracteres de controle e limita tamanho
                sanitized[sanitizedKey] = value
                    .replace(/[\x00-\x1F\x7F]/g, '')
                    .substring(0, 1000);
            } else if (Array.isArray(value)) {
                // Limita arrays e sanitiza itens
                sanitized[sanitizedKey] = value
                    .filter(item => typeof item === 'string')
                    .map(item => item.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 200))
                    .slice(0, 50);
            } else if (typeof value === 'object' && value !== null) {
                // Sanitiza objetos aninhados
                const sanitizedObj = {};
                let count = 0;
                for (const subKey in value) {
                    if (count >= 50) break;
                    if (value.hasOwnProperty(subKey) && typeof value[subKey] === 'string') {
                        const sanitizedSubKey = subKey.replace(/[^a-zA-Z0-9_]/g, '');
                        if (sanitizedSubKey) {
                            sanitizedObj[sanitizedSubKey] = value[subKey]
                                .replace(/[\x00-\x1F\x7F]/g, '')
                                .substring(0, 500);
                            count++;
                        }
                    }
                }
                if (Object.keys(sanitizedObj).length > 0) {
                    sanitized[sanitizedKey] = sanitizedObj;
                }
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[sanitizedKey] = value;
            }
        }
    }
    return sanitized;
}

module.exports = async (req, res) => {
    // CORS headers com origem restritiva
    const origin = req.headers.origin;
    const allowedOrigin = ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
        ? origin || '*'
        : ALLOWED_ORIGINS[0];
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const personaData = await readPersonaData();
        
        // Sanitiza dados antes de enviar
        const sanitizedData = sanitizePersonaData(personaData);
        
        res.json(sanitizedData);
    } catch (error) {
        console.error('Erro ao obter persona:', error);
        const isProduction = process.env.NODE_ENV === 'production';
        res.status(500).json({ 
            error: isProduction 
                ? 'Erro ao carregar dados da persona.' 
                : `Erro: ${error.message}` 
        });
    }
};

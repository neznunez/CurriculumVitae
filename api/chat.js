// api/chat.js - Função serverless para o endpoint de chat
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

// Caminho para o arquivo de dados da persona
const personaFilePath = path.join(process.cwd(), 'chat-backend', 'persona_data.json');

// Constantes de segurança
const MAX_MESSAGE_LENGTH = 2000; // Limite de caracteres por mensagem
const MAX_SYSTEM_MESSAGE_LENGTH = 5000; // Limite para mensagem do sistema
const REQUEST_TIMEOUT = 30000; // 30 segundos
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

// Função para sanitizar entrada de texto
function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    // Remove caracteres de controle e limita tamanho
    return text
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove caracteres de controle
        .trim()
        .substring(0, MAX_MESSAGE_LENGTH);
}

// Função para validar mensagem
function validateMessage(message) {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: 'Mensagem inválida ou vazia.' };
    }
    
    const sanitized = sanitizeInput(message);
    if (sanitized.length === 0) {
        return { valid: false, error: 'Mensagem não pode estar vazia após sanitização.' };
    }
    
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
        return { valid: false, error: `Mensagem muito longa. Máximo de ${MAX_MESSAGE_LENGTH} caracteres.` };
    }
    
    return { valid: true, message: sanitized };
}

// Função para sanitizar resposta da IA (prevenção XSS)
function sanitizeResponse(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Função para criar timeout promise
function createTimeoutPromise(timeoutMs) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });
}

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

module.exports = async (req, res) => {
    // CORS headers com origem restritiva
    const origin = req.headers.origin;
    const allowedOrigin = ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))
        ? origin || '*'
        : ALLOWED_ORIGINS[0];
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validação de Content-Type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
        return res.status(400).json({ error: 'Content-Type deve ser application/json' });
    }

    // Validação de body
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Body inválido ou ausente' });
    }

    // Validação e sanitização da mensagem
    const validation = validateMessage(req.body.message);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }
    
    const userMessage = validation.message;

    try {
        // Validação do token
        const HUGGING_FACE_TOKEN = process.env.HUGGING_FACE_TOKEN;
        if (!HUGGING_FACE_TOKEN) {
            console.error('HUGGING_FACE_TOKEN não configurado');
            return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
        }

        // Validação do formato do token
        if (!HUGGING_FACE_TOKEN.startsWith('hf_') || HUGGING_FACE_TOKEN.length < 10) {
            console.error('Token inválido');
            return res.status(500).json({ error: 'Configuração do servidor inválida.' });
        }
        
        const personaData = await readPersonaData();
        
        // Validação da persona
        if (!personaData || typeof personaData !== 'object') {
            return res.status(500).json({ error: 'Erro ao carregar dados da persona.' });
        }
        
        let systemMessageContent = "Você deve responder como se fosse eu, em primeira pessoa. Adote a seguinte persona e use todas as informações fornecidas sobre mim para responder à mensagem do usuário de forma natural e consistente. Se uma informação não estiver disponível, não a invente. Responda apenas com base nos fatos apresentados sobre a minha persona.\n\nMinha Persona:\n";

        // Sanitização dos dados da persona antes de construir a mensagem
        for (const key in personaData) {
            if (personaData.hasOwnProperty(key)) {
                const value = personaData[key];
                // Sanitiza a chave
                const sanitizedKey = sanitizeInput(key);
                if (!sanitizedKey) continue;
                
                let formattedKey = sanitizedKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());

                if (Array.isArray(value)) {
                    if (value.length > 0 && value.length <= 100) { // Limita arrays grandes
                        const sanitizedArray = value
                            .filter(item => typeof item === 'string')
                            .map(item => sanitizeInput(item))
                            .filter(item => item.length > 0)
                            .slice(0, 50); // Limita a 50 itens
                        if (sanitizedArray.length > 0) {
                            systemMessageContent += ` - ${formattedKey}: ${sanitizedArray.join(', ')}.\n`;
                        }
                    }
                } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0 && Object.keys(value).length <= 50) {
                    systemMessageContent += ` - ${formattedKey}:\n`;
                    let subKeyCount = 0;
                    for (const subKey in value) {
                        if (subKeyCount >= 50) break; // Limita sub-chaves
                        if (value.hasOwnProperty(subKey)) {
                            const sanitizedSubValue = typeof value[subKey] === 'string' 
                                ? sanitizeInput(value[subKey]) 
                                : String(value[subKey]);
                            if (sanitizedSubValue) {
                                let formattedSubKey = sanitizeInput(subKey).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
                                systemMessageContent += `   - ${formattedSubKey}: ${sanitizedSubValue}\n`;
                                subKeyCount++;
                            }
                        }
                    }
                } else if (typeof value === 'string' && value.trim() !== '' && value !== "Assistente Padrão" && value !== "Um assistente virtual prestativo." && value !== "Neutro") {
                    const sanitizedValue = sanitizeInput(value);
                    if (sanitizedValue) {
                        systemMessageContent += ` - ${formattedKey}: ${sanitizedValue}.\n`;
                    }
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                    systemMessageContent += ` - ${formattedKey}: ${value}.\n`;
                }
            }
        }
        
        // Limita o tamanho da mensagem do sistema
        if (systemMessageContent.length > MAX_SYSTEM_MESSAGE_LENGTH) {
            systemMessageContent = systemMessageContent.substring(0, MAX_SYSTEM_MESSAGE_LENGTH) + '...';
        }
        
        systemMessageContent += "\nCom base estrita nesta persona, responda à seguinte mensagem do usuário:";

        const apiUrl = 'https://router.huggingface.co/hyperbolic/v1/chat/completions';
        const payload = {
            messages: [
                { role: 'system', content: systemMessageContent },
                { role: 'user', content: userMessage }
            ],
            model: 'deepseek-ai/DeepSeek-R1',
            stream: false,
            temperature: 0.7,
            max_tokens: 1000 // Limita tokens de resposta
        };

        // Validação do payload antes de enviar
        const payloadString = JSON.stringify(payload);
        if (payloadString.length > 50000) { // Limita tamanho do payload
            return res.status(400).json({ error: 'Payload muito grande.' });
        }

        // Requisição com timeout
        const response = await Promise.race([
            fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`, 
                    'Content-Type': 'application/json',
                    'User-Agent': 'CurriculumVitae-Chat/1.0'
                },
                body: payloadString
            }),
            createTimeoutPromise(REQUEST_TIMEOUT)
        ]);

        if (!response.ok) {
            const errorText = await response.text();
            let detailedError = errorText;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson && errorJson.error && errorJson.error.message) detailedError = errorJson.error.message;
            } catch (e) { /* não era JSON */ }
            throw new Error(`Erro da API Hugging Face: ${response.status} - ${detailedError}`);
        }

        // Validação da resposta
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Erro desconhecido');
            let detailedError = errorText;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson && errorJson.error && errorJson.error.message) {
                    detailedError = errorJson.error.message;
                }
            } catch (e) { /* não era JSON */ }
            
            // Não expõe detalhes internos em produção
            const isProduction = process.env.NODE_ENV === 'production';
            console.error('Erro da API Hugging Face:', response.status, isProduction ? 'Erro interno' : detailedError);
            
            return res.status(response.status >= 500 ? 500 : 400).json({ 
                error: isProduction 
                    ? 'Erro ao processar a requisição. Tente novamente.' 
                    : `Erro da API: ${response.status} - ${detailedError}` 
            });
        }

        const data = await response.json().catch(() => null);
        
        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            return res.status(500).json({ error: 'Resposta inválida da API.' });
        }

        const rawBotResponse = data.choices[0]?.message?.content;
        
        if (!rawBotResponse || typeof rawBotResponse !== 'string') {
            return res.status(500).json({ error: 'Resposta da IA inválida ou vazia.' });
        }

        // Limpa tags de reasoning e sanitiza resposta
        let finalResponse = rawBotResponse;
        if (finalResponse.includes('<think>')) {
            finalResponse = finalResponse.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
        }
        if (finalResponse.includes('<user_query>')) {
            finalResponse = finalResponse.replace(/<user_query>[\s\S]*?<\/user_query>\s*/gi, '').trim();
        }
        
        // Limita tamanho da resposta
        if (finalResponse.length > 2000) {
            finalResponse = finalResponse.substring(0, 2000) + '...';
        }

        // Sanitiza resposta final (prevenção XSS)
        const sanitizedResponse = sanitizeResponse(finalResponse);

        res.json({ reply: sanitizedResponse });

    } catch (error) {
        console.error('Erro interno no servidor no endpoint /chat:', error);
        
        // Não expõe detalhes de erro em produção
        const isProduction = process.env.NODE_ENV === 'production';
        const errorMessage = error.message || 'Erro desconhecido';
        
        // Tratamento específico para timeout
        if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
            return res.status(504).json({ error: 'Tempo de resposta excedido. Tente novamente.' });
        }
        
        // Tratamento para erros de rede
        if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
            return res.status(503).json({ error: 'Serviço temporariamente indisponível. Tente novamente.' });
        }
        
        res.status(500).json({ 
            error: isProduction 
                ? 'Erro interno no servidor. Tente novamente mais tarde.' 
                : `Erro interno: ${errorMessage}` 
        });
    }
};

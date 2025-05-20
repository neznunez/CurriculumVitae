// server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs').promises; // Para interagir com o sistema de arquivos (leitura/escrita)
const path = require('path');     // Para construir caminhos de arquivo de forma segura

const app = express();
const PORT = process.env.PORT || 3000;

// SEU TOKEN DA HUGGING FACE AQUI!
// IMPORTANTE: Para um projeto real, guarde tokens em variáveis de ambiente, não diretamente no código.
const HUGGING_FACE_TOKEN = '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'; // Substitua se o seu for diferente, mas este é o que testamos.

// Caminho para o arquivo de dados da persona
const personaFilePath = path.join(__dirname, 'chat-backend', 'persona_data.json');

// Middlewares
app.use(cors()); // Permite requisições de diferentes origens (seu frontend)
app.use(express.json()); // Permite que o servidor entenda requisições com corpo em JSON

// Função de mesclagem profunda (simples)
function deepMerge(target, source) {
    for (const key in source) {
        if (source.hasOwnProperty(key)) { // Adicionado hasOwnProperty para segurança
            if (source[key] instanceof Object && !(source[key] instanceof Array) && // Garante que não seja array
                key in target && target[key] instanceof Object && !(target[key] instanceof Array) ) {
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key]; // Arrays serão substituídos, o que é ok para 'interesses' se a IA retornar o array completo
            }
        }
    }
    return target;
}

async function readPersonaData() {
    try {
        // Verifica se o diretório existe, se não, cria
        const dir = path.dirname(personaFilePath);
        try {
            await fs.access(dir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dir, { recursive: true });
                console.log(`Diretório ${dir} criado.`);
            } else {
                throw error;
            }
        }
        const data = await fs.readFile(personaFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') { // Se o arquivo não existe, retorna padrão e será criado depois
            console.warn('persona_data.json não encontrado, usando persona padrão. Será criado ao salvar.');
        } else {
            console.warn('Não foi possível ler persona_data.json, usando persona padrão. Erro:', error.code);
        }
        return {
            nomeCompleto: "Assistente Padrão",
            descricaoCurta: "Um assistente virtual prestativo.",
            tomDeVoz: "Neutro",
            interesses: [],
            detalhesAdicionais: {}
        };
    }
}

async function writePersonaData(data) {
    try {
        // Garante que o diretório exista antes de escrever
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
        await fs.writeFile(personaFilePath, JSON.stringify(data, null, 4), 'utf8');
        console.log('persona_data.json atualizado com sucesso em:', personaFilePath);
    } catch (error) {
        console.error('Erro ao escrever em persona_data.json:', error);
        throw error;
    }
}

// Endpoint para ATUALIZAR persona via CHAT com IA no modo de edição
app.post('/persona-chat-update', async (req, res) => {
    const userConversationText = req.body.text;

    if (!userConversationText) {
        return res.status(400).json({ error: 'Nenhum texto recebido para atualizar a persona.' });
    }

    try {
        const personaSystemPrompt = `
Você é um assistente que ajuda a construir um perfil de persona detalhado.
Analise o texto fornecido pelo usuário para extrair ou inferir atributos da persona.
Estruture sua resposta ESTRITAMENTE como um único objeto JSON.
Para informações comuns, use nomes de campo como 'nomeCompleto' (string), 'descricaoCurta' (string), 'tomDeVoz' (string), 'interesses' (este DEVE ser um array de strings).
Para fatos diversos ou menos comuns, adicione-os como pares chave-valor dentro de um objeto chamado 'detalhesAdicionais'.
Se você identificar uma categoria de informação nova e MUITO relevante que acredite merecer seu próprio campo de primeiro nível (além dos mencionados acima),
você PODE sugerir um novo nome de campo para ela (use camelCase, ex: 'areaDeAtuacao', 'filosofiaPessoal', 'cidadeNatal').
Sua resposta deve ser APENAS o objeto JSON completo com todos os atributos da persona que você conseguiu identificar ou inferir.
Não inclua nenhuma explicação, introdução, ou texto adicional fora do objeto JSON.
O JSON deve começar com { e terminar com }.

Exemplo de entrada do usuário: "Meu nome é Carlos, sou de SP e adoro programar em Python nas horas vagas. Minha comida favorita é lasanha."
Exemplo de sua resposta JSON:
{
  "nomeCompleto": "Carlos",
  "cidadeNatal": "SP",
  "detalhesAdicionais": {
    "comidaFavorita": "lasanha"
  },
  "interesses": ["programar em Python"]
}

Texto do usuário para análise:
"${userConversationText}"
`;

        const apiUrl = 'https://router.huggingface.co/hyperbolic/v1/chat/completions';
        const payload = {
            messages: [{ role: 'system', content: personaSystemPrompt }],
            model: 'deepseek-ai/DeepSeek-R1',
            stream: false,
            temperature: 0.3, // Baixa temperatura para saídas mais determinísticas e factuais
            max_tokens: 500 // Limita o tamanho da resposta da IA
        };

        console.log('Enviando conversa para IA para extração de persona (primeiros 100 chars):', userConversationText.substring(0,100));
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro da API Hugging Face ao extrair persona:', response.status, errorText);
            throw new Error(`Erro da API Hugging Face: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const rawIaResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!rawIaResponse) {
            return res.status(500).json({ error: 'IA não retornou conteúdo para atualizar persona.' });
        }
        console.log('Resposta bruta da IA (para extração de persona):', rawIaResponse);


        let suggestedPersonaUpdate;
        try {
            const jsonMatch = rawIaResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch && jsonMatch[0]) {
                suggestedPersonaUpdate = JSON.parse(jsonMatch[0]);
                 console.log('Sugestões de persona da IA (JSON parseado):', suggestedPersonaUpdate);
            } else {
                console.error("Nenhum JSON válido encontrado na resposta da IA:", rawIaResponse);
                throw new Error("Nenhum JSON válido encontrado na resposta da IA.");
            }
        } catch (e) {
            console.error('Erro ao parsear JSON da IA:', e, "\nResposta Bruta da IA:", rawIaResponse);
            return res.status(500).json({ error: 'IA retornou formato inválido. Não foi possível atualizar.', details: rawIaResponse });
        }

        let currentPersona = await readPersonaData();
        const mergedPersona = deepMerge(JSON.parse(JSON.stringify(currentPersona)), suggestedPersonaUpdate); // Mescla em uma cópia profunda

        await writePersonaData(mergedPersona);
        res.json({ success: true, message: 'Persona atualizada com base na conversa com IA.', persona: mergedPersona });

    } catch (error) {
        console.error('Erro no endpoint /persona-chat-update:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar persona via IA.', details: error.message });
    }
});

// Endpoint de CHAT (modificado para ler persona dinamicamente)
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) {
        return res.status(400).json({ error: 'Nenhuma mensagem recebida.' });
    }

    try {
        const personaData = await readPersonaData();
        let systemMessageContent = "Você deve responder como se fosse eu, em primeira pessoa. Adote a seguinte persona e use todas as informações fornecidas sobre mim para responder à mensagem do usuário de forma natural e consistente. Se uma informação não estiver disponível, não a invente. Responda apenas com base nos fatos apresentados sobre a minha persona.\n\nMinha Persona:\n";

        for (const key in personaData) {
            if (personaData.hasOwnProperty(key)) {
                const value = personaData[key];
                // Converte camelCase e snake_case para "Nome Formatado"
                let formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());

                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        systemMessageContent += ` - ${formattedKey}: ${value.join(', ')}.\n`;
                    }
                } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
                    systemMessageContent += ` - ${formattedKey}:\n`;
                    for (const subKey in value) {
                        if (value.hasOwnProperty(subKey)) {
                            let formattedSubKey = subKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
                            systemMessageContent += `   - ${formattedSubKey}: ${value[subKey]}\n`;
                        }
                    }
                } else if (typeof value === 'string' && value.trim() !== '' && value !== "Assistente Padrão" && value !== "Um assistente virtual prestativo." && value !== "Neutro") {
                    systemMessageContent += ` - ${formattedKey}: ${value}.\n`;
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                    systemMessageContent += ` - ${formattedKey}: ${value}.\n`;
                }
            }
        }
        systemMessageContent += "\nCom base estrita nesta persona, responda à seguinte mensagem do usuário:";
       // console.log("System Message Dinâmico para IA (Chat Normal):", systemMessageContent);


        const apiUrl = 'https://router.huggingface.co/hyperbolic/v1/chat/completions';
        const payload = {
            messages: [
                { role: 'system', content: systemMessageContent },
                { role: 'user', content: userMessage }
            ],
            model: 'deepseek-ai/DeepSeek-R1',
            stream: false,
            temperature: 0.7 // Um pouco mais de criatividade para o chat normal
        };

        // console.log('Enviando para Hugging Face API (Chat Normal) com persona dinâmica...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let detailedError = errorText;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson && errorJson.error && errorJson.error.message) detailedError = errorJson.error.message;
            } catch (e) { /* não era JSON */ }
            console.error('Erro da API Hugging Face no /chat:', response.status, detailedError);
            throw new Error(`Erro da API Hugging Face: ${response.status} - ${detailedError}`);
        }

        const data = await response.json();
        const rawBotResponse = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
            ? data.choices[0].message.content
            : 'Desculpe, não consegui processar a resposta do modelo no momento.';

        let finalResponse = rawBotResponse;
        if (finalResponse.includes('<think>')) {
            finalResponse = finalResponse.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim();
        }
        if (finalResponse.includes('<user_query>')) {
            finalResponse = finalResponse.replace(/<user_query>[\s\S]*?<\/user_query>\s*/, '').trim();
        }
        // console.log('Resposta limpa da IA (Chat Normal):', finalResponse);
        res.json({ reply: finalResponse });

    } catch (error) {
        console.error('Erro interno no servidor no endpoint /chat:', error);
        res.status(500).json({ error: 'Erro interno no servidor (chat).', details: error.message });
    }
});

// Endpoint para obter a persona atual (GET)
app.get('/get-persona', async (req, res) => {
    try {
        const personaData = await readPersonaData();
        res.json(personaData);
    } catch (error) {
        console.error('Erro ao obter persona:', error);
        res.status(500).json({ error: 'Erro ao carregar dados da persona.' });
    }
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor backend do chat rodando em http://localhost:${PORT}`);
    // Garante que o arquivo persona_data.json exista ao iniciar
    readPersonaData().then(async (initialData) => {
        try {
            await fs.access(personaFilePath);
             // console.log("persona_data.json já existe.");
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log("persona_data.json não encontrado, criando com valores padrão...");
                await writePersonaData(initialData); // Escreve os dados padrão
            } else {
                console.error("Erro ao verificar persona_data.json na inicialização:", error);
            }
        }
    }).catch(err => console.error("Erro crítico ao tentar inicializar persona_data.json:", err));
}); 
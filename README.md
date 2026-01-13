# Curriculum Vitae - João Victor Nunes

Portfólio e currículo interativo com visualização formal e terminal.

## 🚀 Deploy no Vercel

### Pré-requisitos

1. Conta no [Vercel](https://vercel.com)
2. Token da Hugging Face (para funcionalidade de chat)

### Passos para Deploy

1. **Instale a CLI do Vercel** (se ainda não tiver):
   ```bash
   npm i -g vercel
   ```

2. **Faça login no Vercel**:
   ```bash
   vercel login
   ```

3. **Configure as variáveis de ambiente**:
   - Acesse o dashboard do Vercel após o deploy
   - Vá em Settings > Environment Variables
   - Adicione: `HUGGING_FACE_TOKEN` com seu token da Hugging Face

4. **Faça o deploy**:
   ```bash
   vercel
   ```
   
   Ou conecte seu repositório GitHub diretamente no dashboard do Vercel.

### Estrutura do Projeto

- `index.html` - Versão formal (ativa)
- `index-terminal.html` - Versão terminal (backup)
- `index-formal.html` - Versão formal (backup)
- `api/chat.js` - Endpoint serverless para chat
- `api/get-persona.js` - Endpoint serverless para obter persona
- `vercel.json` - Configuração do Vercel

### Variáveis de Ambiente

- `HUGGING_FACE_TOKEN` - Token da API Hugging Face (obrigatório para chat)

### Desenvolvimento Local

Para rodar localmente:

```bash
npm install
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

### Alternar entre Versões

Para alternar entre a versão terminal e formal antes de fazer commit:

```bash
npm run switch:terminal  # ou
npm run switch:formal
```

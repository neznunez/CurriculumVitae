# Segurança - Requisições de IA e Chat

Este documento descreve as medidas de segurança implementadas nas requisições de IA e chat.

## Medidas de Segurança Implementadas

### 1. Validação e Sanitização de Entrada

- **Limite de tamanho**: Mensagens limitadas a 2000 caracteres
- **Sanitização de caracteres**: Remoção de caracteres de controle e caracteres especiais perigosos
- **Validação de tipos**: Verificação rigorosa de tipos de dados antes do processamento
- **Validação de Content-Type**: Verificação de que requisições POST usam `application/json`

### 2. Proteção contra XSS (Cross-Site Scripting)

- **Sanitização de saída**: Todas as respostas da IA são sanitizadas antes de serem enviadas ao cliente
- **Escape HTML**: Uso de `textContent` e escape de caracteres HTML no frontend
- **Validação de resposta**: Verificação de que respostas são strings válidas antes de processar

### 3. Timeout e Limites de Requisição

- **Timeout de requisição**: 30 segundos no servidor, 35 segundos no cliente
- **Limite de tokens**: Respostas limitadas a 1000 tokens
- **Limite de payload**: Payload máximo de 50KB
- **Limite de arrays**: Arrays limitados a 50 itens, strings a 200 caracteres

### 4. CORS (Cross-Origin Resource Sharing)

- **Origens restritivas**: Configurável via variável de ambiente `ALLOWED_ORIGINS`
- **Headers específicos**: Apenas headers necessários são permitidos
- **Max-Age**: Cache de preflight limitado a 24 horas

### 5. Tratamento de Erros Seguro

- **Ocultação de detalhes**: Em produção, detalhes de erro não são expostos ao cliente
- **Logging seguro**: Erros são logados no servidor sem expor informações sensíveis
- **Mensagens genéricas**: Clientes recebem mensagens de erro genéricas em produção

### 6. Validação de Token

- **Verificação de existência**: Token deve estar configurado
- **Validação de formato**: Token deve começar com `hf_` e ter tamanho mínimo
- **Armazenamento seguro**: Token armazenado apenas em variáveis de ambiente

### 7. Sanitização de Dados da Persona

- **Limite de campos**: Objetos aninhados limitados a 50 chaves
- **Sanitização de valores**: Todos os valores de string são sanitizados
- **Validação de estrutura**: Verificação de que dados são objetos válidos

### 8. Proteção no Frontend

- **Validação no cliente**: Validação antes de enviar requisições
- **Desabilitação de UI**: Botões desabilitados durante processamento
- **Timeout no cliente**: Timeout de 35 segundos para evitar requisições pendentes
- **Escape de HTML**: Todas as mensagens são escapadas antes de exibir

## Variáveis de Ambiente

### Obrigatórias
- `HUGGING_FACE_TOKEN`: Token da API Hugging Face (obrigatório)

### Opcionais
- `ALLOWED_ORIGINS`: Origens permitidas para CORS (separadas por vírgula, padrão: `*`)
- `NODE_ENV`: Ambiente de execução (`production` ou `development`)

## Limites e Restrições

- **Mensagem do usuário**: Máximo 2000 caracteres
- **Mensagem do sistema**: Máximo 5000 caracteres
- **Resposta da IA**: Máximo 2000 caracteres
- **Tokens de resposta**: Máximo 1000 tokens
- **Timeout**: 30 segundos (servidor), 35 segundos (cliente)
- **Arrays**: Máximo 50 itens
- **Objetos aninhados**: Máximo 50 chaves

## Recomendações Adicionais

1. **Rate Limiting**: Considere implementar rate limiting em produção (ex: Vercel Edge Functions)
2. **Monitoramento**: Configure logs e monitoramento para detectar padrões suspeitos
3. **Backup de dados**: Faça backup regular do arquivo `persona_data.json`
4. **Atualizações**: Mantenha dependências atualizadas
5. **HTTPS**: Sempre use HTTPS em produção

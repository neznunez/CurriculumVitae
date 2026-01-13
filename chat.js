// Configuração do chat
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatHistory = document.getElementById('chat-history');

    // Função para sanitizar HTML (prevenção XSS)
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Função para adicionar mensagem ao histórico
    function addMessage(message, isUser = false) {
        const messageElement = document.createElement('p');
        messageElement.className = `chat-message ${isUser ? 'user' : 'bot'}`;
        // Usa textContent para prevenir XSS, mas permite formatação básica
        const sender = isUser ? 'You' : 'System';
        messageElement.innerHTML = `<span class="sender">${escapeHtml(sender)}:</span> ${escapeHtml(message)}`;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // Função para validar mensagem no cliente
    function validateClientMessage(message) {
        if (!message || typeof message !== 'string') {
            return { valid: false, error: 'Mensagem inválida.' };
        }
        
        const trimmed = message.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: 'Mensagem não pode estar vazia.' };
        }
        
        if (trimmed.length > 2000) {
            return { valid: false, error: 'Mensagem muito longa. Máximo de 2000 caracteres.' };
        }
        
        return { valid: true, message: trimmed };
    }

    // Função para enviar mensagem ao servidor
    async function sendMessage(message) {
        try {
            // Validação no cliente
            const validation = validateClientMessage(message);
            if (!validation.valid) {
                return validation.error;
            }
            
            const sanitizedMessage = validation.message;
            
            // Detecta se está em produção (Vercel) ou desenvolvimento
            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000/chat'
                : '/api/chat';
            
            // Timeout de 35 segundos (maior que o do servidor)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 35000);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: sanitizedMessage }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                throw new Error(errorData.error || `Erro ${response.status}`);
            }

            const data = await response.json();
            
            // Validação da resposta
            if (!data || typeof data !== 'object') {
                throw new Error('Resposta inválida do servidor');
            }
            
            return data.reply || data.response || 'Desculpe, não consegui processar a resposta.';
        } catch (error) {
            console.error('Erro:', error);
            
            if (error.name === 'AbortError') {
                return 'Tempo de resposta excedido. Tente novamente.';
            }
            
            if (error.message) {
                return `Erro: ${error.message}`;
            }
            
            return 'Desculpe, ocorreu um erro na comunicação com o servidor.';
        }
    }

    // Handler para envio de mensagem
    async function handleSendMessage() {
        const message = chatInput.value;
        
        // Validação antes de processar
        const validation = validateClientMessage(message);
        if (!validation.valid) {
            addMessage(validation.error, false);
            return;
        }

        // Limpa o input
        chatInput.value = '';
        
        // Desabilita botão durante processamento
        chatSendBtn.disabled = true;
        chatInput.disabled = true;

        // Adiciona mensagem do usuário
        addMessage(validation.message, true);

        // Adiciona indicador de digitação
        const typingIndicator = document.createElement('p');
        typingIndicator.className = 'chat-message bot typing-indicator';
        typingIndicator.innerHTML = '<span class="sender">System:</span> <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        chatHistory.appendChild(typingIndicator);

        try {
            // Envia mensagem ao servidor
            const response = await sendMessage(validation.message);

            // Remove indicador de digitação
            if (typingIndicator.parentNode) {
                chatHistory.removeChild(typingIndicator);
            }

            // Adiciona resposta do sistema
            addMessage(response);
        } catch (error) {
            // Remove indicador de digitação em caso de erro
            if (typingIndicator.parentNode) {
                chatHistory.removeChild(typingIndicator);
            }
            addMessage('Erro ao processar a mensagem. Tente novamente.', false);
        } finally {
            // Reabilita botão e input
            chatSendBtn.disabled = false;
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    // Event listeners
    chatSendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
}); 
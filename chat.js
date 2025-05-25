// Configuração do chat
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatHistory = document.getElementById('chat-history');

    // Função para adicionar mensagem ao histórico
    function addMessage(message, isUser = false) {
        const messageElement = document.createElement('p');
        messageElement.className = `chat-message ${isUser ? 'user' : 'bot'}`;
        messageElement.innerHTML = `<span class="sender">${isUser ? 'You' : 'System'}:</span> ${message}`;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // Função para enviar mensagem ao servidor
    async function sendMessage(message) {
        try {
            const response = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('Erro na comunicação com o servidor');
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Erro:', error);
            return 'Desculpe, ocorreu um erro na comunicação com o servidor.';
        }
    }

    // Handler para envio de mensagem
    async function handleSendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Limpa o input
        chatInput.value = '';

        // Adiciona mensagem do usuário
        addMessage(message, true);

        // Adiciona indicador de digitação
        const typingIndicator = document.createElement('p');
        typingIndicator.className = 'chat-message bot typing-indicator';
        typingIndicator.innerHTML = '<span class="sender">System:</span> <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
        chatHistory.appendChild(typingIndicator);

        // Envia mensagem ao servidor
        const response = await sendMessage(message);

        // Remove indicador de digitação
        chatHistory.removeChild(typingIndicator);

        // Adiciona resposta do sistema
        addMessage(response);
    }

    // Event listeners
    chatSendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
}); 
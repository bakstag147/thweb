```javascript
// Game state
const gameState = {
    currentLevel: 1,
    isLoading: false,
    chatContext: [],
    anthropicApiKey: 'your-api-key-here'
};

// Level content definitions
const levels = {
    1: {
        number: 1,
        title: "Заря Человечества",
        description: "Твоё племя голодает. Последний кусок мамонта хранится у старого Гррха. По традиции, его нельзя трогать до следующей луны, но твои соплеменники слишком слабы, чтобы ждать.",
        sceneDescription: "Перед вами сидит старый, уставший хранитель припасов возле входа в пещеру с запасами",
        initialMessage: "Урррх... Молодой охотник, зачем ты пришёл к запасам? Мясо нельзя трогать до новой луны. Такова традиция предков.",
        prompt: `Ты играешь роль старого хранителя припасов в первобытном племени.
        Характер: уставший, заботливый, уважающий традиции, но понимающий нужды племени.
        Сложность: ОЧЕНЬ НИЗКАЯ - легко поддаёшься на эмоциональные аргументы.
        
        Основные черты:
        - Легко поддаёшься на просьбы о помощи голодающим
        - Боишься гнева духов
        - Говоришь простыми фразами
        
        Если игрок успешно убедил тебя (упомянул голодающих детей или предложил оставить подношение духам),
        ты должен ответить фразой:
        "Хорошо, возьми мясо. Но оставь подношение духам."
        
        Формат ответа:
        1. Если хочешь описать действие или ситуацию - используй *текст*
        2. Прямую речь пиши без звёздочек`,
        victoryConditions: ["Хорошо, возьми мясо. Но оставь подношение духам."],
        victoryMessage: "*Старый хранитель отступает в сторону, пропуская вас к запасам*",
        image: "bgLevel1.jpg" // Make sure to add images
    },
    // Add more levels here...
};

// Message types
const MessageType = {
    MESSAGE: 'message',
    STATUS: 'status',
    VICTORY: 'victory'
};

// Helper functions
function createMessage(content, isUser, type = MessageType.MESSAGE) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === MessageType.MESSAGE 
        ? `message ${isUser ? 'user' : 'bot'}`
        : type === MessageType.STATUS 
            ? 'status-message' 
            : 'victory-message';

    if (type === MessageType.VICTORY) {
        messageDiv.innerHTML = `
            <div>${content}</div>
            <button onclick="startNextLevel()">Следующий уровень</button>
        `;
    } else {
        messageDiv.textContent = content;
    }

    return messageDiv;
}

async function sendToClaude(messages) {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': gameState.anthropicApiKey
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229',
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

function checkVictoryCondition(message) {
    const currentLevel = levels[gameState.currentLevel];
    return currentLevel.victoryConditions.some(condition => message.includes(condition));
}

// Core game functions
async function loadLevel(levelNumber) {
    const level = levels[levelNumber];
    if (!level) return;

    gameState.currentLevel = levelNumber;
    document.getElementById('currentLevel').textContent = levelNumber;
    document.getElementById('levelImage').src = level.image;

    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';

    // Add initial messages
    chatContainer.appendChild(createMessage(`Уровень ${level.number}: ${level.title}`, false, MessageType.STATUS));
    chatContainer.appendChild(createMessage(level.description, false, MessageType.STATUS));
    chatContainer.appendChild(createMessage(level.sceneDescription, false, MessageType.STATUS));
    chatContainer.appendChild(createMessage(level.initialMessage, false, MessageType.MESSAGE));

    // Reset context
    gameState.chatContext = [{
        role: 'system',
        content: level.prompt
    }];
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message || gameState.isLoading) return;

    input.value = '';
    const chatContainer = document.getElementById('chatContainer');
    
    // Add user message
    chatContainer.appendChild(createMessage(message, true));
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Check for test victory condition
    if (message.toLowerCase().includes('go333')) {
        showVictoryMessage();
        return;
    }

    // Add loading indicator
    gameState.isLoading = true;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = '...';
    chatContainer.appendChild(loadingDiv);

    try {
        // Add message to context
        gameState.chatContext.push({
            role: 'user',
            content: message
        });

        // Get response from Claude
        const response = await sendToClaude(gameState.chatContext);
        
        // Process response
        const components = response.split('*');
        for (let i = 0; i < components.length; i++) {
            const component = components[i].trim();
            if (!component) continue;

            if (i % 2 === 1) {
                // Status message (between asterisks)
                chatContainer.appendChild(createMessage(component, false, MessageType.STATUS));
            } else {
                // Normal message
                chatContainer.appendChild(createMessage(component, false, MessageType.MESSAGE));
                
                // Check for victory
                if (checkVictoryCondition(component)) {
                    const currentLevel = levels[gameState.currentLevel];
                    chatContainer.appendChild(createMessage(currentLevel.victoryMessage, false, MessageType.STATUS));
                    showVictoryMessage();
                    break;
                }
            }
        }

        // Add response to context
        gameState.chatContext.push({
            role: 'assistant',
            content: response
        });
    } catch (error) {
        chatContainer.appendChild(createMessage(`Ошибка: ${error.message}`, false, MessageType.STATUS));
    } finally {
        // Remove loading indicator and update state
        chatContainer.removeChild(loadingDiv);
        gameState.isLoading = false;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function showVictoryMessage() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.appendChild(createMessage(
        `🎉 Поздравляем! Вы успешно прошли уровень ${gameState.currentLevel}!`,
        false,
        MessageType.VICTORY
    ));
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function startNextLevel() {
    if (gameState.currentLevel < 10) {
        loadLevel(gameState.currentLevel + 1);
    } else {
        // Show final statistics or ending
        alert('Поздравляем! Вы прошли игру!');
    }
}

function restartLevel() {
    loadLevel(gameState.currentLevel);
}

// Event listeners
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initialize game
window.onload = () => {
    loadLevel(1);
};
```

// Game state
const gameState = {
    currentLevel: 1,
    isLoading: false,
    chatContext: [],
    anthropicApiKey: null
};

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded');

    // Add event listeners
    document.getElementById('startGameButton').addEventListener('click', submitApiKey);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('restartButton').addEventListener('click', restartLevel);
    document.getElementById('logoutButton').addEventListener('click', logout);

    // Check for saved API key
    const savedApiKey = localStorage.getItem('anthropicApiKey');
    if (savedApiKey) {
        console.log('Found saved API key');
        startGame(savedApiKey);
    }
});

// Test and submit API key
async function submitApiKey() {
    console.log('Submitting API key');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        alert('Пожалуйста, введите API ключ');
        return;
    }

    try {
        console.log('Testing API key');
        const isValid = await testApiKey(apiKey);
        if (isValid) {
            console.log('API key is valid');
            localStorage.setItem('anthropicApiKey', apiKey);
            startGame(apiKey);
        } else {
            console.log('API key is invalid');
            alert('Неверный API ключ. Пожалуйста, проверьте и попробуйте снова.');
        }
    } catch (error) {
        console.error('Error testing API key:', error);
        alert('Произошла ошибка при проверке ключа. Пожалуйста, попробуйте снова.');
    }
}

// Test API key validity
async function testApiKey(apiKey) {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229',
                messages: [{
                    role: 'user',
                    content: 'Test message'
                }],
                max_tokens: 1024
            })
        });
        console.log('API test response:', response.status);
        return response.ok;
    } catch (error) {
        console.error('API test error:', error);
        return false;
    }
}

// Start game with valid API key
function startGame(apiKey) {
    console.log('Starting game');
    gameState.anthropicApiKey = apiKey;
    const modal = document.getElementById('apiKeyModal');
    const gameContainer = document.querySelector('.game-container');
    
    if (modal && gameContainer) {
        modal.style.display = 'none';
        gameContainer.style.display = 'flex';
        loadLevel(1);
    } else {
        console.error('Could not find modal or game container elements');
    }
}

// Create message element
function createMessage(content, isUser, type = 'message') {
    const messageDiv = document.createElement('div');
    
    switch(type) {
        case 'status':
            messageDiv.className = 'status-message';
            break;
        case 'victory':
            messageDiv.className = 'victory-message';
            messageDiv.innerHTML = `
                <div>${content}</div>
                <button onclick="startNextLevel()">Следующий уровень</button>
            `;
            break;
        default:
            messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
            break;
    }
    
    if (type !== 'victory') {
        messageDiv.textContent = content;
    }
    
    return messageDiv;
}

// Send message to Claude
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || gameState.isLoading) return;
    
    messageInput.value = '';
    const chatContainer = document.getElementById('chatContainer');

    // Add user message
    chatContainer.appendChild(createMessage(message, true));
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Check for test victory condition
    if (message.toLowerCase().includes('go333')) {
        showVictoryMessage();
        return;
    }

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

        const response = await sendToClaude(gameState.chatContext);
        const components = response.split('*');
        
        for (let i = 0; i < components.length; i++) {
            const component = components[i].trim();
            if (!component) continue;

            if (i % 2 === 1) { // Status message
                chatContainer.appendChild(createMessage(component, false, 'status'));
            } else { // Normal message
                chatContainer.appendChild(createMessage(component, false));
                
                if (checkVictoryCondition(component)) {
                    const currentLevel = levels[gameState.currentLevel];
                    chatContainer.appendChild(createMessage(currentLevel.victoryMessage, false, 'status'));
                    showVictoryMessage();
                    break;
                }
            }
        }

        gameState.chatContext.push({
            role: 'assistant',
            content: response
        });

    } catch (error) {
        chatContainer.appendChild(createMessage(`Ошибка: ${error.message}`, false, 'status'));
    } finally {
        chatContainer.removeChild(loadingDiv);
        gameState.isLoading = false;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Send message to Claude API
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
                messages: messages,
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

// Load level
async function loadLevel(levelNumber) {
    const level = levels[levelNumber];
    if (!level) return;

    gameState.currentLevel = levelNumber;
    document.getElementById('currentLevel').textContent = levelNumber;
    document.getElementById('levelImage').src = level.image || 'https://via.placeholder.com/800x400';

    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';

    // Add initial messages
    chatContainer.appendChild(createMessage(`Уровень ${level.number}: ${level.title}`, false, 'status'));
    chatContainer.appendChild(createMessage(level.description, false, 'status'));
    chatContainer.appendChild(createMessage(level.sceneDescription, false, 'status'));
    chatContainer.appendChild(createMessage(level.initialMessage, false));

    // Reset context
    gameState.chatContext = [{
        role: 'system',
        content: level.prompt
    }];
}

// Show victory message
function showVictoryMessage() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.appendChild(createMessage(
        `🎉 Поздравляем! Вы успешно прошли уровень ${gameState.currentLevel}!`,
        false,
        'victory'
    ));
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Start next level
function startNextLevel() {
    if (gameState.currentLevel < 10) {
        loadLevel(gameState.currentLevel + 1);
    } else {
        alert('Поздравляем! Вы прошли игру!');
    }
}

// Restart current level
function restartLevel() {
    loadLevel(gameState.currentLevel);
}

// Logout
function logout() {
    localStorage.removeItem('anthropicApiKey');
    location.reload();
}

// Level definitions
const levels = {
    1: {
        number: 1,
        title: "Заря Человечества",
        description: "Твоё племя голодает. Последний кусок мамонта хранится у старого Гррха. По традиции, его нельзя трогать до следующей луны, но твои соплеменники слишком слабы, чтобы ждать.",
        sceneDescription: "Перед вами сидит старый, уставший хранитель припасов возле входа в пещеру с запасами",
        initialMessage: "Урррх... Молодой охотник, зачем ты пришёл к запасам? Мясо нельзя трогать до новой луны. Такова традиция предков.",
        prompt: "Ты играешь роль старого хранителя припасов в первобытном племени. Характер: уставший, заботливый, уважающий традиции, но понимающий нужды племени. Если игрок успешно убедил тебя (упомянул голодающих детей или предложил оставить подношение духам), ты должен ответить фразой: 'Хорошо, возьми мясо. Но оставь подношение духам.'",
        victoryConditions: ["Хорошо, возьми мясо. Но оставь подношение духам."],
        victoryMessage: "*Старый хранитель отступает в сторону, пропуская вас к запасам*",
        image: "https://via.placeholder.com/800x400/333/fff?text=Level+1"
    }
    // Добавьте остальные уровни здесь
};

// script.js

// 全局變數，用於追蹤當前的滾動動畫 ID
let currentScrollAnimationId = null;

/**
 * 平滑滾動元素到指定的 scrollTop 位置。
 */
function smoothScrollTo(element, to, duration = 800) {
    if (!element) return;
    const start = element.scrollTop;
    const change = to - start;
    let startTime = null;
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
    if (currentScrollAnimationId) {
        cancelAnimationFrame(currentScrollAnimationId);
    }
    function animateScroll(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);
        element.scrollTop = start + change * easedProgress;
        if (timeElapsed < duration) {
            currentScrollAnimationId = requestAnimationFrame(animateScroll);
        } else {
            element.scrollTop = to;
            currentScrollAnimationId = null;
        }
    }
    currentScrollAnimationId = requestAnimationFrame(animateScroll);
}

/**
 * 輔助函式：獲取 #chat-window 元素並平滑捲動到底部。
 */
function getChatWindowAndScrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
        setTimeout(() => {
            smoothScrollTo(chatWindow, chatWindow.scrollHeight, 800);
        }, 0);
    } else {
        console.error("CRITICAL: Element with ID 'chat-window' NOT FOUND. Cannot scroll.");
    }
}

/**
 * 顯示 AI 輸入中的打字指示器。
 */
function showTypingIndicator() {
    const aiMessageBubble = document.createElement('div');
    aiMessageBubble.className = 'message ai-message';
    aiMessageBubble.style.opacity = '1';
    const localDotsContainer = document.createElement('div');
    localDotsContainer.className = 'typing-indicator-dots';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        localDotsContainer.appendChild(dot);
    }
    const localTextContainer = document.createElement('div');
    localTextContainer.className = 'ai-response-text';
    localTextContainer.style.opacity = '0';
    localTextContainer.style.display = 'none';
    aiMessageBubble.appendChild(localDotsContainer);
    aiMessageBubble.appendChild(localTextContainer);
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) {
        console.error("CRITICAL: Element with ID 'messages' NOT FOUND when trying to show typing indicator.");
        return { aiMessageBubble: null, localDotsContainer: null, localTextContainer: null };
    }
    messagesContainer.appendChild(aiMessageBubble);
    getChatWindowAndScrollToBottom();
    return { aiMessageBubble, localDotsContainer, localTextContainer };
}

/**
 * 在聊天視窗中顯示一條訊息 (使用者)。
 */
function displayMessage(text, className) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    messageElement.textContent = text;
    
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.appendChild(messageElement);
        getChatWindowAndScrollToBottom();
    } else {
        console.error("CRITICAL: Element with ID 'messages' NOT FOUND. Cannot append message.");
    }
}

/**
 * 處理使用者輸入、獲取 AI 回應並在介面上顯示。
 */
function sendMessage() {
    const userInput = document.getElementById('user-input');
    if (!userInput) {
        console.error("CRITICAL: Element with ID 'user-input' NOT FOUND.");
        return;
    }
    const messageText = userInput.value.trim();
    if (messageText === '') { return; }

    displayMessage(messageText, 'user-message');
    userInput.value = '';
    userInput.style.height = 'auto'; // 傳送後恢復高度
    userInput.focus();

    const { aiMessageBubble, localDotsContainer, localTextContainer } = showTypingIndicator();

    if (!aiMessageBubble || !localDotsContainer || !localTextContainer) {
        console.error("Failed to create typing indicator elements. Aborting AI response.");
        return;
    }
    
    // 【修復】還原原始的、正確的動畫處理邏輯
    getAIResponse(messageText)
        .then(aiResponse => {
            const responseText = aiResponse || ''; 

            if (aiMessageBubble && aiMessageBubble.parentNode && localDotsContainer && localTextContainer) {
                // 淡出打字點
                localDotsContainer.style.opacity = '0'; 
                localDotsContainer.addEventListener('transitionend', () => {
                    if (localDotsContainer.parentNode) {
                        localDotsContainer.remove(); 
                    }

                    // 處理 Markdown 並注入 HTML
                    let processedHtml = '';
                    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                        const rawHtml = marked.parse(responseText, { gfm: true, breaks: true });
                        processedHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
                    } else {
                        const tempDiv = document.createElement('div');
                        tempDiv.textContent = responseText;
                        processedHtml = tempDiv.innerHTML;
                    }
                    localTextContainer.innerHTML = processedHtml;
                    
                    // 顯示文字內容
                    localTextContainer.style.display = 'block';
                    localTextContainer.style.opacity = '1';     

                    // 觸發從左到右的動畫
                    aiMessageBubble.classList.add('reveal-from-left'); 
                    
                    // 動畫結束後才進行滾動，確保高度計算正確
                    aiMessageBubble.addEventListener('animationend', () => {
                        getChatWindowAndScrollToBottom();
                    }, { once: true });

                }, { once: true }); 
            } else {
                // 如果發生意外，退回舊的顯示方式
                if(aiMessageBubble && aiMessageBubble.parentNode) aiMessageBubble.remove();
                const newMessage = document.createElement('div');
                newMessage.className = 'message ai-message';
                newMessage.textContent = responseText; // 此處不處理 markdown 以求簡單
                document.getElementById('messages').appendChild(newMessage);
                getChatWindowAndScrollToBottom();
            }
        })
        .catch(error => {
            console.error('Error getting AI response in sendMessage promise chain:', error);
            if (aiMessageBubble && aiMessageBubble.parentNode) {
                aiMessageBubble.remove(); 
            }
            displayMessage('抱歉，AI 回應時發生錯誤。', 'ai-message error-message'); 
        });
}

/**
 * 從後端獲取 AI 的回應。
 */
async function getAIResponse(userMessage) {
    try {
        const response = await fetch('https://gemini-chat-service-609883590836.asia-east1.run.app/gemini-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage }),
        });
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }
        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Fetch or JSON parsing error:", error);
        throw error;
    }
}


/**
 * 初始化事件監聽器。
 */
document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const userInputField = document.getElementById('user-input');

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    } else {
        console.error("CRITICAL: Send button with ID 'send-button' NOT FOUND.");
    }

    if (userInputField) {
        const initialHeight = userInputField.scrollHeight;
        userInputField.addEventListener('input', () => {
            userInputField.style.height = `${initialHeight}px`; // 先重設高度
            userInputField.style.height = `${userInputField.scrollHeight}px`; // 再設定為內容高度
        });

        userInputField.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    } else {
        console.error("CRITICAL: User input field with ID 'user-input' NOT FOUND.");
    }
});

// script.js - Restored version with working Markdown and animations

function showTypingIndicator() {
    // console.log("showTypingIndicator function CALLED");
    const aiMessageBubble = document.createElement('div');
    aiMessageBubble.className = 'message ai-message';
    aiMessageBubble.style.opacity = '1'; // 初始AI氣泡可見，用於顯示打字點

    const localDotsContainer = document.createElement('div');
    localDotsContainer.className = 'typing-indicator-dots';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        localDotsContainer.appendChild(dot);
    }

    const localTextContainer = document.createElement('div');
    localTextContainer.className = 'ai-response-text';
    localTextContainer.style.opacity = '0'; // 文字容器初始不可見
    localTextContainer.style.display = 'none'; // 文字容器初始不佔空間

    aiMessageBubble.appendChild(localDotsContainer);
    aiMessageBubble.appendChild(localTextContainer);

    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) {
        console.error("CRITICAL: Element with ID 'messages' NOT FOUND when trying to show typing indicator.");
        // 返回一個包含null的對象，以便呼叫者可以檢查
        return { aiMessageBubble: null, localDotsContainer: null, localTextContainer: null };
    }
    messagesContainer.appendChild(aiMessageBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return { aiMessageBubble, localDotsContainer, localTextContainer };
}

function displayMessage(text, className) {
    // console.log(`displayMessage called for className: "${className}".`);
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;

    if (className.includes('ai-message') && !className.includes('error-message')) { // 只對成功的 AI 訊息處理 Markdown
        // console.log("Processing AI message for Markdown conversion.");
        if (typeof marked === 'undefined') {
            console.error("Marked.js library (variable 'marked') is UNDEFINED.");
            messageElement.textContent = "[Markdown Error: marked.js not loaded] " + text;
        } else if (typeof marked.parse !== 'function' && (typeof marked.Marked !== 'function' || typeof new marked.Marked().parse !== 'function')) {
            console.error("Marked.js IS LOADED, but suitable 'parse' method is not found.");
            messageElement.textContent = "[Markdown Error: marked.parse or new marked.Marked().parse is not a function] " + text;
        } else {
            try {
                const markedOptions = {
                    gfm: true,
                    breaks: true,
                    pedantic: false,
                    smartypants: false
                };
                let rawHtml = '';
                if (typeof marked.Marked === 'function') {
                    const markdownParser = new marked.Marked(markedOptions);
                    rawHtml = markdownParser.parse(text || '');
                } else if (typeof marked.parse === 'function') {
                    rawHtml = marked.parse(text || '', markedOptions);
                } else {
                     throw new Error("Suitable marked.js parsing method not found.");
                }

                if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
                    messageElement.innerHTML = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
                } else {
                    console.warn("DOMPurify is NOT available. Applying raw HTML from marked.parse() directly (SECURITY RISK).");
                    messageElement.innerHTML = rawHtml;
                }
            } catch (error) {
                console.error("ERROR during Markdown parsing or sanitization:", error);
                messageElement.textContent = "[Markdown Processing Error] " + text;
            }
        }
    } else { // 使用者訊息或 AI 錯誤訊息，以純文字顯示
        messageElement.textContent = text;
    }

    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        console.error("CRITICAL: Element with ID 'messages' NOT FOUND in the DOM. Cannot append message.");
    }
}


function sendMessage() {
    // console.log("sendMessage function CALLED");
    const userInput = document.getElementById('user-input');
    if (!userInput) {
        console.error("CRITICAL: Element with ID 'user-input' NOT FOUND.");
        return;
    }
    const messageText = userInput.value.trim();

    if (messageText === '') {
        return;
    }

    displayMessage(messageText, 'user-message');
    userInput.value = '';

    const { aiMessageBubble, localDotsContainer, localTextContainer } = showTypingIndicator();

    if (!aiMessageBubble || !localDotsContainer || !localTextContainer) {
        console.error("Failed to create typing indicator elements. Aborting AI response.");
        // 可以選擇在這裡給使用者一個錯誤提示
        displayMessage("抱歉，發生錯誤，無法顯示 AI 回應。", "ai-message error-message");
        return;
    }

    getAIResponse(messageText)
        .then(aiResponse => {
            // console.log("sendMessage: getAIResponse successful.");
            if (aiMessageBubble && aiMessageBubble.parentNode && localDotsContainer && localTextContainer) {
                // 讓氣泡準備變透明，以配合後續的內容填充和動畫
                // 這是為了解決「先展開再動畫」的問題
                aiMessageBubble.style.transition = 'none'; // 暫時禁用 aiMessageBubble 自身的 CSS 過渡
                aiMessageBubble.style.visibility = 'hidden';
                aiMessageBubble.style.opacity = '0';

                // 強制瀏覽器處理上述樣式更改 (可選)
                // void aiMessageBubble.offsetWidth;

                localDotsContainer.style.opacity = '0'; // 讓打字點淡出
                localDotsContainer.addEventListener('transitionend', () => {
                    if (localDotsContainer.parentNode) {
                        localDotsContainer.remove(); // 淡出後移除打字點
                    }

                    // 準備AI文字內容並處理 Markdown
                    if (typeof marked === 'undefined') {
                        console.error("Marked.js not loaded, cannot parse AI response for Markdown.");
                        localTextContainer.textContent = aiResponse; // 退回純文字
                    } else {
                        try {
                            const markedOptions = { gfm: true, breaks: true, pedantic: false, smartypants: false };
                            let rawHtml = '';
                            if (typeof marked.Marked === 'function') {
                                const markdownParser = new marked.Marked(markedOptions);
                                rawHtml = markdownParser.parse(aiResponse || '');
                            } else if (typeof marked.parse === 'function') {
                                rawHtml = marked.parse(aiResponse || '', markedOptions);
                            } else {
                                throw new Error("Suitable marked.js parsing method not found for AI response.");
                            }

                            if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
                                localTextContainer.innerHTML = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
                            } else {
                                console.warn("DOMPurify not available for AI response in sendMessage. Using raw HTML.");
                                localTextContainer.innerHTML = rawHtml;
                            }
                        } catch (e) {
                            console.error("Error parsing Markdown for AI response in sendMessage:", e);
                            localTextContainer.textContent = aiResponse; // 解析失敗，退回純文字
                        }
                    }

                    localTextContainer.style.display = 'block'; // 文字容器佔據空間 (此刻aiMessageBubble仍不可見)
                    localTextContainer.style.opacity = '1';     // 文字內容本身設為可見 (但會被父氣泡的opacity:0遮擋)

                    aiMessageBubble.classList.remove('reveal-from-left');

                    requestAnimationFrame(() => {
                        // 恢復可能的 CSS 過渡
                        // aiMessageBubble.style.transition = ''; // 如果 CSS 中 .message 有 opacity/visibility 的 transition

                        aiMessageBubble.style.visibility = '';
                        aiMessageBubble.style.opacity = ''; // 清除內聯opacity，讓class接管
                        aiMessageBubble.classList.add('reveal-from-left');
                    });
                }, { once: true });
            } else {
                console.warn("Target AI message bubble for update was not found. Displaying as new message.");
                // 這種情況下，aiMessageBubble 可能已經不存在了，所以直接用 displayMessage 顯示
                displayMessage(aiResponse, 'ai-message');
            }
        })
        .catch(error => {
            console.error('Error getting AI response:', error);
            if (aiMessageBubble && aiMessageBubble.parentNode) {
                // 移除打字指示器氣泡
                aiMessageBubble.remove();
            }
            // 使用 displayMessage 顯示錯誤訊息
            displayMessage('抱歉，AI 回應時發生錯誤。', 'ai-message error-message');
        });
}

async function getAIResponse(userMessage) {
    // console.log("getAIResponse: Sending message to backend:", userMessage);
    try {
        const response = await fetch('https://gemini-chat-service-609883590836.asia-east1.run.app/gemini-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: userMessage }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from AI server' }));
            console.error("getAIResponse: Network response was not ok.", response.status, response.statusText, errorData);
            throw new Error(errorData.error || `Network response was not ok: ${response.status}`);
        }

        const data = await response.json();
        // console.log("getAIResponse: Received data from backend:", data);
        if (typeof data.response === 'undefined') {
            console.error("getAIResponse: Backend response does not contain 'response' field.", data);
            throw new Error("AI response format is incorrect.");
        }
        return data.response;
    } catch (error) {
        console.error("getAIResponse: Fetch or JSON parsing error:", error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const userInputField = document.getElementById('user-input');

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    } else {
        console.error("CRITICAL: Send button with ID 'send-button' NOT FOUND.");
    }

    if (userInputField) {
        userInputField.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    } else {
        console.error("CRITICAL: User input field with ID 'user-input' NOT FOUND.");
    }
});
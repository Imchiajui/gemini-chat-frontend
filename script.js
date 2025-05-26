// script.js - 整理後的完整版本

/**
 * 輔助函式：獲取 #chat-window 元素並捲動到底部。
 * 使用 setTimeout 將滾動操作推遲到瀏覽器下一次重繪之後，
 * 以確保 scrollHeight 是最新的。
 */
function getChatWindowAndScrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
        setTimeout(() => {
            chatWindow.scrollTop = chatWindow.scrollHeight;
            // console.log(`[DEBUG] Scrolled chatWindow.scrollTop to ${chatWindow.scrollTop} (scrollHeight: ${chatWindow.scrollHeight})`);
        }, 0); // 0ms 延遲通常已足夠
    } else {
        console.error("CRITICAL: Element with ID 'chat-window' NOT FOUND. Cannot scroll.");
    }
}

/**
 * 顯示 AI 輸入中的打字指示器。
 * @returns {object} 包含對創建的 DOM 元素的引用 (aiMessageBubble, localDotsContainer, localTextContainer)
 * 或在發生錯誤時返回包含 null 的對象。
 */
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
        return { aiMessageBubble: null, localDotsContainer: null, localTextContainer: null };
    }
    messagesContainer.appendChild(aiMessageBubble);
    
    getChatWindowAndScrollToBottom(); // 打字指示器出現時滾動

    return { aiMessageBubble, localDotsContainer, localTextContainer };
}

/**
 * 在聊天視窗中顯示一條訊息 (使用者或 AI)。
 * 如果是 AI 訊息且非錯誤訊息，會嘗試進行 Markdown 解析和清理。
 * @param {string} text - 要顯示的訊息文字或 Markdown 內容。
 * @param {string} className - 應應用於訊息元素的 CSS class (例如 'user-message', 'ai-message', 'ai-message error-message')。
 */
function displayMessage(text, className) {
    // console.log(`displayMessage called for className: "${className}".`);
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    const responseText = text || ''; // 確保 text 不是 null/undefined

    if (className.includes('ai-message') && !className.includes('error-message')) {
        // 處理 AI 成功回應的 Markdown
        if (typeof marked === 'undefined') {
            console.error("Marked.js library (variable 'marked') is UNDEFINED. Displaying AI response as plain text.");
            messageElement.textContent = "[Markdown Error: marked.js not loaded] " + responseText;
        } else if (typeof marked.parse !== 'function' && (typeof marked.Marked !== 'function' || (typeof marked.Marked === 'function' && typeof new marked.Marked().parse !== 'function'))) {
            console.error("Marked.js IS LOADED, but suitable 'parse' method is not found. Displaying AI response as plain text.");
            messageElement.textContent = "[Markdown Error: marked.parse or new marked.Marked().parse is not a function] " + responseText;
        } else {
            try {
                const markedOptions = { gfm: true, breaks: true, pedantic: false, smartypants: false };
                let rawHtml = '';
                if (typeof marked.Marked === 'function') { // 適用於 marked v4.x+
                    const markdownParser = new marked.Marked(markedOptions);
                    rawHtml = markdownParser.parse(responseText);
                } else if (typeof marked.parse === 'function') { // 適用於舊版 marked 或某些配置
                    rawHtml = marked.parse(responseText, markedOptions);
                } else {
                     throw new Error("Suitable marked.js parsing method not found."); // 理論上不會執行到此
                }

                if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
                    messageElement.innerHTML = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
                } else {
                    console.warn("DOMPurify is NOT available. Applying raw HTML from marked.parse() directly (SECURITY RISK).");
                    messageElement.innerHTML = rawHtml;
                }
            } catch (error) {
                console.error("ERROR during Markdown parsing or sanitization in displayMessage:", error);
                messageElement.textContent = "[Markdown Processing Error] " + responseText;
            }
        }
    } else {
        // 使用者訊息或 AI 錯誤訊息，直接以純文字顯示
        messageElement.textContent = responseText;
    }

    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.appendChild(messageElement);
        getChatWindowAndScrollToBottom(); // 新訊息加入後滾動
    } else {
        console.error("CRITICAL: Element with ID 'messages' NOT FOUND in the DOM. Cannot append message.");
    }
}

/**
 * 處理使用者輸入、獲取 AI 回應並在介面上顯示。
 */
function sendMessage() {
    // console.log("sendMessage function CALLED");
    const userInput = document.getElementById('user-input');
    if (!userInput) {
        console.error("CRITICAL: Element with ID 'user-input' NOT FOUND.");
        return;
    }
    const messageText = userInput.value.trim();
    if (messageText === '') { return; }

    displayMessage(messageText, 'user-message'); // 顯示使用者訊息並滾動
    userInput.value = '';

    const { aiMessageBubble, localDotsContainer, localTextContainer } = showTypingIndicator(); // 顯示打字指示器並滾動

    if (!aiMessageBubble || !localDotsContainer || !localTextContainer) {
        console.error("Failed to create typing indicator elements in sendMessage. Aborting AI response.");
        displayMessage("抱歉，發生介面錯誤，無法顯示 AI 回應。", "ai-message error-message"); // 顯示錯誤訊息並滾動
        return;
    }

    getAIResponse(messageText)
        .then(aiResponse => {
            const responseText = aiResponse || ''; // 確保 aiResponse 不是 null/undefined

            if (aiMessageBubble && aiMessageBubble.parentNode && localDotsContainer && localTextContainer) {
                // 準備動畫：先隱藏氣泡，避免在內容填充時閃爍或跳動
                aiMessageBubble.style.transition = 'none'; // 確保樣式更改立即生效
                aiMessageBubble.style.visibility = 'hidden';
                aiMessageBubble.style.opacity = '0';

                localDotsContainer.style.opacity = '0'; // 讓打字點淡出
                localDotsContainer.addEventListener('transitionend', () => {
                    if (localDotsContainer.parentNode) {
                        localDotsContainer.remove(); // 淡出後移除打字點
                    }

                    // 處理 Markdown 並設定 AI 回應內容
                    let processedHtml = '';
                    if (typeof marked === 'undefined') {
                        console.error("Marked.js library (variable 'marked') is UNDEFINED. Displaying AI response as plain text.");
                        const tempDiv = document.createElement('div'); tempDiv.textContent = responseText; processedHtml = tempDiv.innerHTML;
                    } else if (typeof marked.parse !== 'function' && (typeof marked.Marked !== 'function' || (typeof marked.Marked === 'function' && typeof new marked.Marked().parse !== 'function'))) {
                        console.error("Marked.js IS LOADED, but suitable 'parse' method is not found. Displaying AI response as plain text.");
                        const tempDiv = document.createElement('div'); tempDiv.textContent = responseText; processedHtml = tempDiv.innerHTML;
                    } else {
                        try {
                            const markedOptions = { gfm: true, breaks: true, pedantic: false, smartypants: false };
                            let rawHtml = '';
                            if (typeof marked.Marked === 'function') {
                                const markdownParser = new marked.Marked(markedOptions);
                                rawHtml = markdownParser.parse(responseText);
                            } else if (typeof marked.parse === 'function') {
                                rawHtml = marked.parse(responseText, markedOptions);
                            } else {
                                 throw new Error("Suitable marked.js parsing method not found for AI response in sendMessage.");
                            }

                            if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
                                processedHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
                            } else {
                                console.warn("DOMPurify is NOT available for AI response in sendMessage. Using raw HTML (SECURITY RISK).");
                                processedHtml = rawHtml;
                            }
                        } catch (e) {
                            console.error("Error parsing Markdown for AI response in sendMessage:", e);
                            const tempDiv = document.createElement('div'); tempDiv.textContent = responseText; processedHtml = tempDiv.innerHTML;
                        }
                    }
                    localTextContainer.innerHTML = processedHtml; // 使用 innerHTML 渲染 Markdown
                    // --- Markdown 處理結束 ---

                    localTextContainer.style.display = 'block'; // 讓文字容器佔據空間
                    localTextContainer.style.opacity = '1';     // 讓文字內容本身不透明

                    aiMessageBubble.classList.remove('reveal-from-left'); // 清理可能存在的舊動畫 class

                    // 使用 requestAnimationFrame 確保在下一幀進行動畫準備和啟動
                    requestAnimationFrame(() => {
                        // aiMessageBubble.style.transition = ''; // 如果CSS中有針對opacity/visibility的過渡，這裡可以恢復

                        aiMessageBubble.style.visibility = ''; // 恢復可見性
                        aiMessageBubble.style.opacity = '';    // 清除內聯 opacity，讓動畫 class 控制
                        aiMessageBubble.classList.add('reveal-from-left'); // 啟動登場動畫
                        
                        getChatWindowAndScrollToBottom(); // 動畫開始時滾動一次

                        aiMessageBubble.addEventListener('animationend', () => {
                            getChatWindowAndScrollToBottom(); // 動畫結束時再次滾動，確保最終位置
                        }, { once: true });

                        // 額外的延遲滾動，作為保險
                        setTimeout(getChatWindowAndScrollToBottom, 100);
                        setTimeout(getChatWindowAndScrollToBottom, 650); // 略長於 0.6s 的動畫時間
                    });
                }, { once: true }); // transitionend 事件監聽器只觸發一次
            } else {
                // 如果 aiMessageBubble 或相關元素在異步回調執行前已不存在
                console.warn("Target AI message bubble for update was not found or related elements are missing. Displaying AI response as a new message.");
                displayMessage(responseText, 'ai-message'); // 使用 displayMessage 創建新氣泡並滾動
            }
        })
        .catch(error => {
            console.error('Error getting AI response in sendMessage promise chain:', error);
            if (aiMessageBubble && aiMessageBubble.parentNode) {
                aiMessageBubble.remove(); // 出錯時移除打字指示器氣泡
            }
            displayMessage('抱歉，AI 回應時發生錯誤。', 'ai-message error-message'); // 顯示錯誤訊息並滾動
        });
}

/**
 * 從後端獲取 AI 的回應。
 * @param {string} userMessage - 使用者發送的訊息。
 * @returns {Promise<string>} - 一個解析為 AI 回應字串的 Promise。
 */
async function getAIResponse(userMessage) {
    // console.log("getAIResponse: Sending message to backend:", userMessage);
    try {
        // 注意：URL 已從您提供的 script.js 中更新
        const response = await fetch('https://gemini-chat-service-609883590836.asia-east1.run.app/gemini-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage }),
        });
        if (!response.ok) {
            let errorData = { error: `Network response was not ok: ${response.status}`}; // 預設錯誤
            try {
                errorData = await response.json(); // 嘗試解析 JSON 錯誤訊息
            } catch (e) {
                console.warn("Failed to parse JSON error response from AI server.", e);
                // 如果解析失敗，errorData 會保留預設值
            }
            console.error("getAIResponse: Network response was not ok.", response.status, response.statusText, errorData);
            throw new Error(errorData.error || `Network response was not ok: ${response.status}`);
        }
        const data = await response.json();
        if (typeof data.response === 'undefined') {
            console.error("getAIResponse: Backend response does not contain 'response' field.", data);
            throw new Error("AI response format is incorrect (missing 'response' field).");
        }
        return data.response;
    } catch (error) {
        console.error("getAIResponse: Fetch or JSON parsing error:", error);
        throw error; // 重新拋出錯誤，由 sendMessage 的 .catch() 處理
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
        userInputField.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    } else {
        console.error("CRITICAL: User input field with ID 'user-input' NOT FOUND.");
    }
});

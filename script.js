// script.js - 調整滾動速度和時機

// 全局變數，用於追蹤當前的滾動動畫 ID
let currentScrollAnimationId = null;

/**
 * 平滑滾動元素到指定的 scrollTop 位置。
 * @param {HTMLElement} element - 要滾動的 HTML 元素。
 * @param {number} to - 目標 scrollTop 值。
 * @param {number} duration - 動畫持續時間 (毫秒)。 更大的值意味著更慢的滾動。
 */
function smoothScrollTo(element, to, duration = 800) { // <-- 調整預設 duration 為 800ms (原為 400ms)
    if (!element) return;

    const start = element.scrollTop;
    const change = to - start;
    let startTime = null;

    const easeOutQuart = t => 1 - Math.pow(1 - t, 4); // Ease-out Quartic 缓動函數

    if (currentScrollAnimationId) {
        cancelAnimationFrame(currentScrollAnimationId);
    }

    function animateScroll(currentTime) {
        if (startTime === null) {
            startTime = currentTime;
        }
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);

        element.scrollTop = start + change * easedProgress;

        if (timeElapsed < duration) {
            currentScrollAnimationId = requestAnimationFrame(animateScroll);
        } else {
            element.scrollTop = to; // 確保精確到達目標位置
            currentScrollAnimationId = null;
        }
    }

    currentScrollAnimationId = requestAnimationFrame(animateScroll);
}
/**
 * 輔助函式：獲取 #chat-window 元素並平滑捲動到底部。
 * 使用 setTimeout 將滾動操作推遲到瀏覽器下一次重繪之後，
 * 以確保 scrollHeight 是最新的。
 */
function getChatWindowAndScrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
        setTimeout(() => {
            // 使用我們自訂的平滑滾動函式，並可以傳遞自訂的 duration
            smoothScrollTo(chatWindow, chatWindow.scrollHeight, 800); // <-- 此處的 duration 應與 smoothScrollTo 預設值一致或按需調整
            // console.log(`[DEBUG] Initiated smooth scroll for chatWindow to ${chatWindow.scrollHeight} with duration 800ms`);
        }, 0);
    } else {
        console.error("CRITICAL: Element with ID 'chat-window' NOT FOUND. Cannot scroll.");
    }
}
// ----------------------------------------------------------------------------------
// 以下的 showTypingIndicator, displayMessage, sendMessage, getAIResponse,
// 和 DOMContentLoaded 事件監聽器函數保持與您「整理過的完整Javascript」版本一致。
// 確保在這些函數中呼叫 getChatWindowAndScrollToBottom() 的地方仍然存在。
// ----------------------------------------------------------------------------------

/**
 * 顯示 AI 輸入中的打字指示器。
 */
function showTypingIndicator() {
    // console.log("showTypingIndicator function CALLED");
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
    
    getChatWindowAndScrollToBottom(); // 打字指示器出現時滾動

    return { aiMessageBubble, localDotsContainer, localTextContainer };
}

/**
 * 在聊天視窗中顯示一條訊息 (使用者或 AI)。
 */
function displayMessage(text, className) {
    // console.log(`displayMessage called for className: "${className}".`);
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    const responseText = text || '';

    if (className.includes('ai-message') && !className.includes('error-message')) {
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
                if (typeof marked.Marked === 'function') {
                    const markdownParser = new marked.Marked(markedOptions);
                    rawHtml = markdownParser.parse(responseText);
                } else if (typeof marked.parse === 'function') {
                    rawHtml = marked.parse(responseText, markedOptions);
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
                console.error("ERROR during Markdown parsing or sanitization in displayMessage:", error);
                messageElement.textContent = "[Markdown Processing Error] " + responseText;
            }
        }
    } else {
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
    const userInput = document.getElementById('user-input');
    if (!userInput) {
        console.error("CRITICAL: Element with ID 'user-input' NOT FOUND.");
        return;
    }
    const messageText = userInput.value.trim();
    if (messageText === '') { return; }

    displayMessage(messageText, 'user-message');
    userInput.value = '';

    const { aiMessageBubble, localDotsContainer, localTextContainer } = showTypingIndicator();

    if (!aiMessageBubble || !localDotsContainer || !localTextContainer) {
        console.error("Failed to create typing indicator elements in sendMessage. Aborting AI response.");
        displayMessage("抱歉，發生介面錯誤，無法顯示 AI 回應。", "ai-message error-message");
        return;
    }

    getAIResponse(messageText)
        .then(aiResponse => {
            const responseText = aiResponse || ''; 

            if (aiMessageBubble && aiMessageBubble.parentNode && localDotsContainer && localTextContainer) {
                aiMessageBubble.style.transition = 'none'; 
                aiMessageBubble.style.visibility = 'hidden';
                aiMessageBubble.style.opacity = '0';

                localDotsContainer.style.opacity = '0'; 
                localDotsContainer.addEventListener('transitionend', () => {
                    if (localDotsContainer.parentNode) {
                        localDotsContainer.remove(); 
                    }

                    let processedHtml = '';
                    // ... (Markdown 處理邏輯，與之前版本相同，此處省略以保持簡潔) ...
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
                    localTextContainer.innerHTML = processedHtml; 
                    // --- Markdown 處理結束 ---

                    localTextContainer.style.display = 'block'; 
                    localTextContainer.style.opacity = '1';     

                    aiMessageBubble.classList.remove('reveal-from-left'); 

                    requestAnimationFrame(() => {
                        aiMessageBubble.style.visibility = ''; 
                        aiMessageBubble.style.opacity = '';    
                        aiMessageBubble.classList.add('reveal-from-left'); 
                        
                        // ***** 移除動畫開始時的滾動 *****
                        // getChatWindowAndScrollToBottom(); 

                        aiMessageBubble.addEventListener('animationend', () => {
                            // ***** 只在 AI 訊息動畫完全結束後才滾動 *****
                            getChatWindowAndScrollToBottom();
                        }, { once: true });

                        // ***** 移除額外的 setTimeout 滾動 *****
                        // setTimeout(getChatWindowAndScrollToBottom, 100);
                        // setTimeout(getChatWindowAndScrollToBottom, 650); 
                    });
                }, { once: true }); 
            } else {
                console.warn("Target AI message bubble for update was not found or related elements are missing. Displaying AI response as a new message.");
                displayMessage(responseText, 'ai-message'); 
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
    // console.log("getAIResponse: Sending message to backend:", userMessage);
    try {
        const response = await fetch('https://gemini-chat-service-609883590836.asia-east1.run.app/gemini-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage }),
        });
        if (!response.ok) {
            let errorData = { error: `Network response was not ok: ${response.status}`};
            try {
                errorData = await response.json(); 
            } catch (e) {
                console.warn("Failed to parse JSON error response from AI server.", e);
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
        userInputField.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    } else {
        console.error("CRITICAL: User input field with ID 'user-input' NOT FOUND.");
    }
});

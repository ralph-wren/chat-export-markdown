# Privacy Policy for Memoraid

**Effective Date:** January 5, 2026

**Memoraid** ("we", "us", or "our") respects your privacy. This Privacy Policy describes how we handle your data when you use our Chrome Extension.

## 1. Single Purpose

The **single purpose** of Memoraid is to help users **summarize and export AI chat conversations** (from platforms like ChatGPT and Gemini) into Markdown format. All features and permissions are directly related to this core functionality.

## 2. Data Collection and Usage

**We do not collect, store, or transmit any of your personal data to our own servers.**

*   **Chat Content**: The extension extracts chat content from the active tab (ChatGPT or Gemini) **only when you explicitly click the "Summarize & Export" button**. This content is processed locally in your browser and sent directly to the AI Provider you have configured (e.g., OpenAI, DeepSeek, Yi) to generate a summary.
*   **API Keys**: Your API keys are stored **locally** in your browser's storage (`chrome.storage.local`). We do not have access to your API keys.
*   **History**: The summaries generated are stored **locally** in your browser's storage (`chrome.storage.local`) for your convenience. You can clear this history at any time within the extension.

## 3. Third-Party Services and Remote Code

This extension interacts with third-party AI providers (such as OpenAI, DeepSeek, Yi/01.AI) based on your configuration.

*   **Remote Code**: The extension does **not** execute arbitrary remote code. It uses the standard OpenAI SDK to communicate with the AI API endpoints. The logic for this communication is bundled within the extension itself.
*   **Data Transmission**: When you use the summarization feature, the extracted chat text is sent to the API endpoint you configured. Please refer to the privacy policy of the specific AI provider you are using for information on how they handle data sent to their API.

## 4. Permissions Justification

The extension requests the following permissions for specific purposes required by its core functionality:

*   **`activeTab`**:
    *   **Reason**: To access the content of the current chat page (e.g., chatgpt.com or gemini.google.com) *only when* the user clicks the extension icon or the "Summarize" button.
    *   **Usage**: Used to identify the active tab and inject the content extraction script.
*   **`scripting`**:
    *   **Reason**: To programmatically execute the content extraction script on the active chat page.
    *   **Usage**: Used to parse the DOM of the chat interface and retrieve the conversation text for summarization.
*   **`storage`**:
    *   **Reason**: To save user preferences and local data.
    *   **Usage**: Used to store your API Settings (Key, Model, Base URL) and the local history of generated summaries.
*   **`notifications`**:
    *   **Reason**: To provide system-level feedback for long-running background tasks.
    *   **Usage**: Used to notify you when a background summarization task is successfully completed or if an error occurs, ensuring you don't miss the result even if the popup is closed.
*   **`host_permissions` (http://*/*, https://*/*)**:
    *   **Reason**: To allow the extension to communicate with *any* AI API provider the user configures.
    *   **Usage**: Users can configure custom API endpoints (e.g., a local LLM running on localhost, or an enterprise API proxy). This permission is strictly used to send the chat content to the user-defined API URL for summarization.

## 5. Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by updating the date at the top of this policy.

## 5. Contact Us

If you have any questions about this Privacy Policy, please contact us via the Chrome Web Store support page.

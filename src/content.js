/*global chrome*/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "copy_all_cookie") {
        sendResponse({status: true});
        return false;
    }

    const cookies = message.data?.cookies || [];
    const dataCookie = JSON.stringify(cookies, null, 2);

    navigator.clipboard.writeText(dataCookie)
        .then(() => {
            sendResponse({status: true});
        })
        .catch((error) => {
            console.error("Failed to copy cookies:", error);
            sendResponse({status: false, error: error?.message || String(error)});
        });

    return true;
});

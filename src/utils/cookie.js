/*global chrome*/
import {googleAnalytics} from "./google_analytics";
import {extension} from "./chrome";
import {settingStore} from "../mobx/setting.store";
import {formatCookies} from "./cookie_format";
import {getCookieUrl} from "./url";

export const copyCookie = (cookies, format = null) => {
    let type = format;
    if (format === null) {
        const dataFormatCopyCookie = localStorage.getItem("format_copy");
        type = typeof dataFormatCopyCookie === "string" ? dataFormatCopyCookie : "header_string"
    }

    const dataCookie = formatCookies(cookies, type);

    navigator.clipboard.writeText(dataCookie)
        .then(() => {
            googleAnalytics({name: "copy_all_cookie", params: []})
            settingStore.alert = {type: "info", message: extension.getLang("alert_copy_cookie_success")}
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
        });
}

export const clearCookie = async (cookies) => {
    const [tabCurrent] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    for (let i = 0; i < cookies.length; i++) {
        await chrome.cookies.remove({
            url: getCookieUrl(cookies[i], tabCurrent?.url),
            name: cookies[i].name,
            storeId: cookies[i].storeId
        })
    }

    googleAnalytics({name: "clear_cookie", params: []})
    document.dispatchEvent(new CustomEvent("update_cookie", {
        detail: {action: "clear"},
        bubbles: true,
    }));
}

export const deleteCookie = async (cookie) => {
    const [tabCurrent] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    await chrome.cookies.remove({
        url: getCookieUrl(cookie, tabCurrent?.url),
        name: cookie.name,
        storeId: cookie.storeId
    });

    document.dispatchEvent(new CustomEvent("update_cookie", {
        detail: {action: "delete"},
        bubbles: true,
    }));
    settingStore.alert = {type: "info", message: extension.getLang("alert_delete_cookie_success")}
    googleAnalytics({name: "delete_cookie", params: []})
}

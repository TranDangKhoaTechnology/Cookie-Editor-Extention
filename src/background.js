/*global chrome*/
import {inExtensionPath, inExtensionUrl} from "./utils/extension_path";
import {OWNER_WEBSITE_URL, WEBSITE_URL} from "./config";

const COOKIE_LINK_URL = `${WEBSITE_URL}/cookie/link/`;

const isHttpUrl = (url) => typeof url === "string" && /^https?:\/\//i.test(url);

const getCookieUrl = (cookie = {}, fallbackUrl = "") => {
    try {
        const fallback = new URL(fallbackUrl);
        const domain = String(cookie.domain || fallback.hostname)
            .replace(/^#HttpOnly_/i, "")
            .replace(/^\./, "");
        const path = String(cookie.path || fallback.pathname || "/");

        return `${fallback.protocol}//${domain}${path.startsWith("/") ? path : `/${path}`}`;
    } catch {
        const domain = String(cookie.domain || "")
            .replace(/^#HttpOnly_/i, "")
            .replace(/^\./, "");

        return domain ? `${cookie.secure ? "https:" : "http:"}//${domain}${cookie.path || "/"}` : "";
    }
};

const contextMenuItems = [
    {
        id: "remove_cookie",
        titleKey: "btn_remove",
        fallbackTitle: "Remove cookies",
    },
    {
        id: "copy_cookie",
        titleKey: "btn_copy",
        fallbackTitle: "Copy cookies",
    },
];

let contextMenuListenerRegistered = false;

const getMessage = (key, fallback) => chrome.i18n.getMessage(key) || fallback;

const hasContextMenuPermission = () => new Promise((resolve) => {
    chrome.permissions.contains({permissions: ["contextMenus"]}, resolve);
});

const removeAllContextMenus = () => new Promise((resolve) => {
    chrome.contextMenus.removeAll(resolve);
});

const syncContextMenus = async (enabled = true) => {
    if (!chrome.contextMenus) {
        return;
    }

    registerContextMenuClickListener();
    await removeAllContextMenus();
    const hasPermission = await hasContextMenuPermission();
    if (!enabled || !hasPermission) {
        return;
    }

    for (const item of contextMenuItems) {
        chrome.contextMenus.create({
            id: item.id,
            title: getMessage(item.titleKey, item.fallbackTitle),
            contexts: ["all"],
        });
    }
};

const registerContextMenuClickListener = () => {
    if (!chrome.contextMenus || contextMenuListenerRegistered) {
        return;
    }

    chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
    contextMenuListenerRegistered = true;
};

if (chrome.sidePanel) {
    chrome.sidePanel
        .setPanelBehavior({openPanelOnActionClick: true})
        .catch((error) => console.error(error));
}

chrome.action.onClicked.addListener(async (tab) => {
    if (!chrome.sidePanel || !tab?.id) {
        return;
    }

    try {
        await chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: inExtensionPath("pages/sidepanel.html"),
            enabled: true,
        });
        await chrome.sidePanel.open({tabId: tab.id});
    } catch (error) {
        console.error(error);
    }
});

chrome.runtime.onInstalled.addListener((details) => {
    syncContextMenus().catch(console.error);

    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        // No tab opening on install, and clear any uninstall URL
        chrome.runtime.setUninstallURL('');
    }
});

chrome.runtime.onStartup?.addListener(() => {
    syncContextMenus().catch(console.error);
});

chrome.permissions.onAdded?.addListener((permissions) => {
    if (permissions.permissions?.includes("contextMenus")) {
        syncContextMenus(true).catch(console.error);
    }
});

chrome.permissions.onRemoved?.addListener((permissions) => {
    if (permissions.permissions?.includes("contextMenus")) {
        syncContextMenus(false).catch(console.error);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (typeof tab?.url === "string" && tab.url.startsWith(COOKIE_LINK_URL)) {
        chrome.tabs.update(tabId, {
            url: tab.url.replace(
                COOKIE_LINK_URL,
                `${inExtensionUrl("pages/import.html")}?cookie_id=`
            ),
        });
    }
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "check_install":
            sendResponse({status: true});
            break;

        default:
            sendResponse({status: true});
            break;
    }

    return true;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "google_analytics":
            sendGoogleAnalytics(request.data, sendResponse).catch((error) => {
                console.error(error);
                sendResponse({status: false});
            });
            return true;

        case "sync_context_menus":
            syncContextMenus(request.enabled).then(() => {
                sendResponse({status: true});
            }).catch((error) => {
                console.error(error);
                sendResponse({status: false});
            });
            return true;

        default:
            sendResponse({status: true});
            break;
    }
});

const handleContextMenuClick = async (info, tab) => {
    if (!isHttpUrl(tab?.url)) {
        return;
    }

    const cookies = await chrome.cookies.getAll({url: tab.url});
    switch (info.menuItemId) {
        case "remove_cookie":
            for (const cookie of cookies) {
                await chrome.cookies.remove({
                    url: getCookieUrl(cookie, tab.url),
                    name: cookie.name,
                    storeId: cookie.storeId,
                });
            }
            break;

        case "copy_cookie":
            chrome.tabs.sendMessage(tab.id, {action: "copy_all_cookie", data: {cookies}});
            break;
    }
};

registerContextMenuClickListener();

const sendGoogleAnalytics = async (data, callback) => {
    const {en, ep = [], tid, cid, v, t, ul, sr} = data;

    const raw = [
        `en=${en}`,
        ...ep.map((item) => `ep.${item.key}=${item.value}`),
    ].join("&");

    const params = {
        tid: String(tid),
        cid: String(cid),
        seg: "1",
        ...(v && {v: String(v)}),
        ...(t && {t: String(t)}),
        ...(ul && {ul: String(ul)}),
        ...(sr && {sr: String(sr)}),
    };

    const url = "https://www.google-analytics.com/g/collect?" + new URLSearchParams(params);

    await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "text/plain"},
        body: raw,
        redirect: "follow",
    });

    callback({status: true});
};

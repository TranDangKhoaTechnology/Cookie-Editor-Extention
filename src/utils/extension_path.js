/*global chrome*/

const normalizePath = (path = "") => String(path).replace(/^\/+/, "");

const getExtensionBasePath = () => {
    try {
        const sidePanelPath = chrome.runtime.getManifest()?.side_panel?.default_path || "";
        return sidePanelPath.startsWith("dist/") ? "dist/" : "";
    } catch {
        return "";
    }
};

const inExtensionPath = (path = "") => `${getExtensionBasePath()}${normalizePath(path)}`;

const inExtensionUrl = (path = "") => chrome.runtime.getURL(inExtensionPath(path));

export {
    inExtensionPath,
    inExtensionUrl,
};

/*global chrome*/
import CryptoJS from "crypto-js";
import {useEffect, useRef, useState} from "react";
import { motion } from "framer-motion";
import ModalPopup from "../modal_popup";
import {googleAnalytics} from "../../../../../utils/google_analytics";
import {extension} from "../../../../../utils/chrome";
import {observer} from "mobx-react-lite";
import {settingStore} from "../../../../../mobx/setting.store";
import {useClickOutside} from "../../../../../hooks/useClickOutside";
import {buildCookieSetDetails} from "../../../../../utils/cookie_details";
import {
    parseHeaderCookies,
    parseJsonCookies,
    parseNetscapeCookies,
    parseSetCookieCookies,
    looksLikeNetscapeCookies
} from "../../../../../utils/cookie_import";
import {getCookieUrl, isHttpUrl} from "../../../../../utils/url";

const ImportCookie = ({tab}) => {
    const ref = useRef(null);
    const importDebugRef = useRef(null);
    useClickOutside(ref, () => settingStore.popup = "");

    const format = settingStore.format_import;
    const optionImport = settingStore.option_import;

    const [password, setPassword] = useState("");
    const [url, setUrl] = useState("");
    const [linkImport, setLinkImport] = useState("");
    const [cookies, setCookies] = useState("");
    const [contentImport, setContentImport] = useState("");

    const listFormats = [
        {title: "Use text", id: "import_from_text", value: "text"},
        {title: "Use a file", id: "import_from_file", value: "file"},
        // {title: "Use a link", id: "import_from_url", value: "link"}
    ];
    const optionalCookieNames = new Set(["dpr", "wd", "presence"]);
    const facebookLoginCookieNames = new Set(["c_user", "xs"]);
    const facebookCookieNames = new Set([
        "c_user",
        "xs",
        "fr",
        "sb",
        "datr",
        "dpr",
        "wd",
        "presence",
        "locale",
        "ps_l",
        "ps_n",
        "spin",
    ]);

    const getImportErrorMessage = (error) => {
        const fallback = extension.getLang("alert_import_cookie_error");
        const detail = error?.message || "";
        return detail ? `${fallback}: ${detail.slice(0, 120)}` : fallback;
    };

    const getNestedCookieName = (value) => {
        const match = String(value ?? "").match(/^([A-Za-z_][A-Za-z0-9_-]*)=/);
        return match ? match[1] : "";
    };

    const summarizeCookie = (cookie = {}) => ({
        name: cookie.name,
        domain: cookie.domain,
        hostOnly: cookie.hostOnly,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        session: cookie.session,
        storeId: cookie.storeId,
        valueLength: String(cookie.value ?? "").length,
        nestedValueName: getNestedCookieName(cookie.value),
    });

    const summarizeCookieSetDetails = (details = {}) => {
        let urlHost = "";
        try {
            urlHost = new URL(details.url).hostname;
        } catch {
            urlHost = "";
        }

        return {
            urlHost,
            name: details.name,
            domain: details.domain,
            path: details.path,
            secure: details.secure,
            httpOnly: details.httpOnly,
            sameSite: details.sameSite,
            storeId: details.storeId,
            valueLength: String(details.value ?? "").length,
            nestedValueName: getNestedCookieName(details.value),
        };
    };

    const getSafeError = (error) => ({
        name: error?.name,
        message: error?.message || String(error),
    });

    const startImportDebug = (targetUrl, rawContent) => {
        importDebugRef.current = {
            startedAt: new Date().toISOString(),
            extensionVersion: chrome.runtime.getManifest().version,
            targetUrl,
            targetTabId: tab?.id,
            rawLength: String(rawContent || "").length,
            events: [],
        };
    };

    const addImportDebug = (step, data = {}) => {
        const entry = {
            time: new Date().toISOString(),
            step,
            ...data,
        };

        if (importDebugRef.current) {
            importDebugRef.current.events.push(entry);
        }

        console.info("[Cookie Editor import]", step, data);
    };

    const finishImportDebug = async (status, error) => {
        const debugLog = {
            ...(importDebugRef.current || {}),
            status,
            finishedAt: new Date().toISOString(),
            error: error ? getSafeError(error) : undefined,
        };
        const text = JSON.stringify(debugLog, null, 2);

        try {
            localStorage.setItem("cookie_editor_last_import_debug", text);
        } catch (storageError) {
            console.warn("[Cookie Editor import] Unable to save debug log:", storageError);
        }

        try {
            await navigator.clipboard.writeText(text);
            console.info("[Cookie Editor import] Debug log copied to clipboard");
        } catch (clipboardError) {
            console.warn("[Cookie Editor import] Unable to copy debug log:", clipboardError);
        }

        return debugLog;
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            let dataContent = e.target.result;
            setContentImport(String(dataContent))
        };

        reader.readAsText(file);
    };

    const getImportContent = async () => {
        switch (format) {
            case "text":
                return String(cookies || "");

            case "file":
                return String(contentImport || "");

            case "link": {
                const res = await fetch(linkImport);
                if (!res.ok) {
                    throw new Error(`Import link returned ${res.status}`);
                }

                return res.text();
            }

            default:
                return "";
        }
    }

    const decryptContent = (content) => {
        if (password.length === 0) {
            return content;
        }

        const decrypted = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
            throw new Error("Unable to decrypt import content");
        }

        try {
            const parsed = JSON.parse(decrypted);
            return typeof parsed === "string" ? parsed : JSON.stringify(parsed);
        } catch {
            return decrypted;
        }
    }

    const parseImportContent = (content) => {
        const dataCookies = String(content || "").trim();
        if (!dataCookies) {
            return [];
        }

        try {
            const jsonCookies = parseJsonCookies(dataCookies);
            if (jsonCookies.length > 0) {
                return jsonCookies;
            }
        } catch {
            // Continue with text based formats.
        }

        if (looksLikeNetscapeCookies(dataCookies)) {
            return parseNetscapeCookies(dataCookies);
        }

        const setCookieCookies = parseSetCookieCookies(dataCookies);
        if (setCookieCookies.length > 0) {
            return setCookieCookies;
        }

        return parseHeaderCookies(dataCookies).map((cookie) => ({
            ...cookie,
            expirationDate: Math.round(Date.now() / 1000) + 365 * 86400,
            secure: cookie.name.startsWith("__Secure-") || cookie.name.startsWith("__Host-"),
        }));
    }

    const getBaseDomain = (targetUrl) => {
        try {
            const hostname = new URL(targetUrl).hostname;
            const parts = hostname.split(".").filter(Boolean);
            if (parts.length <= 2) {
                return hostname;
            }

            return parts.slice(-2).join(".");
        } catch {
            return "";
        }
    }

    const getHostname = (targetUrl) => {
        try {
            return new URL(targetUrl).hostname;
        } catch {
            return "";
        }
    }

    const normalizeCookieDomain = (domain) => String(domain || "")
        .replace(/^#HttpOnly_/i, "")
        .replace(/^\./, "")
        .toLowerCase();

    const isFacebookTargetUrl = (targetUrl) => {
        const hostname = getHostname(targetUrl).replace(/^www\./i, "");
        return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    }

    const isFacebookCookieDomain = (cookie) => {
        const domain = normalizeCookieDomain(cookie?.domain);
        return domain === "facebook.com" || domain.endsWith(".facebook.com");
    }

    const getCookieNameSet = (cookieArray) => new Set(
        cookieArray
            .map((cookie) => String(cookie?.name || "").toLowerCase())
            .filter(Boolean)
    );

    const shouldClearSiteBeforeImport = (cookieArray) => {
        const names = getCookieNameSet(cookieArray);
        return Array.from(names).some((name) => !optionalCookieNames.has(name));
    }

    const validateImportCookieArray = (cookieArray) => {
        if (!isFacebookTargetUrl(url)) {
            return;
        }

        const names = getCookieNameSet(cookieArray);
        const hasFacebookCookie = Array.from(names).some((name) => facebookCookieNames.has(name));
        if (!hasFacebookCookie) {
            return;
        }

        const missingLoginCookies = Array.from(facebookLoginCookieNames)
            .filter((name) => !names.has(name));

        if (missingLoginCookies.length > 0) {
            throw new Error(`Facebook cookie is missing ${missingLoginCookies.join(", ")}. A full login cookie must include c_user and xs to switch accounts.`);
        }
    }

    const hasFacebookLoginIntent = (cookieArray) => {
        if (!isFacebookTargetUrl(url)) {
            return false;
        }

        const names = getCookieNameSet(cookieArray);
        return Array.from(names).some((name) => facebookCookieNames.has(name));
    }

    const setChromeCookie = (details) => new Promise((resolve, reject) => {
        try {
            chrome.cookies.set(details, (cookie) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(new Error(error.message));
                    return;
                }

                resolve(cookie);
            });
        } catch (error) {
            reject(error);
        }
    });

    const removeChromeCookie = (details) => new Promise((resolve, reject) => {
        try {
            chrome.cookies.remove(details, (removedCookie) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(new Error(error.message));
                    return;
                }

                resolve(removedCookie);
            });
        } catch (error) {
            reject(error);
        }
    });

    const getExistingCookies = (details) => new Promise((resolve, reject) => {
        try {
            chrome.cookies.getAll(details, (currentCookies) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(new Error(error.message));
                    return;
                }

                resolve(currentCookies || []);
            });
        } catch (error) {
            reject(error);
        }
    });

    const getExistingCookiesForCurrentSite = async () => {
        if (isFacebookTargetUrl(url)) {
            const allCookies = await getExistingCookies({});
            const facebookCookies = allCookies.filter(isFacebookCookieDomain);
            addImportDebug("read_existing_facebook_cookies", {
                count: facebookCookies.length,
                cookies: facebookCookies.map(summarizeCookie),
            });
            return facebookCookies;
        }

        const hostname = getHostname(url);
        const baseDomain = getBaseDomain(url);
        const queries = [{url}];

        [hostname, baseDomain].filter(Boolean).forEach((domain) => {
            queries.push({domain});
            queries.push({domain: `.${domain}`});
        });

        const seenQueries = new Set();
        const seenCookies = new Map();

        for (const query of queries) {
            const queryKey = JSON.stringify(query);
            if (seenQueries.has(queryKey)) {
                continue;
            }

            seenQueries.add(queryKey);
            try {
                const cookiesForQuery = await getExistingCookies(query);
                cookiesForQuery.forEach((cookie) => {
                    const cookieKey = [
                        cookie.storeId || "",
                        cookie.domain || "",
                        cookie.path || "",
                        cookie.name || "",
                    ].join("\n");
                    seenCookies.set(cookieKey, cookie);
                });
            } catch (error) {
                console.warn("Unable to read existing cookies before import:", query, error);
            }
        }

        const cookies = Array.from(seenCookies.values());
        addImportDebug("read_existing_site_cookies", {
            count: cookies.length,
            cookies: cookies.map(summarizeCookie),
        });
        return cookies;
    }

    const removeCookies = async (cookiesToRemove) => {
        addImportDebug("remove_cookies_start", {
            count: cookiesToRemove.length,
            cookies: cookiesToRemove.map(summarizeCookie),
        });

        await Promise.all(cookiesToRemove.map(async (cookie) => {
            const details = {
                url: getCookieUrl(cookie, url),
                name: cookie.name,
            };

            if (cookie.storeId != null) {
                details.storeId = String(cookie.storeId);
            }

            try {
                await removeChromeCookie(details);
                addImportDebug("remove_cookie_success", {
                    cookie: summarizeCookie(cookie),
                    removeDetails: {
                        urlHost: new URL(details.url).hostname,
                        name: details.name,
                        storeId: details.storeId,
                    },
                });
            } catch (error) {
                addImportDebug("remove_cookie_error", {
                    cookie: summarizeCookie(cookie),
                    error: getSafeError(error),
                });
                console.warn("Unable to remove cookie before import:", summarizeCookie(cookie), error);
            }
        }));
    };

    const clearConflictingCookies = async (cookieArray) => {
        const importNames = getCookieNameSet(cookieArray);

        if (importNames.size === 0) {
            return;
        }

        const existingCookies = await getExistingCookiesForCurrentSite();
        const conflictingCookies = existingCookies.filter((cookie) =>
            importNames.has(String(cookie?.name || "").toLowerCase())
        );

        await removeCookies(conflictingCookies);
    };

    const clearCurrentSiteCookies = async () => {
        await removeCookies(await getExistingCookiesForCurrentSite());
    };

    const verifyFacebookLoginCookies = async (cookieArray) => {
        if (!hasFacebookLoginIntent(cookieArray)) {
            return;
        }

        const storedCookies = await getExistingCookiesForCurrentSite();
        const storedNames = getCookieNameSet(storedCookies);
        const missingLoginCookies = Array.from(facebookLoginCookieNames)
            .filter((name) => !storedNames.has(name));
        const malformedOptionalCookies = storedCookies.filter((cookie) =>
            optionalCookieNames.has(String(cookie?.name || "").toLowerCase()) && getNestedCookieName(cookie?.value)
        );

        addImportDebug("verify_facebook_login_cookies", {
            requiredCookies: Array.from(facebookLoginCookieNames),
            missingLoginCookies,
            malformedOptionalCookies: malformedOptionalCookies.map(summarizeCookie),
            storedCookies: storedCookies.map(summarizeCookie),
        });

        if (missingLoginCookies.length > 0) {
            throw new Error(`Facebook cookie was imported but ${missingLoginCookies.join(", ")} was not set. Check that the pasted cookie contains c_user and xs separated by semicolons.`);
        }

        if (malformedOptionalCookies.length > 0) {
            throw new Error(`Malformed cookie remains after import: ${malformedOptionalCookies.map((cookie) => `${cookie.name} contains ${getNestedCookieName(cookie.value)}`).join(", ")}.`);
        }
    };

    const setCookieWithFallback = async (cookie) => {
        if (!cookie?.name) {
            throw new Error("Cookie name is required");
        }

        const lowerName = String(cookie.name || "").toLowerCase();
        const isFacebookCookie = isFacebookTargetUrl(url) && facebookCookieNames.has(lowerName);
        const baseDomain = getBaseDomain(url);
        const facebookDomainCookie = isFacebookCookie && baseDomain
            ? {
                ...cookie,
                domain: cookie.domain || `.${baseDomain}`,
                hostOnly: false,
                path: cookie.path || "/",
                sameSite: cookie.sameSite || "no_restriction",
                secure: true,
                storeId: undefined,
            }
            : null;
        const facebookBaseDomainCookie = facebookDomainCookie
            ? {
                ...facebookDomainCookie,
                domain: baseDomain,
            }
            : null;
        const withoutOptionalFields = {
            ...cookie,
            expirationDate: undefined,
            httpOnly: undefined,
            sameSite: undefined,
            storeId: undefined,
        };
        const cookieOnBaseDomain = baseDomain
            ? {...cookie, domain: baseDomain, hostOnly: false, storeId: undefined}
            : null;
        const minimalCookie = {
            name: cookie.name,
            value: cookie.value,
            path: cookie.path || "/",
        };
        const attempts = [
            ...(facebookDomainCookie ? [
                buildCookieSetDetails(facebookDomainCookie, url, {includeDomain: true}),
                buildCookieSetDetails({...facebookDomainCookie, sameSite: undefined}, url, {includeDomain: true}),
                buildCookieSetDetails(facebookBaseDomainCookie, url, {includeDomain: true}),
                buildCookieSetDetails({...facebookBaseDomainCookie, sameSite: undefined}, url, {includeDomain: true}),
            ] : []),
            ...(!isFacebookCookie ? [
                buildCookieSetDetails(cookie, url, {includeDomain: true}),
                buildCookieSetDetails({...cookie, storeId: undefined}, url, {includeDomain: true}),
                ...(cookieOnBaseDomain ? [
                    buildCookieSetDetails(cookieOnBaseDomain, url, {includeDomain: true}),
                    buildCookieSetDetails({...cookieOnBaseDomain, expirationDate: undefined, sameSite: undefined, httpOnly: undefined}, url, {includeDomain: true}),
                ] : []),
                buildCookieSetDetails({...cookie, sameSite: undefined, storeId: undefined}, url, {includeDomain: true}),
                buildCookieSetDetails({...cookie, httpOnly: undefined, sameSite: undefined, storeId: undefined}, url, {includeDomain: true}),
                buildCookieSetDetails({...cookie, domain: undefined, hostOnly: true, storeId: undefined}, url),
                buildCookieSetDetails({...withoutOptionalFields, domain: undefined, hostOnly: true}, url),
                buildCookieSetDetails({...withoutOptionalFields, domain: undefined, hostOnly: true, path: "/"}, url),
                buildCookieSetDetails(minimalCookie, url),
                ...(baseDomain ? [
                    buildCookieSetDetails({...minimalCookie, domain: baseDomain, hostOnly: false}, url, {includeDomain: true}),
                ] : []),
            ] : []),
        ];
        const seen = new Set();
        let lastError;

        for (const details of attempts) {
            const key = JSON.stringify(details);
            if (!details.url || !details.name || seen.has(key)) {
                continue;
            }

            seen.add(key);
            addImportDebug("set_cookie_attempt", {
                sourceCookie: summarizeCookie(cookie),
                details: summarizeCookieSetDetails(details),
            });
            try {
                await setChromeCookie(details);
                addImportDebug("set_cookie_success", {
                    sourceCookie: summarizeCookie(cookie),
                    details: summarizeCookieSetDetails(details),
                });
                return true;
            } catch (error) {
                lastError = error;
                addImportDebug("set_cookie_error", {
                    sourceCookie: summarizeCookie(cookie),
                    details: summarizeCookieSetDetails(details),
                    error: getSafeError(error),
                });
            }
        }

        throw lastError || new Error(`Unable to import cookie ${cookie.name}`);
    }

    const importCookieArray = async (cookieArray) => {
        let imported = 0;
        let skippedOptional = 0;
        const errors = [];

        for (const cookie of cookieArray) {
            try {
                await setCookieWithFallback(cookie);
                imported += 1;
            } catch (error) {
                if (optionalCookieNames.has(String(cookie?.name || "").toLowerCase())) {
                    skippedOptional += 1;
                } else {
                    errors.push({cookie, error});
                }
                console.warn("Skip invalid cookie during import:", summarizeCookie(cookie), error);
            }
        }

        if (imported === 0) {
            if (errors.length > 0) {
                throw errors[0].error;
            }

            throw new Error(skippedOptional > 0
                ? "Only optional display cookies were found. Paste full cookies such as c_user, xs, sb, datr."
                : "No cookies were imported");
        }

        return imported;
    }

    const handleImport = async () => {
        try {
            if (!isHttpUrl(url)) {
                settingStore.alert = {type: "error", message: extension.getLang("alert_import_cookie_error")}
                return;
            }

            const rawContent = (await getImportContent()).trim();
            startImportDebug(url, rawContent);
            addImportDebug("import_start", {
                format,
                targetUrl: url,
                rawLength: rawContent.length,
            });
            const dataCookies = decryptContent(rawContent);
            addImportDebug("content_ready", {
                decryptedLength: String(dataCookies || "").length,
                encrypted: password.length > 0,
            });
            const cookieArray = parseImportContent(dataCookies);
            addImportDebug("parsed_cookies", {
                count: cookieArray.length,
                cookies: cookieArray.map(summarizeCookie),
            });
            if (cookieArray.length === 0) {
                await finishImportDebug("error", new Error("No cookies parsed"));
                settingStore.alert = {type: "error", message: extension.getLang("alert_import_cookie_error")}
                return;
            }

            validateImportCookieArray(cookieArray);
            if (shouldClearSiteBeforeImport(cookieArray)) {
                await clearCurrentSiteCookies();
            } else {
                await clearConflictingCookies(cookieArray);
            }
            await importCookieArray(cookieArray);
            await verifyFacebookLoginCookies(cookieArray);
            await finishImportDebug("success");

            document.dispatchEvent(new CustomEvent("update_cookie", {
                detail: {action: "import"},
                bubbles: true,
            }));

            if (optionImport.includes("reload_page")) {
                try {
                    const tabId = tab?.id || (await chrome.tabs.query({active: true, lastFocusedWindow: true}))[0]?.id;
                    if (tabId) {
                        await chrome.tabs.reload(tabId);
                    }
                } catch (error) {
                    console.warn("Unable to reload tab after cookie import:", error);
                }
            }
            googleAnalytics({name: "import_cookie", params: []});
            settingStore.popup = "";
            settingStore.alert = {type: "info", message: `${extension.getLang("alert_import_cookie_success")} - debug log copied`}
        } catch (e) {
            console.error("import error", e)
            await finishImportDebug("error", e);
            settingStore.alert = {type: "error", message: `${getImportErrorMessage(e)} - debug log copied`}
        }
    }

    useEffect(() => {
        if (settingStore.popup === "import_cookie" && isHttpUrl(tab?.url)) {
            setUrl(tab.url)
        }
    }, [settingStore.popup, tab?.url])

    return (
        <>
            {
                settingStore.popup === "import_cookie" && (
                    <>
                        <ModalPopup />
                        <motion.div
                            ref={ref}
                            initial={{opacity: 0, y: -50}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -50}}
                            transition={{duration: 0.5}}
                            className={`fixed top-0 left-0 p-[10px]`}
                            style={{zIndex: 50, width: "calc(100% - 50px)"}}
                        >
                            <div className={`bg-white rounded-[10px] overflow-y-auto p-5`} style={{maxHeight: "calc(100vh - 80px)"}}>
                                <p className={`font-bold text-[14px] mb-2`}>
                                    {extension.getLang("title_import_cookie")}
                                </p>
                                <p className={`text-[12px] mb-5`}>
                                    {extension.getLang("description_import_cookie")}
                                </p>
                                <div className={`w-full flex flex-wrap justify-between mb-2`}>
                                    {
                                        listFormats.map((item, key) => (
                                            <div key={key} className="inline-flex w-fit pr-3 items-center mb-4">
                                                <input
                                                    id={item.id}
                                                    type="radio"
                                                    value={item.value}
                                                    name="format"
                                                    onClick={(e) => settingStore.setFormatImport(e.target.value)}
                                                    checked={format === item.value}
                                                    className="w-4 h-4 text-blue-600 bg-gray-400 border-gray-300 focus:ring-blue-500"
                                                />
                                                <label
                                                    htmlFor={item.id}
                                                    className="ms-2 text-[12px] cursor-pointer font-medium text-gray-900"
                                                >
                                                    {item.title}
                                                </label>
                                            </div>
                                        ))
                                    }
                                </div>
                                <div className={`w-full mb-5`}>
                                    <input
                                        type="text"
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 mb-1"
                                        value={url}
                                    />
                                </div>
                                <div className={`w-full mb-5`}>
                                    {
                                        format === "text" && (
                                            <>
                                                <label className="block mb-2 text-[12px] font-medium text-gray-900">
                                                    Cookie value
                                                </label>
                                                <textarea
                                                    rows={5}
                                                    onChange={(e) => setCookies(e.target.value)}
                                                    placeholder={"JSON/Header string/Netscape"}
                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 mb-1"
                                                />
                                            </>
                                        )
                                    }

                                    {
                                        format === "file" && (
                                            <>
                                                <label className="block mb-2 text-[12px] font-medium text-gray-900">
                                                    {extension.getLang("label_select_file_import")}
                                                </label>
                                                <input
                                                    onChange={handleFileChange}
                                                    accept=".txt, .json"
                                                    className="block w-full mb-5 text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                                                    type="file"
                                                />
                                            </>
                                        )
                                    }

                                    {
                                        format === "link" && (
                                            <>
                                                <label className="block mb-2 text-[12px] font-medium text-gray-900">
                                                    {extension.getLang("lable_link_import")} (<span className={"text-red-500"}>*</span>)
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder={"http://example.com/cookie"}
                                                    onChange={(e) => setLinkImport(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 mb-1"
                                                    value={linkImport}
                                                />
                                            </>
                                        )
                                    }
                                </div>
                                <div className={`w-full mb-5`}>
                                    <label
                                        htmlFor="hostOnly"
                                        className="block mb-2 text-[12px] font-medium text-gray-900">
                                        {extension.getLang("label_password_decrypt")}
                                    </label>
                                    <input
                                        type="password"
                                        placeholder={extension.getLang("label_password_decrypt")}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1"
                                        value={password}
                                    />
                                    <p className={`text-gray-500`}>
                                        {extension.getLang("description_password_decrypt")}
                                    </p>
                                </div>
                                <div className={`w-full flex justify-between`}>
                                    <div className={"inline-block w-[59%]"}>
                                        <button
                                            onClick={handleImport}
                                            className={`h-[40px] w-full rounded-[10px] bg-blue-500 text-white px-5`}>
                                            {extension.getLang("btn_import")}
                                        </button>
                                    </div>
                                    <div className={"inline-block w-[39%]"}>
                                        <button
                                            onClick={() => settingStore.popup = ""}
                                            className={`h-[40px] w-full rounded-[10px] bg-gray-200 text-gray-900 px-5`}>
                                            {extension.getLang("btn_cancel")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )
            }
        </>
    )
}

export default observer(ImportCookie)

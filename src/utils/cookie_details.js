import {getCookieUrl} from "./url";

export const toTimestampSeconds = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    let timestamp = Number(value);
    if (!Number.isFinite(timestamp) && typeof value === "string") {
        timestamp = Date.parse(value);
    }

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return undefined;
    }

    return Math.round(timestamp > 9999999999 ? timestamp / 1000 : timestamp);
};

export const toBoolean = (value) => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        switch (value.trim().toLowerCase()) {
            case "true":
                return true;

            case "false":
                return false;
        }
    }

    return undefined;
};

export const normalizeSameSite = (value) => {
    switch (String(value || "").trim().toLowerCase()) {
        case "none":
        case "no_restriction":
            return "no_restriction";

        case "lax":
            return "lax";

        case "strict":
            return "strict";

        case "unspecified":
        default:
            return "unspecified";
    }
};

const cleanDetails = (details) => Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "")
);

export const sanitizeCookieName = (value) => String(value || "")
    .replace(/[^\x21-\x7E]/g, "")
    .replace(/[()<>@,;:\\"/[\]?={}]/g, "")
    .trim();

export const sanitizeCookieValue = (value) => String(value ?? "")
    .replace(/[^\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]/g, "")
    .trim();

const OPTIONAL_COOKIE_NAMES = new Set(["dpr", "wd", "presence"]);
const RECOVERABLE_COOKIE_NAMES = new Set([
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

const recoverNestedCookieValue = (name, value) => {
    const match = String(value ?? "").match(/^([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/);
    const cookieName = String(name || "").toLowerCase();
    const nestedName = String(match?.[1] || "").toLowerCase();

    if (OPTIONAL_COOKIE_NAMES.has(cookieName) && RECOVERABLE_COOKIE_NAMES.has(nestedName)) {
        return {
            name: match[1],
            value: match[2],
        };
    }

    return {name, value};
};

const getCookieNameAndValue = (cookie) => {
    let name = String(cookie.name || "").trim().replace(/;+$/g, "");
    let value = cookie.value;
    const inlineValueIndex = name.indexOf("=");

    if (inlineValueIndex > -1) {
        const valueFromName = name.slice(inlineValueIndex + 1).trim().replace(/;+$/g, "");
        name = name.slice(0, inlineValueIndex).trim().replace(/;+$/g, "");

        if (value === undefined || value === null || value === "") {
            value = valueFromName;
        }
    }

    const recovered = recoverNestedCookieValue(name, value);
    name = recovered.name;
    value = recovered.value;

    return {
        name: sanitizeCookieName(name),
        value: sanitizeCookieValue(String(value ?? "").trim().replace(/;+$/g, "")),
    };
};

export const buildCookieSetDetails = (cookie, fallbackUrl, options = {}) => {
    const {includeDomain = false} = options;
    const {name, value} = getCookieNameAndValue(cookie);
    const sameSite = normalizeSameSite(cookie.sameSite);
    const session = toBoolean(cookie.session) ?? false;
    const hostOnly = toBoolean(cookie.hostOnly) ?? false;
    const httpOnly = toBoolean(cookie.httpOnly);
    const rawExpirationDate = session ? undefined : toTimestampSeconds(cookie.expirationDate);
    const expirationDate = rawExpirationDate && rawExpirationDate > Math.round(Date.now() / 1000)
        ? rawExpirationDate
        : undefined;
    const url = getCookieUrl(cookie, fallbackUrl);
    const hasHostPrefix = name.startsWith("__Host-");
    const hasSecurePrefix = name.startsWith("__Secure-");
    const secure = sameSite === "no_restriction" || hasHostPrefix || hasSecurePrefix
        ? true
        : toBoolean(cookie.secure);

    return cleanDetails({
        url,
        name,
        value,
        domain: includeDomain && cookie.domain && !hostOnly && !hasHostPrefix
            ? String(cookie.domain).replace(/^#HttpOnly_/i, "")
            : undefined,
        path: hasHostPrefix ? "/" : (cookie.path || "/"),
        secure: typeof secure === "boolean" ? secure : undefined,
        httpOnly: typeof httpOnly === "boolean" ? httpOnly : undefined,
        sameSite: sameSite === "unspecified" ? undefined : sameSite,
        expirationDate,
        storeId: cookie.storeId === undefined || cookie.storeId === null || cookie.storeId === ""
            ? undefined
            : String(cookie.storeId),
    });
};

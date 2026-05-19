import {sanitizeCookieName, toTimestampSeconds} from "./cookie_details";

const COOKIE_ATTRIBUTE_NAMES = new Set([
    "domain",
    "expires",
    "httponly",
    "max-age",
    "path",
    "priority",
    "samesite",
    "secure",
    "partitioned",
]);

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

const splitNameValue = (part) => {
    const index = part.indexOf("=");
    if (index <= 0) {
        return null;
    }

    return {
        name: sanitizeCookieName(part.slice(0, index).trim().replace(/;+$/g, "")),
        value: part.slice(index + 1).trim().replace(/;+$/g, ""),
    };
};

const recoverNestedCookie = (cookie) => {
    const nestedCookie = splitNameValue(cookie?.value || "");
    const cookieName = String(cookie?.name || "").toLowerCase();
    const nestedName = String(nestedCookie?.name || "").toLowerCase();

    if (OPTIONAL_COOKIE_NAMES.has(cookieName) && RECOVERABLE_COOKIE_NAMES.has(nestedName)) {
        return nestedCookie;
    }

    return cookie;
};

const normalizeHeaderCookieInput = (input) => String(input || "")
    .replace(/^cookie\s*:\s*/gmi, "")
    .replace(/(^|[^\S\r\n;])([A-Za-z_][A-Za-z0-9_-]*)=/g, (match, prefix, name, offset) => {
        if (offset === 0 || prefix === ";") {
            return match;
        }

        return `; ${name}=`;
    });

const isCookieAttribute = (part) => {
    const name = part.split("=")[0].trim().toLowerCase();
    return COOKIE_ATTRIBUTE_NAMES.has(name);
};

const toSameSite = (value) => {
    switch (String(value || "").trim().toLowerCase()) {
        case "none":
        case "no_restriction":
            return "no_restriction";

        case "lax":
            return "lax";

        case "strict":
            return "strict";

        default:
            return undefined;
    }
};

const toExpirationDate = (value) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : toTimestampSeconds(parsed);
};

const isNetscapeBoolean = (value) => ["TRUE", "FALSE"].includes(String(value || "").toUpperCase());

const isNetscapeCookieLine = (columns) => {
    if (columns.length < 7) {
        return false;
    }

    const domain = String(columns[0] || "").replace(/^#HttpOnly_/i, "");
    const path = String(columns[2] || "");
    const expiration = String(columns[4] || "");
    const name = String(columns[5] || "");

    return !domain.includes("=")
        && domain.includes(".")
        && isNetscapeBoolean(columns[1])
        && path.startsWith("/")
        && isNetscapeBoolean(columns[3])
        && /^\d+$/.test(expiration)
        && Boolean(sanitizeCookieName(name))
        && !name.includes("=");
};

export const parseHeaderCookies = (input) => normalizeHeaderCookieInput(input)
    .split(/[;\r\n]+/)
    .map((part) => {
        const cookie = recoverNestedCookie(splitNameValue(part));

        return cookie && {
            ...cookie,
            path: "/",
        };
    })
    .filter((cookie) => cookie && cookie.name);

export const parseSetCookieCookies = (input) => String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
        const hasSetCookiePrefix = /^set-cookie\s*:/i.test(line);
        const normalizedLine = line.replace(/^set-cookie\s*:\s*/i, "");
        const parts = normalizedLine.split(";").map((part) => part.trim()).filter(Boolean);
        if (parts.length === 0) {
            return null;
        }

        const baseCookie = splitNameValue(parts[0]);
        if (!baseCookie) {
            return null;
        }

        if (!hasSetCookiePrefix && !parts.slice(1).some(isCookieAttribute)) {
            return null;
        }

        const cookie = {
            ...baseCookie,
            path: "/",
        };

        for (const part of parts.slice(1)) {
            const [rawName, ...rawValueParts] = part.split("=");
            const name = rawName.trim().toLowerCase();
            const value = rawValueParts.join("=").trim();

            switch (name) {
                case "domain":
                    cookie.domain = value;
                    break;

                case "expires":
                    cookie.expirationDate = toExpirationDate(value);
                    break;

                case "max-age": {
                    const seconds = Number(value);
                    if (Number.isFinite(seconds) && seconds > 0) {
                        cookie.expirationDate = Math.round(Date.now() / 1000) + seconds;
                    }
                    break;
                }

                case "path":
                    cookie.path = value || "/";
                    break;

                case "samesite":
                    cookie.sameSite = toSameSite(value);
                    break;

                case "secure":
                    cookie.secure = true;
                    break;

                case "httponly":
                    cookie.httpOnly = true;
                    break;
            }
        }

        if (cookie.sameSite === "no_restriction" || cookie.name.startsWith("__Secure-") || cookie.name.startsWith("__Host-")) {
            cookie.secure = true;
        }

        if (cookie.name.startsWith("__Host-")) {
            cookie.path = "/";
            delete cookie.domain;
        }

        return cookie;
    })
    .filter((cookie) => cookie && cookie.name);

export const parseJsonCookies = (input) => {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;

    if (Array.isArray(parsed)) {
        return parsed;
    }

    if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.cookies)) {
            return parsed.cookies;
        }

        if ("name" in parsed && "value" in parsed) {
            return [parsed];
        }
    }

    return [];
};

export const parseNetscapeCookies = (input) => String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
    .map((line) => {
        const columns = line.split(/\s+/);
        if (!isNetscapeCookieLine(columns)) {
            return null;
        }

        const rawDomain = columns[0];
        const httpOnly = rawDomain.startsWith("#HttpOnly_");
        const domain = rawDomain.replace(/^#HttpOnly_/i, "");

        return {
            domain,
            httpOnly,
            path: columns[2] || "/",
            secure: columns[3].toUpperCase() === "TRUE" || columns[5].startsWith("__Secure-"),
            expirationDate: toTimestampSeconds(columns[4]),
            name: columns[5],
            value: columns.slice(6).join(" "),
        };
    })
    .filter((cookie) => cookie && cookie.name);

export const looksLikeNetscapeCookies = (input) => parseNetscapeCookies(input).length > 0;

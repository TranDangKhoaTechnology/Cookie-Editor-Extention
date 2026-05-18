import {getCookieUrl} from "./url";

export const toTimestampSeconds = (value) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return undefined;
    }

    return Math.round(timestamp > 9999999999 ? timestamp / 1000 : timestamp);
};

const cleanDetails = (details) => Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "")
);

export const buildCookieSetDetails = (cookie, fallbackUrl, options = {}) => {
    const {includeDomain = false} = options;
    const sameSite = cookie.sameSite || "unspecified";
    const expirationDate = cookie.session ? undefined : toTimestampSeconds(cookie.expirationDate);
    const url = getCookieUrl(cookie, fallbackUrl);
    const secure = sameSite === "no_restriction" ? true : cookie.secure;

    return cleanDetails({
        url,
        name: String(cookie.name || "").trim(),
        value: String(cookie.value ?? ""),
        domain: includeDomain && cookie.domain && !cookie.hostOnly
            ? String(cookie.domain).replace(/^#HttpOnly_/i, "")
            : undefined,
        path: cookie.path || "/",
        secure: typeof secure === "boolean" ? secure : undefined,
        httpOnly: typeof cookie.httpOnly === "boolean" ? cookie.httpOnly : undefined,
        sameSite: sameSite === "unspecified" ? undefined : sameSite,
        expirationDate,
        storeId: cookie.storeId,
    });
};

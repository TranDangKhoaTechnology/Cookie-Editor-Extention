export const isHttpUrl = (url) => typeof url === "string" && /^https?:\/\//i.test(url);

export const getOriginFromUrl = (url) => {
    if (!isHttpUrl(url)) {
        return "";
    }

    try {
        return new URL(url).origin;
    } catch {
        return "";
    }
};

export const getCookieUrl = (cookie = {}, fallbackUrl = "") => {
    if (isHttpUrl(fallbackUrl)) {
        try {
            const fallback = new URL(fallbackUrl);
            const domain = String(cookie.domain || fallback.hostname)
                .replace(/^#HttpOnly_/i, "")
                .replace(/^\./, "");
            const path = String(cookie.path || fallback.pathname || "/");

            return `${fallback.protocol}//${domain}${path.startsWith("/") ? path : `/${path}`}`;
        } catch {
            return fallbackUrl;
        }
    }

    const domain = String(cookie.domain || "")
        .replace(/^#HttpOnly_/i, "")
        .replace(/^\./, "");

    if (!domain) {
        return "";
    }

    const protocol = cookie.secure ? "https:" : "http:";
    const path = String(cookie.path || "/");
    return `${protocol}//${domain}${path.startsWith("/") ? path : `/${path}`}`;
};

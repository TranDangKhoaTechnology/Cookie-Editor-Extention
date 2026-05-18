import {toTimestampSeconds} from "./cookie_details";

export const parseHeaderCookies = (input) => String(input || "")
    .split(";")
    .map((part) => {
        const index = part.indexOf("=");
        if (index <= 0) {
            return null;
        }

        return {
            name: part.slice(0, index).trim(),
            value: part.slice(index + 1).trim(),
            path: "/",
        };
    })
    .filter((cookie) => cookie && cookie.name);

export const parseNetscapeCookies = (input) => String(input || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
    .map((line) => {
        const columns = line.split(/\s+/);
        if (columns.length < 7) {
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

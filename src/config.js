const normalizeUrl = (url) => String(url).replace(/\/+$/, "");


export const OWNER_NAME = "Trần Đăng Khoa";
export const OWNER_FACEBOOK_URL = "https://www.facebook.com/100026315003067";
export const OWNER_WEBSITE_URL = normalizeUrl("https://example.com");

export const WEBSITE_URL = normalizeUrl(
    import.meta.env.VITE_WEBSITE || OWNER_WEBSITE_URL
);

/*global chrome*/
import WebsiteInfo from "../components/webiste_info";
import TopAction from "../components/top_action";
import DetailCookie from "../components/detail_cookie";
import {useEffect, useState} from "react";
import {icons} from "../../../constants/icon";
import EmptyCookie from "../components/empty_cookie";
import {observer} from "mobx-react-lite";
import {settingStore} from "../../../mobx/setting.store";
import {isHttpUrl} from "../../../utils/url";

const ShowCookie = () => {
    const [tab, setTab] = useState(undefined);
    const [favicon, setFavicon] = useState("");
    const [cookieInfo, setCookieInfo] = useState(undefined);

    const cloneTab = (tabInfo) => tabInfo ? JSON.parse(JSON.stringify(tabInfo)) : null;

    const getFallbackWebTab = async () => {
        const tabs = await chrome.tabs.query({lastFocusedWindow: true});
        return tabs.find((item) => isHttpUrl(item?.url) && /(^|\.)facebook\.com$/i.test(new URL(item.url).hostname.replace(/^www\./i, "")))
            || tabs.find((item) => isHttpUrl(item?.url))
            || null;
    }

    const handleGetTabCurrent = async () => {
        const [tabCurrent] = await chrome.tabs.query({active: true, lastFocusedWindow: true});

        if (isHttpUrl(tabCurrent?.url)) {
            setTab(cloneTab(tabCurrent));
            return;
        }

        setTab((previousTab) => {
            if (isHttpUrl(previousTab?.url)) {
                return previousTab;
            }

            return tabCurrent ? cloneTab(tabCurrent) : null;
        });

        const fallbackTab = await getFallbackWebTab();
        if (fallbackTab) {
            setTab(cloneTab(fallbackTab));
        }
    }

    const getFavicon = async (url) => {
        if (url.startsWith("chrome://")) {
            setFavicon(icons.chrome)
        } else {
            const linkFavicon = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=32`;
            try {
                const check = await fetch(linkFavicon);
                if (check.status === 404) {
                    setFavicon(icons.chrome)
                } else {
                    setFavicon(linkFavicon)
                }
            } catch {
                setFavicon(icons.chrome)
            }
        }
    }

    const handleGetCookies = async () => {
        if (!isHttpUrl(tab?.url)) {
            setCookieInfo([]);
            return;
        }

        try {
            const data = await chrome.cookies.getAll({url: tab.url});
            setCookieInfo(JSON.parse(JSON.stringify(data)));
        } catch (error) {
            console.error(error);
            setCookieInfo([]);
        }
    }

    useEffect(() => {
        if (tab) {
            const handleUpdateCookie = (e) => {
                ["add", "delete", "clear", "edit", "import"].includes(e.detail.action) && handleGetCookies().then()
            }

            document.addEventListener("update_cookie", handleUpdateCookie);

            return () => document.removeEventListener("update_cookie", handleUpdateCookie);
        }
    }, [tab])

    useEffect(() => {
        handleGetTabCurrent().then();

        const handleTabChanged = () => {
            handleGetTabCurrent().then();
        };

        chrome.tabs.onActivated.addListener(handleTabChanged);
        chrome.tabs.onUpdated.addListener(handleTabChanged);

        return () => {
            chrome.tabs.onActivated.removeListener(handleTabChanged);
            chrome.tabs.onUpdated.removeListener(handleTabChanged);
        }
    }, [])

    useEffect(() => {
        if (tab !== undefined && tab !== null) {
            if (isHttpUrl(tab.url)) {
                getFavicon(tab.url).then()
                handleGetCookies().then();
            } else {
                setFavicon(icons.chrome);
                setCookieInfo([]);
            }
        }
    }, [tab]);

    return (
        <>
            {
                settingStore.tab === "home" && (
                    <>
                        <WebsiteInfo
                            tab={tab}
                            favicon={favicon}
                        />

                        {
                            typeof cookieInfo === "object" && (
                                <TopAction
                                    tab={tab}
                                    cookies={cookieInfo}
                                />
                            )
                        }

                        <div className={`w-full mb-3`}>
                            {
                                typeof cookieInfo === "object" && (
                                    <>
                                        {
                                            cookieInfo.length > 0 ? (
                                                <DetailCookie
                                                    cookies={cookieInfo}
                                                />
                                            ) : (
                                                <EmptyCookie />
                                            )
                                        }
                                    </>
                                )
                            }
                        </div>
                    </>
                )
            }
        </>
    )
}

export default observer(ShowCookie)

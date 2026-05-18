/*global chrome*/
import {inExtensionUrl} from "./extension_path";

const image = {
    inExtension: (path) => {
        return inExtensionUrl(path);
    },
    favicon: (url) => {
        return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=32`
    }
}

export {
    image
}

import {WEBSITE_URL} from "../../../../config";

const Ads = () => {
    return (
        <div className={`w-full h-full relative`}>
            <iframe
                id={"ads_content"}
                className={`w-[300px] h-full mx-auto border-0`}
                scrolling="no"
                src={`${WEBSITE_URL}/ads`}>
            </iframe>
        </div>
    )
}

export default Ads

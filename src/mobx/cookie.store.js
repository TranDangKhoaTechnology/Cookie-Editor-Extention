/*global chrome*/
import { makeAutoObservable } from 'mobx';
import {settingStore} from "./setting.store";
import {WEBSITE_URL} from "../config";

class CookieStore {
    constructor() {
        makeAutoObservable(this);
    }

    links = [];
    cookie_detail = {};
    has_next = false;

    async getLinks(page) {
        try {
            settingStore.loading = true;
            const response = await fetch(`${WEBSITE_URL}/api/cookie/list?page=${page}`, {
                "method": "GET",
                "mode": "cors",
                "credentials": "include"
            });
            if (response.ok) {
                const dataResponse = await response.json();
                this.links = dataResponse.data.cookies;
                this.has_next = dataResponse.data.cookies.length === 100;
            }
        } catch (error) {
            console.error(error);
        } finally {
            settingStore.loading = false;
        }
    }

    async restoreLinks() {
        this.links = [];
        await this.getLinks(1)
    }

}

export const cookieStore = new CookieStore();

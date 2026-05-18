/*global chrome*/
import { makeAutoObservable } from 'mobx';
import {settingStore} from "./setting.store";
import {WEBSITE_URL} from "../config";

class AccountStore {
    constructor() {
        makeAutoObservable(this);
    }

    account = {};

    async getAccount() {
        try {
            const response = await fetch(`${WEBSITE_URL}/auth/info`, {
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            });

            const dataResponse = await response.json();
            if (dataResponse.data.user) {
                this.account = dataResponse.data.user;
                settingStore.show_ads = dataResponse.data.user.account_type === 1;
            } else {
                settingStore.show_ads = true;
            }
        } catch (error) {
            console.error(error);
            this.account = {};
            settingStore.show_ads = false;
        }
    }

    async logout() {
        await fetch(`${WEBSITE_URL}/logout`, {
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        });

        this.account = {};
        settingStore.popup = "";
    }

}

export const accountStore = new AccountStore();

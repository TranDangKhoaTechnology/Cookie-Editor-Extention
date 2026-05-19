import { describe, expect, it } from "vitest";
import {
  looksLikeNetscapeCookies,
  parseHeaderCookies,
  parseJsonCookies,
  parseNetscapeCookies,
  parseSetCookieCookies
} from "./utils/cookie_import";
import {buildCookieSetDetails} from "./utils/cookie_details";

describe("cookie editor", () => {
  it("loads test runner", () => {
    expect(true).toBe(true);
  });

  it("parses header cookies without dropping spaces or equals signs in values", () => {
    expect(parseHeaderCookies("sid=a=b; theme=dark mode")).toEqual([
      {name: "sid", value: "a=b", path: "/"},
      {name: "theme", value: "dark mode", path: "/"},
    ]);
  });

  it("parses wrapped header cookies and strips trailing semicolons", () => {
    expect(parseHeaderCookies("Cookie: dpr=1.25;\nwd=627x730;\n")).toEqual([
      {name: "dpr", value: "1.25", path: "/"},
      {name: "wd", value: "627x730", path: "/"},
    ]);
  });

  it("sanitizes hidden characters from header cookie names", () => {
    expect(parseHeaderCookies("\u200Bdpr=1.25;")[0]).toEqual({
      name: "dpr",
      value: "1.25",
      path: "/",
    });
  });

  it("parses header cookies separated by whitespace", () => {
    expect(parseHeaderCookies("c_user=12345 xs=12%3Aabc datr=xyz")).toEqual([
      {name: "c_user", value: "12345", path: "/"},
      {name: "xs", value: "12%3Aabc", path: "/"},
      {name: "datr", value: "xyz", path: "/"},
    ]);
  });

  it("recovers login cookies pasted into an optional cookie value", () => {
    expect(parseHeaderCookies("dpr=xs=12%3Aabc; c_user=12345")).toEqual([
      {name: "xs", value: "12%3Aabc", path: "/"},
      {name: "c_user", value: "12345", path: "/"},
    ]);
  });

  it("parses Facebook header cookies with optional flags", () => {
    expect(parseHeaderCookies("datr=datrValue; sb=sbValue; c_user=1000; ps_l=1; ps_n=1; dpr=1.25; xs=12%3Aabc%3A2; fr=frValue; presence=C%7B%22v%22%3A1%7D; wd=1094x730")).toEqual([
      {name: "datr", value: "datrValue", path: "/"},
      {name: "sb", value: "sbValue", path: "/"},
      {name: "c_user", value: "1000", path: "/"},
      {name: "ps_l", value: "1", path: "/"},
      {name: "ps_n", value: "1", path: "/"},
      {name: "dpr", value: "1.25", path: "/"},
      {name: "xs", value: "12%3Aabc%3A2", path: "/"},
      {name: "fr", value: "frValue", path: "/"},
      {name: "presence", value: "C%7B%22v%22%3A1%7D", path: "/"},
      {name: "wd", value: "1094x730", path: "/"},
    ]);
  });

  it("does not treat header cookies with spaces as Netscape cookies", () => {
    const header = "datr=datrValue; sb=sbValue; c_user=1000; ps_l=1; ps_n=1; dpr=1.25; xs=12%3Aabc%3A2; fr=frValue; presence=C%7B%22v%22%3A1%7D; wd=1094x730";

    expect(looksLikeNetscapeCookies(header)).toBe(false);
    expect(parseNetscapeCookies(header)).toEqual([]);
  });

  it("parses Netscape cookies including HttpOnly entries", () => {
    expect(parseNetscapeCookies("#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1713543600\tsid\tabc")[0]).toEqual({
      domain: ".example.com",
      httpOnly: true,
      path: "/",
      secure: true,
      expirationDate: 1713543600,
      name: "sid",
      value: "abc",
    });
  });

  it("parses Set-Cookie headers with attributes", () => {
    expect(parseSetCookieCookies("Set-Cookie: sid=abc=123; Domain=.example.com; Path=/; Secure; HttpOnly; SameSite=None")[0]).toEqual({
      domain: ".example.com",
      httpOnly: true,
      name: "sid",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      value: "abc=123",
    });
  });

  it("unwraps common JSON cookie exports", () => {
    expect(parseJsonCookies({cookies: [{name: "sid", value: "abc"}]})).toEqual([
      {name: "sid", value: "abc"},
    ]);
  });

  it("normalizes external cookie JSON before calling chrome.cookies.set", () => {
    expect(buildCookieSetDetails({
      domain: ".facebook.com",
      expirationDate: "1792690935",
      hostOnly: "false",
      httpOnly: "true",
      name: "sb",
      path: "/",
      sameSite: "None",
      secure: "false",
      storeId: 0,
      value: "abc",
    }, "https://www.facebook.com/", {includeDomain: true})).toEqual({
      domain: ".facebook.com",
      expirationDate: 1792690935,
      httpOnly: true,
      name: "sb",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      storeId: "0",
      url: "https://facebook.com/",
      value: "abc",
    });
  });

  it("repairs malformed imported cookie names that contain inline values", () => {
    expect(buildCookieSetDetails({
      name: "\u200Bdpr=1.25;",
      value: "",
    }, "https://www.facebook.com/")).toEqual({
      name: "dpr",
      path: "/",
      url: "https://www.facebook.com/",
      value: "1.25",
    });
  });

  it("repairs malformed optional cookie values that contain another cookie", () => {
    expect(buildCookieSetDetails({
      name: "dpr",
      value: "presence=C%7B%22v%22%3A1%7D",
    }, "https://www.facebook.com/")).toEqual({
      name: "presence",
      path: "/",
      url: "https://www.facebook.com/",
      value: "C%7B%22v%22%3A1%7D",
    });
  });
});

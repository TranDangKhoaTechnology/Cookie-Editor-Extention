import { describe, expect, it } from "vitest";
import {parseHeaderCookies, parseNetscapeCookies} from "./utils/cookie_import";

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
});

import { describe, it, expect, vi } from "vitest";
import * as obsidian from "obsidian";
import { RequestUrlHttpClient } from "../../../src/infrastructure/obsidian/RequestUrlHttpClient";

describe("RequestUrlHttpClient", () => {
  it("gets JSON via requestUrl without throwing on non-2xx", async () => {
    const spy = vi.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 404, json: { error: "x" } } as never);
    const res = await new RequestUrlHttpClient().getJson("http://h/x", { "X-Y": "z" }, new AbortController().signal);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: "http://h/x", method: "GET", throw: false, headers: expect.objectContaining({ "X-Y": "z", Accept: "application/json" }) }));
    expect(res).toEqual({ status: 404, json: { error: "x" } });
  });
  it("posts JSON and parses text when json is missing", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 200, text: '{"a":1}' } as never);
    const res = await new RequestUrlHttpClient().postJson("u", { a: 1 }, {}, new AbortController().signal);
    expect(res).toEqual({ status: 200, json: { a: 1 } });
    vi.spyOn(obsidian, "requestUrl").mockResolvedValue({ status: 200, text: "nope" } as never);
    expect((await new RequestUrlHttpClient().postJson("u", {}, {}, new AbortController().signal)).json).toBeNull();
  });
  it("rejects immediately if the signal is already aborted", async () => {
    const c = new AbortController(); c.abort();
    await expect(new RequestUrlHttpClient().getJson("u", {}, c.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("rejects with AbortError if aborted while in flight (the request itself cannot be cancelled)", async () => {
    vi.spyOn(obsidian, "requestUrl").mockImplementation(() => new Promise((r) => setTimeout(() => r({ status: 200, json: {} } as never), 50)));
    const c = new AbortController();
    const p = new RequestUrlHttpClient().postJson("u", {}, {}, c.signal);
    c.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

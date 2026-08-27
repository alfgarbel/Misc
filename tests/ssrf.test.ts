import { describe, it, expect } from "vitest";
import { checkUrl, isBlockedAddress } from "@/lib/urlcard/safety";

/** A resolver stub, so tests never depend on real DNS. */
const resolves = (...addrs: string[]) => async () => addrs;
const fails = async () => {
  throw new Error("NXDOMAIN");
};

describe("isBlockedAddress — IPv4", () => {
  it("blocks loopback, private and link-local ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.1.1",
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // AWS/GCP/Azure metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "255.255.255.255",
      "224.0.0.1", // multicast
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.32.0.1", "11.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("treats non-canonical notations as unverifiable rather than safe", () => {
    // 0177.0.0.1 is octal for 127.0.0.1, and 2130706433 is its decimal form.
    // Our parser must not disagree with the resolver's about what these mean.
    for (const ip of ["0177.0.0.1", "127.000.000.001", "2130706433", "0x7f000001"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });
});

describe("isBlockedAddress — IPv6", () => {
  it("blocks loopback, unspecified, ULA, link-local and multicast", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("blocks IPv4 loopback wearing an IPv6 coat", () => {
    for (const ip of [
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "::ffff:7f00:1",
      "0:0:0:0:0:ffff:127.0.0.1",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedAddress("2a00:1450:4009:81f::200e")).toBe(false);
  });

  it("blocks the documentation range and bracketed forms", () => {
    expect(isBlockedAddress("2001:db8::1")).toBe(true);
    expect(isBlockedAddress("[::1]")).toBe(true);
  });
});

describe("checkUrl — schemes and shapes", () => {
  it("accepts a normal https URL that resolves publicly", async () => {
    const r = await checkUrl("https://example.com/post", resolves("93.184.216.34"));
    expect(r.ok).toBe(true);
    expect(r.addresses).toEqual(["93.184.216.34"]);
  });

  it("rejects non-http schemes", async () => {
    for (const url of [
      "file:///etc/passwd",
      "ftp://example.com",
      "gopher://example.com",
      "data:text/html,<script>",
      "javascript:alert(1)",
    ]) {
      const r = await checkUrl(url, resolves("1.1.1.1"));
      expect(r.ok, url).toBe(false);
    }
  });

  it("rejects embedded credentials, which turn SSRF into authenticated SSRF", async () => {
    const r = await checkUrl("http://admin:hunter2@example.com/", resolves("1.1.1.1"));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("has_credentials");
  });

  it("rejects garbage", async () => {
    for (const url of ["", "not a url", "http://", "///"]) {
      expect((await checkUrl(url, resolves("1.1.1.1"))).ok, url).toBe(false);
    }
  });
});

describe("checkUrl — hostnames", () => {
  it("blocks localhost and internal-only suffixes by name", async () => {
    for (const host of [
      "http://localhost/",
      "http://localhost:8080/admin",
      "http://foo.localhost/",
      "http://printer.local/",
      "http://db.internal/",
      "http://metadata.google.internal/",
      "http://metadata/",
    ]) {
      const r = await checkUrl(host, resolves("1.1.1.1"));
      expect(r.ok, host).toBe(false);
      expect(r.reason, host).toBe("blocked_host");
    }
  });

  it("blocks a trailing-dot spelling of a blocked name", async () => {
    const r = await checkUrl("http://localhost./", resolves("1.1.1.1"));
    expect(r.ok).toBe(false);
  });

  it("blocks a public name that resolves to a private address", async () => {
    // The whole point: the name looks fine, the answer does not.
    const r = await checkUrl("https://evil.example.com/", resolves("127.0.0.1"));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("blocked_address");
  });

  it("blocks a name that resolves to the cloud metadata address", async () => {
    const r = await checkUrl("https://ssrf.example.com/", resolves("169.254.169.254"));
    expect(r.ok).toBe(false);
  });

  it("rejects a host if ANY answer is private, not just the first", async () => {
    // A round-robin between a public and a private answer must not be a
    // coin flip decided at connect time.
    const r = await checkUrl("https://mixed.example.com/", resolves("1.1.1.1", "127.0.0.1"));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("blocked_address");
  });

  it("reports resolution failure distinctly", async () => {
    const r = await checkUrl("https://nope.example.com/", fails);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dns_failed");
  });

  it("rejects a host with no addresses at all", async () => {
    const r = await checkUrl("https://empty.example.com/", resolves());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dns_failed");
  });
});

describe("checkUrl — obfuscated loopback, against the real resolver", () => {
  // getaddrinfo accepts decimal, hex, octal and short-form IPv4, so these
  // all reach 127.0.0.1 even though the URL parser sees an ordinary
  // hostname. The parser cannot classify them; resolving before deciding
  // is what catches them. No network is involved — these resolve locally.
  it.each(["2130706433", "0x7f000001", "0177.0.0.1", "127.1"])(
    "blocks http://%s/",
    async (host) => {
      const r = await checkUrl(`http://${host}/`);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("blocked_address");
    }
  );
});

describe("checkUrl — literal addresses", () => {
  it("blocks direct requests to internal literals", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://127.0.0.1:6379/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:8080/",
      "http://192.168.0.1/",
      "http://10.0.0.1/",
    ]) {
      const r = await checkUrl(url, resolves("1.1.1.1"));
      expect(r.ok, url).toBe(false);
    }
  });

  it("allows a public literal without consulting DNS", async () => {
    const r = await checkUrl("https://1.1.1.1/", async () => {
      throw new Error("resolver should not be called for a literal");
    });
    expect(r.ok).toBe(true);
  });
});

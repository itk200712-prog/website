// Server-only remote-media reader. Public DNS addresses are validated AND pinned
// on the socket (including every redirect), preventing DNS-rebinding/SSRF.
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

const blocked = new BlockList();
for (const [ip, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]] as const) blocked.addSubnet(ip, bits, "ipv4");
// Only globally routed IPv6 unicast (2000::/3) is considered; disallow
// documentation, Teredo and 6to4 transition addresses as well.
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("3fff::", 20, "ipv6");
blocked.addSubnet("192.88.99.0", 24, "ipv4");
blocked.addSubnet("2002::", 16, "ipv6");
const global6 = new BlockList();
global6.addSubnet("2000::", 3, "ipv6");

export function publicMediaAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 && global6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
export function validRemoteMediaUrl(value: string): URL {
  const url = new URL(value.startsWith("//") ? `https:${value}` : value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== "80" && url.port !== "443")) throw new Error("Unsupported media URL");
  return url;
}

const MAX_BYTES = 32 * 1024 * 1024;
export async function readRemoteMedia(value: string, redirects = 0): Promise<{ bytes: Buffer; type: string }> {
  if (redirects > 4) throw new Error("Too many media redirects");
  const url = validRemoteMediaUrl(value);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
    lookup(host, { all: true }),
    new Promise<never>((_resolve, reject) => { dnsTimer = setTimeout(() => reject(new Error("Media DNS lookup timed out")), 10_000); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((a) => !publicMediaAddress(a.address))) throw new Error("Private/reserved media host is not allowed");
  const chosen = addresses[0];
  const result = await new Promise<{ bytes?: Buffer; type?: string; redirect?: string }>((resolve, reject) => {
    const req = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      agent: false,
      // The original hostname still controls HTTPS certificate verification/SNI.
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: chosen.address, family: chosen.family }]);
        else callback(null, chosen.address, chosen.family);
      },
      headers: { Accept: "image/*,video/*,audio/*,application/pdf,application/octet-stream;q=0.5", "User-Agent": "MPCS-Backup/1", "Accept-Encoding": "identity" },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.destroy(); resolve({ redirect: new URL(res.headers.location, url).href }); return;
      }
      if (status < 200 || status >= 300) { res.destroy(); reject(new Error(`Media HTTP ${status}`)); return; }
      const type = String(res.headers["content-type"] ?? "application/octet-stream").split(";")[0];
      if (/^(?:text\/html|application\/(?:xhtml\+xml|json))$/i.test(type)) { res.destroy(); reject(new Error("Media URL returned HTML/JSON, not a file")); return; }
      if (Number(res.headers["content-length"] ?? 0) > MAX_BYTES) { res.destroy(); reject(new Error("Remote media exceeds 32 MiB")); return; }
      const encoding = String(res.headers["content-encoding"] ?? "identity").toLowerCase();
      if (!["identity", "gzip", "deflate", "br"].includes(encoding)) { res.destroy(); reject(new Error("Unsupported media encoding")); return; }
      // Some CDNs compress despite the identity request. Restore the actual file
      // bytes, not a gzip wrapper mislabeled image/png. Bound decompressed bytes.
      const stream = encoding === "gzip" ? res.pipe(createGunzip()) : encoding === "deflate" ? res.pipe(createInflate()) : encoding === "br" ? res.pipe(createBrotliDecompress()) : res;
      if (stream !== res) res.on("error", (error) => stream.destroy(error));
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { stream.destroy(new Error("Remote media exceeds 32 MiB")); res.destroy(); return; }
        chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", () => resolve({ bytes: Buffer.concat(chunks), type }));
    });
    const timer = setTimeout(() => req.destroy(new Error("Media download timed out (20s)")), 20_000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
  if (result.redirect) return readRemoteMedia(result.redirect, redirects + 1);
  return { bytes: result.bytes!, type: result.type! };
}

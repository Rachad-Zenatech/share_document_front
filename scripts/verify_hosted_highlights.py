"""Verify that CloudFront serves this build's script-highlight assets after deployment."""
import argparse
import hashlib
from pathlib import Path
import re
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


def fetch(url):
    request = Request(url, headers={"Cache-Control": "no-cache", "Accept-Encoding": "identity"})
    with urlopen(request, timeout=15) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", required=True)
    parser.add_argument("--pattern", action="append", required=True)
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    if not origin.startswith("https://"):
        raise SystemExit("Hosted verification requires HTTPS")
    dist = Path("dist")
    assets = []
    for pattern in args.pattern:
        matches = list(dist.glob("assets/" + pattern))
        if not matches:
            raise SystemExit(f"No built asset matched {pattern}")
        assets.extend(matches)
    entries = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', (dist / "index.html").read_text(encoding="utf-8"))
    if not entries:
        raise SystemExit("The built index contains no asset references")
    assets = list(dict.fromkeys([*assets, *(dist / entry.lstrip("/") for entry in entries)]))
    content = "\n".join(path.read_text(encoding="utf-8") for path in assets if path.suffix in {".js", ".css"})
    if "script-embed:focus-passage" not in content or "script-embed:focus-result" not in content:
        raise SystemExit("Built release is missing the highlight request/response protocol")
    failure = "CloudFront has not propagated the new index yet"
    for attempt in range(30):
        try:
            index = fetch(origin + "/").decode("utf-8")
            if not all(entry in index for entry in entries):
                raise ValueError("The hosted index is still from a previous build")
            for path in assets:
                expected = hashlib.sha256(path.read_bytes()).digest()
                actual = hashlib.sha256(fetch(origin + "/" + path.relative_to(dist).as_posix())).digest()
                if expected != actual:
                    raise ValueError(f"Hosted asset does not match the built release: {path.name}")
            print(f"Verified hosted highlight protocol and {len(assets)} matching release assets at {origin}")
            return
        except (URLError, ValueError, TimeoutError) as error:
            failure = str(error)
            if attempt < 29:
                time.sleep(6)
    raise SystemExit(f"Hosted highlight verification failed: {failure}")


if __name__ == "__main__":
    main()

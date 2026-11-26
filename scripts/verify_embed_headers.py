"""Fail deployment if the hosted editor cannot be framed by the review portal."""
from urllib.request import Request, urlopen

from configure_embed_headers import PARENT


def verify(headers):
    if headers.get("X-Frame-Options"):
        raise ValueError("Hosted editor still sends X-Frame-Options")
    policies = headers.get_all("Content-Security-Policy", [])
    if not policies:
        raise ValueError("Hosted editor has no frame-ancestors policy")
    found = False
    for policy in policies:
        for directive in policy.split(";"):
            parts = directive.split()
            if parts and parts[0].lower() == "frame-ancestors":
                found = True
                if PARENT not in parts[1:] or "*" in parts[1:]:
                    raise ValueError("Hosted editor does not restrict framing to the trusted portal")
    if not found:
        raise ValueError("Hosted editor has no frame-ancestors directive")


if __name__ == "__main__":
    for path in ["/", "/embed/script/00000000-0000-0000-0000-000000000000"]:
        request = Request("https://d2oc5qgulk278o.cloudfront.net" + path, headers={"Cache-Control": "no-cache"})
        with urlopen(request, timeout=30) as response:
            verify(response.headers)
        print("Verified trusted review portal framing: " + path)

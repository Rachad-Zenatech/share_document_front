"""Preserve CloudFront settings while allowing the trusted review portal to frame documents."""
import copy
import hashlib
import json
import os
import subprocess
import tempfile

PARENT = "https://d8w82h0t7k8or.cloudfront.net"


def aws(operation, **arguments):
    command = ["aws", "cloudfront", operation, "--output", "json"]
    with tempfile.TemporaryDirectory() as directory:
        for key, value in arguments.items():
            if isinstance(value, dict):
                path = os.path.join(directory, key + ".json")
                with open(path, "w", encoding="utf-8") as stream:
                    json.dump(value, stream)
                value = "file://" + path
            command.extend(["--" + key.replace("_", "-"), str(value)])
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(f"CloudFront {operation} failed: {result.stderr.strip()}")
        return json.loads(result.stdout or "{}")


def framing_policy(original, distribution):
    # CloudFront returns empty objects for disabled settings, but rejects those
    # same objects in create requests because their required fields are absent.
    config = {key: copy.deepcopy(value) for key, value in original.items() if value != {}}
    security = config.setdefault("SecurityHeadersConfig", {})
    for key in list(security):
        if security[key] == {}:
            del security[key]
    security.pop("FrameOptions", None)
    custom = config.get("CustomHeadersConfig", {}).get("Items", [])
    custom_csp = next((item["Value"] for item in custom if item["Header"].lower() == "content-security-policy"), "")
    custom = [item for item in custom if item["Header"].lower() not in {"x-frame-options", "content-security-policy"}]
    if custom:
        config["CustomHeadersConfig"] = {"Quantity": len(custom), "Items": custom}
    else:
        config.pop("CustomHeadersConfig", None)
    csp = security.get("ContentSecurityPolicy", {}).get("ContentSecurityPolicy", custom_csp)
    directives = [part.strip() for part in csp.split(";") if part.strip() and part.split()[0].lower() != "frame-ancestors"]
    directives.append("frame-ancestors 'self' " + PARENT)
    security["ContentSecurityPolicy"] = {"Override": True, "ContentSecurityPolicy": "; ".join(directives)}
    removed = config.get("RemoveHeadersConfig", {}).get("Items", [])
    if not any(item["Header"].lower() == "x-frame-options" for item in removed):
        removed.append({"Header": "X-Frame-Options"})
    config["RemoveHeadersConfig"] = {"Quantity": len(removed), "Items": removed}
    config.pop("Name", None)
    config["Comment"] = "Allow hosted script review embedding; preserve other response headers"
    digest = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()[:12]
    config["Name"] = f"script-review-embed-{distribution}-{digest}"
    return config


def configure(distribution):
    if "." in distribution:
        items = aws("list-distributions").get("DistributionList", {}).get("Items", [])
        distribution = next(item["Id"] for item in items if item["DomainName"] == distribution)
    current = aws("get-distribution-config", id=distribution)
    config = copy.deepcopy(current["DistributionConfig"])
    existing = aws("list-response-headers-policies", type="custom").get("ResponseHeadersPolicyList", {}).get("Items", [])
    policies = {item["ResponseHeadersPolicy"]["ResponseHeadersPolicyConfig"]["Name"]: item["ResponseHeadersPolicy"]["Id"] for item in existing}
    replacements = {}
    for behavior in [config["DefaultCacheBehavior"], *config.get("CacheBehaviors", {}).get("Items", [])]:
        previous = behavior.get("ResponseHeadersPolicyId")
        if previous not in replacements:
            original = aws("get-response-headers-policy-config", id=previous)["ResponseHeadersPolicyConfig"] if previous else {}
            desired = framing_policy(original, distribution)
            policy_id = policies.get(desired["Name"])
            if not policy_id:
                created = aws("create-response-headers-policy", response_headers_policy_config=desired)
                policy_id = created["ResponseHeadersPolicy"]["Id"]
                policies[desired["Name"]] = policy_id
            replacements[previous] = policy_id
        behavior["ResponseHeadersPolicyId"] = replacements[previous]
    # The ETag guards against replacing a concurrent distribution update.
    if config != current["DistributionConfig"]:
        aws("update-distribution", id=distribution, if_match=current["ETag"], distribution_config=config)
    print("Waiting for trusted script embedding headers on distribution " + distribution)
    subprocess.run(["aws", "cloudfront", "wait", "distribution-deployed", "--id", distribution], check=True)


if __name__ == "__main__":
    configure(os.environ["CLOUDFRONT_DISTRIBUTION_ID"])

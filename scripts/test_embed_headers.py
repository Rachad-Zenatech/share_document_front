"""Regression checks for the hosted script editor's framing policy."""
import copy
from email.message import Message
import unittest

from configure_embed_headers import PARENT, framing_policy
from verify_embed_headers import verify


class EmbedHeadersTests(unittest.TestCase):
    def test_preserves_other_headers_and_does_not_mutate_shared_policy(self):
        original = {"Name": "managed", "SecurityHeadersConfig": {
            "FrameOptions": {"Override": True, "FrameOption": "SAMEORIGIN"},
            "StrictTransportSecurity": {"Override": True, "AccessControlMaxAgeSec": 31536000},
            "ContentSecurityPolicy": {"Override": True, "ContentSecurityPolicy": "default-src 'self'; frame-ancestors 'none'"}},
            "CorsConfig": {"OriginOverride": False}}
        snapshot = copy.deepcopy(original)
        result = framing_policy(original, "DIST")
        self.assertEqual(original, snapshot)
        self.assertEqual(result["CorsConfig"], original["CorsConfig"])
        self.assertEqual(result["SecurityHeadersConfig"]["StrictTransportSecurity"], original["SecurityHeadersConfig"]["StrictTransportSecurity"])
        self.assertNotIn("FrameOptions", result["SecurityHeadersConfig"])
        self.assertIn("default-src 'self'", result["SecurityHeadersConfig"]["ContentSecurityPolicy"]["ContentSecurityPolicy"])
        self.assertEqual(framing_policy(result, "DIST"), result)

    def test_custom_conflicting_headers_are_replaced(self):
        result = framing_policy({"CustomHeadersConfig": {"Quantity": 3, "Items": [
            {"Header": "X-Frame-Options", "Value": "DENY", "Override": True},
            {"Header": "Content-Security-Policy", "Value": "script-src 'self'", "Override": True},
            {"Header": "Example", "Value": "retained", "Override": True}]}}, "DIST")
        self.assertEqual(result["CustomHeadersConfig"]["Quantity"], 1)
        self.assertIn("script-src 'self'", result["SecurityHeadersConfig"]["ContentSecurityPolicy"]["ContentSecurityPolicy"])

    def test_live_check_rejects_browser_blocking_headers(self):
        headers = Message()
        headers["Content-Security-Policy"] = "frame-ancestors 'self' " + PARENT
        verify(headers)
        headers["X-Frame-Options"] = "SAMEORIGIN"
        with self.assertRaises(ValueError):
            verify(headers)
        del headers["X-Frame-Options"]
        headers["Content-Security-Policy"] = "frame-ancestors 'self'"
        with self.assertRaises(ValueError):
            verify(headers)


if __name__ == "__main__":
    unittest.main()

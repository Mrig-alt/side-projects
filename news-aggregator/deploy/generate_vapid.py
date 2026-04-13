#!/usr/bin/env python3
"""
Generate VAPID keys for Web Push notifications.

Run ONCE:
    pip install pywebpush
    python deploy/generate_vapid.py

Copy the output into your .env file. Never regenerate — changing keys
breaks all existing push subscriptions (users would need to re-enable
notifications in the browser).
"""

from pywebpush import Vapid

v = Vapid()
v.generate_keys()

print("# Add these to your .env file")
print(f"VAPID_PUBLIC_KEY={v.public_key_urlsafe}")
print(f"VAPID_PRIVATE_KEY={v.private_key_urlsafe}")
print(f"VAPID_EMAIL=mailto:you@example.com")
print()
print("Done. Keep VAPID_PRIVATE_KEY secret — treat it like an API key.")

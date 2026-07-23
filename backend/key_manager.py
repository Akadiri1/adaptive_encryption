"""
Key Manager — generates, caches, and retrieves cryptographic keys.
RSA keypairs are generated once and reused across encryptions.
"""
import uuid
import os
from Crypto.PublicKey import RSA


class KeyManager:
    def __init__(self):
        self.keys = {}
        # Cached RSA keypair — generated once, reused for all hybrid encryptions
        self._rsa_key_id = None

    def generate_symmetric_key(self, algorithm: str) -> str:
        """Generate a random symmetric key of the appropriate length."""
        key_id = str(uuid.uuid4())

        if algorithm in ("CHACHA20_POLY1305", "AES_256_GCM", "HYBRID_RSA_AES256"):
            key_len = 32
        elif algorithm == "AES_128_GCM":
            key_len = 16
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        key = os.urandom(key_len)
        self.keys[key_id] = {
            "algorithm": algorithm,
            "key": key,
            "private_key": None,
            "public_key": None,
        }
        return key_id

    def get_or_create_rsa_keypair(self) -> str:
        """Return the cached RSA-2048 keypair, generating it only on first call.

        RSA-2048 key generation involves a prime search that takes 0.5–3 s.
        The generated keypair is safe to reuse across many encrypt/decrypt
        operations — only the per-message AES session key changes each time.
        """
        if self._rsa_key_id is not None:
            return self._rsa_key_id

        key_id = str(uuid.uuid4())
        key = RSA.generate(2048)
        self.keys[key_id] = {
            "algorithm": "RSA_2048",
            "key": None,
            "private_key": key,
            "public_key": key.publickey(),
        }
        self._rsa_key_id = key_id
        return key_id

    def generate_rsa_keypair(self) -> str:
        """Convenience alias — always returns the cached keypair."""
        return self.get_or_create_rsa_keypair()

    def get_key(self, key_id: str) -> dict:
        if key_id not in self.keys:
            raise KeyError(f"Key {key_id} not found")
        return self.keys[key_id]

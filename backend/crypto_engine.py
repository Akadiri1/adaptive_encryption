import time
from Crypto.Cipher import ChaCha20_Poly1305, AES, PKCS1_OAEP
from Crypto.PublicKey import RSA
import os
from key_manager import KeyManager

class CryptoEngine:
    def encrypt(self, plaintext: bytes, algorithm: str, key_manager: KeyManager) -> dict:
        if algorithm == "HYBRID_RSA_AES256":
            rsa_key_id = key_manager.generate_rsa_keypair()
            sym_key_id = key_manager.generate_symmetric_key("AES_256_GCM")
            
            sym_key_dict = key_manager.get_key(sym_key_id)
            sym_key = sym_key_dict["key"]
            
            rsa_key_dict = key_manager.get_key(rsa_key_id)
            public_key = rsa_key_dict["public_key"]
            
            cipher_rsa = PKCS1_OAEP.new(public_key)
            enc_session_key = cipher_rsa.encrypt(sym_key)
            
            cipher_aes = AES.new(sym_key, AES.MODE_GCM)
            ciphertext, tag = cipher_aes.encrypt_and_digest(plaintext)
            
            return {
                "encrypted_data": ciphertext,
                "nonce": cipher_aes.nonce,
                "tag": tag,
                "key_id": rsa_key_id,
                "sym_key_id": sym_key_id,
                "rsa_encrypted_key": enc_session_key
            }
        else:
            key_id = key_manager.generate_symmetric_key(algorithm)
            key_dict = key_manager.get_key(key_id)
            key = key_dict["key"]
            
            if algorithm == "CHACHA20_POLY1305":
                cipher = ChaCha20_Poly1305.new(key=key)
                ciphertext, tag = cipher.encrypt_and_digest(plaintext)
                return {
                    "encrypted_data": ciphertext,
                    "nonce": cipher.nonce,
                    "tag": tag,
                    "key_id": key_id,
                    "rsa_encrypted_key": None
                }
            elif algorithm in ["AES_128_GCM", "AES_256_GCM"]:
                cipher = AES.new(key, AES.MODE_GCM)
                ciphertext, tag = cipher.encrypt_and_digest(plaintext)
                return {
                    "encrypted_data": ciphertext,
                    "nonce": cipher.nonce,
                    "tag": tag,
                    "key_id": key_id,
                    "rsa_encrypted_key": None
                }
            else:
                raise ValueError("Unknown algorithm")

    def decrypt(self, encrypted_data: bytes, algorithm: str, key_id: str, key_manager: KeyManager, nonce: bytes, tag: bytes, rsa_encrypted_key: bytes=None) -> bytes:
        if algorithm == "HYBRID_RSA_AES256":
            rsa_key_dict = key_manager.get_key(key_id)
            private_key = rsa_key_dict["private_key"]
            
            cipher_rsa = PKCS1_OAEP.new(private_key)
            session_key = cipher_rsa.decrypt(rsa_encrypted_key)
            
            cipher_aes = AES.new(session_key, AES.MODE_GCM, nonce=nonce)
            plaintext = cipher_aes.decrypt_and_verify(encrypted_data, tag)
            return plaintext
        else:
            key_dict = key_manager.get_key(key_id)
            key = key_dict["key"]
            
            if algorithm == "CHACHA20_POLY1305":
                cipher = ChaCha20_Poly1305.new(key=key, nonce=nonce)
                plaintext = cipher.decrypt_and_verify(encrypted_data, tag)
                return plaintext
            elif algorithm in ["AES_128_GCM", "AES_256_GCM"]:
                cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
                plaintext = cipher.decrypt_and_verify(encrypted_data, tag)
                return plaintext
            else:
                raise ValueError("Unknown algorithm")

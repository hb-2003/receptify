import binascii
from Cryptodome.Cipher import AES
from decouple import config

def get_encryption_key() -> bytes:
    secret = config('ENCRYPTION_KEY', default='')
    if not secret:
        # Fallback key matching TypeScript: crypto.scryptSync('development_fallback_key_receptify', 'salt', 32)
        import hashlib
        try:
            return hashlib.scrypt(
                password=b"development_fallback_key_receptify",
                salt=b"salt",
                n=16384,
                r=8,
                p=1,
                dklen=32
            )
        except AttributeError:
            from Cryptodome.Protocol.KDF import scrypt
            return scrypt(
                password=b"development_fallback_key_receptify",
                salt=b"salt",
                key_len=32,
                N=16384,
                r=8,
                p=1
            )
    
    # Ensure key is exactly 32 bytes via padding or slicing at the byte level
    encoded_secret = secret.encode('utf-8')
    if len(encoded_secret) < 32:
        return encoded_secret + b'0' * (32 - len(encoded_secret))
    return encoded_secret[:32]

def encrypt(text: str) -> str:
    key = get_encryption_key()
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(text.encode('utf-8'))
    
    iv_hex = binascii.hexlify(cipher.nonce).decode('utf-8')
    tag_hex = binascii.hexlify(tag).decode('utf-8')
    ciphertext_hex = binascii.hexlify(ciphertext).decode('utf-8')
    
    return f"{iv_hex}:{tag_hex}:{ciphertext_hex}"

def decrypt(encrypted_text: str) -> str:
    parts = encrypted_text.split(':')
    if len(parts) != 3:
        raise ValueError("Invalid encrypted text format.")
    
    iv = binascii.unhexlify(parts[0])
    tag = binascii.unhexlify(parts[1])
    ciphertext = binascii.unhexlify(parts[2])
    
    key = get_encryption_key()
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    decrypted_bytes = cipher.decrypt_and_verify(ciphertext, tag)
    
    return decrypted_bytes.decode('utf-8')

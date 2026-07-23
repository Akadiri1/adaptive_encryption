from dataclasses import dataclass
import uuid
from typing import Optional

@dataclass
class DataPacket:
    id: uuid.UUID
    sensitivity: str
    size_bytes: int
    payload: bytes
    label: str

@dataclass
class FogNode:
    node_id: str
    cpu_level: str
    battery_level: str
    bandwidth_level: str
    
    @property
    def resource_level(self) -> str:
        levels = {"constrained": 0, "medium": 1, "high": 2}
        cpu_val = levels.get(self.cpu_level, 0)
        batt_val = levels.get(self.battery_level, 0)
        
        min_val = min(cpu_val, batt_val)
        
        if min_val == 0:
            return "constrained"
        elif min_val == 1:
            return "medium"
        else:
            return "high"

@dataclass
class EncryptionResult:
    packet_id: uuid.UUID
    node_id: str
    algorithm: str
    encrypted_data: bytes
    nonce: bytes
    tag: Optional[bytes]
    key_id: str
    rsa_encrypted_key: Optional[bytes]
    encryption_time_ms: float
    cpu_usage_percent: float
    memory_usage_mb: float
    throughput_mbps: float

@dataclass
class DecryptionResult:
    packet_id: uuid.UUID
    decrypted_data: bytes
    decryption_time_ms: float
    success: bool

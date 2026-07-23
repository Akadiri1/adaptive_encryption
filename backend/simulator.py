"""
Simulator — generates fog nodes and data packets, then runs the
adaptive encryption simulation recording per-packet metrics.
"""
import uuid
import random
import time
import psutil
import os
from models import FogNode, DataPacket, EncryptionResult
from policy_engine import PolicyEngine
from crypto_engine import CryptoEngine
from key_manager import KeyManager


class Simulator:
    def __init__(self):
        self.policy_engine = PolicyEngine()
        self.crypto_engine = CryptoEngine()
        self.key_manager = KeyManager()

    def generate_fog_nodes(self, n=4) -> list:
        nodes = []
        profiles = [
            ("node-1", "constrained", "constrained", "constrained"),
            ("node-2", "constrained", "medium", "medium"),
            ("node-3", "medium", "medium", "medium"),
            ("node-4", "high", "high", "high"),
        ]
        for i in range(min(n, len(profiles))):
            nodes.append(FogNode(*profiles[i]))
        for i in range(len(profiles) + 1, n + 1):
            nodes.append(FogNode(f"node-{i}", "medium", "medium", "medium"))
        return nodes

    def generate_data_packets(self, n=50) -> list:
        packets = []
        sensitivities = ["low", "medium", "high"]
        weights = [0.40, 0.35, 0.25]
        sizes = [1024, 10240, 102400, 1048576]

        for i in range(n):
            sensitivity = random.choices(sensitivities, weights=weights)[0]
            size = random.choice(sizes)
            payload = os.urandom(size)
            packets.append(
                DataPacket(
                    id=uuid.uuid4(),
                    sensitivity=sensitivity,
                    size_bytes=size,
                    payload=payload,
                    label=f"Packet-{i + 1}",
                )
            )
        return packets

    def run_simulation(self, nodes: list, packets: list) -> list:
        process = psutil.Process()
        results = []

        # Warm-up: one throwaway encryption per algorithm to avoid cold-start spikes
        warmup = os.urandom(256)
        for algo in ["CHACHA20_POLY1305", "AES_128_GCM", "AES_256_GCM", "HYBRID_RSA_AES256"]:
            try:
                self.crypto_engine.encrypt(warmup, algo, self.key_manager)
            except Exception:
                pass

        for packet in packets:
            node = random.choice(nodes)
            algorithm = self.policy_engine.select_algorithm(
                packet.sensitivity, node.resource_level
            )

            mem_before = process.memory_info().rss
            cpu_before = time.process_time()
            wall_start = time.perf_counter()

            enc_dict = self.crypto_engine.encrypt(
                packet.payload, algorithm, self.key_manager
            )

            wall_end = time.perf_counter()
            cpu_after = time.process_time()
            mem_after = process.memory_info().rss

            elapsed_ms = (wall_end - wall_start) * 1000.0
            cpu_ms = (cpu_after - cpu_before) * 1000.0
            throughput = (
                (packet.size_bytes / 1024.0 / 1024.0) / (elapsed_ms / 1000.0)
                if elapsed_ms > 0
                else 0.0
            )
            mem_delta_mb = max(0, (mem_after - mem_before)) / (1024 * 1024)

            results.append(
                EncryptionResult(
                    packet_id=packet.id,
                    node_id=node.node_id,
                    algorithm=algorithm,
                    encrypted_data=enc_dict["encrypted_data"],
                    nonce=enc_dict["nonce"],
                    tag=enc_dict.get("tag"),
                    key_id=enc_dict["key_id"],
                    rsa_encrypted_key=enc_dict.get("rsa_encrypted_key"),
                    encryption_time_ms=round(elapsed_ms, 4),
                    cpu_usage_percent=round(cpu_ms, 4),  # actually CPU ms
                    memory_usage_mb=round(mem_delta_mb, 4),
                    throughput_mbps=round(throughput, 4),
                )
            )

        return results

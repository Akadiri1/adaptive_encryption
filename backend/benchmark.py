"""
Benchmark Runner — measures encryption/decryption performance across
all algorithms and data sizes.

CPU time is measured via time.process_time() (actual CPU seconds consumed
by this process), not psutil.cpu_percent() which is meaningless over
sub-millisecond windows.
"""
import time
import os
import psutil
import json
from key_manager import KeyManager
from crypto_engine import CryptoEngine


class BenchmarkRunner:
    def __init__(self):
        self.algorithms = [
            "CHACHA20_POLY1305",
            "AES_128_GCM",
            "AES_256_GCM",
            "HYBRID_RSA_AES256",
        ]
        self.sizes = {
            "1KB": 1024,
            "10KB": 10240,
            "100KB": 102400,
            "1MB": 1048576,
        }
        self.runs = 5  # averaged over 5 runs for stability
        self.key_manager = KeyManager()
        self.crypto_engine = CryptoEngine()

    def run_full_benchmark(self) -> dict:
        results = {}
        process = psutil.Process()

        # ── Warm-up pass ──────────────────────────────────────────────
        # Run one throwaway encryption per algorithm to eliminate JIT /
        # import / first-call overhead from the timed measurements.
        warmup_data = os.urandom(1024)
        for algo in self.algorithms:
            try:
                enc = self.crypto_engine.encrypt(warmup_data, algo, self.key_manager)
                self.crypto_engine.decrypt(
                    enc["encrypted_data"], algo, enc["key_id"],
                    self.key_manager, enc["nonce"], enc.get("tag"),
                    enc.get("rsa_encrypted_key"),
                )
            except Exception:
                pass  # warm-up failures are non-fatal

        # ── Timed runs ────────────────────────────────────────────────
        for algo in self.algorithms:
            algo_results = {}
            for size_label, size_bytes in self.sizes.items():
                total_enc_ms = 0.0
                total_dec_ms = 0.0
                total_cpu_ms = 0.0
                total_mem = 0.0

                for _ in range(self.runs):
                    data = os.urandom(size_bytes)

                    mem_before = process.memory_info().rss

                    # CPU time via process_time (actual CPU seconds consumed)
                    cpu_before = time.process_time()
                    wall_start = time.perf_counter()

                    enc_dict = self.crypto_engine.encrypt(data, algo, self.key_manager)

                    wall_enc = time.perf_counter()
                    cpu_after_enc = time.process_time()

                    enc_ms = (wall_enc - wall_start) * 1000.0
                    cpu_enc_ms = (cpu_after_enc - cpu_before) * 1000.0
                    total_enc_ms += enc_ms
                    total_cpu_ms += cpu_enc_ms

                    mem_after = process.memory_info().rss
                    total_mem += max(0, (mem_after - mem_before)) / (1024 * 1024)

                    # Decryption
                    wall_dec_start = time.perf_counter()

                    self.crypto_engine.decrypt(
                        enc_dict["encrypted_data"],
                        algo,
                        enc_dict["key_id"],
                        self.key_manager,
                        enc_dict["nonce"],
                        enc_dict.get("tag"),
                        enc_dict.get("rsa_encrypted_key"),
                    )

                    wall_dec_end = time.perf_counter()
                    total_dec_ms += (wall_dec_end - wall_dec_start) * 1000.0

                avg_enc_ms = total_enc_ms / self.runs
                avg_dec_ms = total_dec_ms / self.runs
                avg_cpu_ms = total_cpu_ms / self.runs
                avg_throughput = (
                    (size_bytes / 1024 / 1024) / (avg_enc_ms / 1000)
                    if avg_enc_ms > 0
                    else 0
                )

                algo_results[size_label] = {
                    "avg_encrypt_ms": round(avg_enc_ms, 4),
                    "avg_decrypt_ms": round(avg_dec_ms, 4),
                    "avg_throughput_mbps": round(avg_throughput, 4),
                    "avg_cpu_ms": round(avg_cpu_ms, 4),
                    "avg_memory_mb": round(total_mem / self.runs, 4),
                }

            results[algo] = algo_results
        return results

    def save_results(self, filepath: str, results: dict):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "w") as f:
            json.dump(results, f, indent=4)

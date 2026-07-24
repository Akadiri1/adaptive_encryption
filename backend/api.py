"""
FastAPI server for the Adaptive Encryption System.
Serves simulation results, benchmarks, and the dashboard.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os
import sys
sys.path.append(os.path.dirname(__file__))

from simulator import Simulator
from benchmark import BenchmarkRunner
from policy_engine import PolicyEngine
from key_manager import KeyManager
from crypto_engine import CryptoEngine

app = FastAPI(title="Adaptive Encryption System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared instances — single KeyManager so decrypt can find keys from simulation
key_manager = KeyManager()
crypto_engine = CryptoEngine()
policy_engine = PolicyEngine()
simulator = Simulator()
# Override simulator's key_manager so all keys end up in the same store
simulator.key_manager = key_manager
simulator.crypto_engine = crypto_engine
benchmark_runner = BenchmarkRunner()

# Store simulation results for later decrypt lookups
last_simulation_results = []
last_simulation_packets = {}


class DecryptRequest(BaseModel):
    packet_id: str
    encrypted_data: str
    algorithm: str
    key_id: str
    nonce: str
    tag: Optional[str] = None
    rsa_encrypted_key: Optional[str] = None


@app.get("/api/nodes")
def get_nodes():
    """Return fog node profiles."""
    nodes = simulator.generate_fog_nodes()
    return [
        {
            "node_id": n.node_id,
            "cpu_level": n.cpu_level,
            "battery_level": n.battery_level,
            "bandwidth_level": n.bandwidth_level,
            "resource_level": n.resource_level,
        }
        for n in nodes
    ]


@app.get("/api/simulate")
def simulate():
    """Run a full simulation and return results with all fields the dashboard needs."""
    global last_simulation_results, last_simulation_packets

    nodes = simulator.generate_fog_nodes()
    packets = simulator.generate_data_packets()

    # Build a lookup so we can attach packet metadata to results
    packet_map = {p.id: p for p in packets}
    last_simulation_packets = packet_map

    results = simulator.run_simulation(nodes, packets)
    last_simulation_results = results

    # Build node lookup for resource_level
    node_map = {n.node_id: n for n in nodes}

    response_items = []
    algorithms_used = set()
    total_time = 0.0

    for r in results:
        pkt = packet_map.get(r.packet_id)
        node = node_map.get(r.node_id)
        sensitivity = pkt.sensitivity if pkt else "unknown"
        size_bytes = pkt.size_bytes if pkt else 0
        resource_level = node.resource_level if node else "unknown"
        rationale = policy_engine.explain_decision(sensitivity, resource_level)

        algorithms_used.add(r.algorithm)
        total_time += r.encryption_time_ms

        response_items.append({
            "packet_id": str(r.packet_id),
            "node_id": r.node_id,
            "algorithm": r.algorithm,
            "sensitivity": sensitivity,
            "size_bytes": size_bytes,
            "rationale": rationale,
            "encrypted_data": base64.b64encode(r.encrypted_data).decode("utf-8"),
            "nonce": base64.b64encode(r.nonce).decode("utf-8"),
            "tag": base64.b64encode(r.tag).decode("utf-8") if r.tag else None,
            "key_id": r.key_id,
            "rsa_encrypted_key": base64.b64encode(r.rsa_encrypted_key).decode("utf-8") if r.rsa_encrypted_key else None,
            "encryption_time_ms": round(r.encryption_time_ms, 4),
            "cpu_usage_percent": round(r.cpu_usage_percent, 2),
            "memory_usage_mb": round(r.memory_usage_mb, 4),
            "throughput_mbps": round(r.throughput_mbps, 4),
        })

    return {
        "results": response_items,
        "summary": {
            "total_packets": len(results),
            "algorithms_used": list(algorithms_used),
            "avg_encryption_time_ms": round(total_time / len(results), 4) if results else 0,
        },
    }


@app.get("/api/benchmark")
def run_benchmark():
    """Run the full benchmark suite across all algorithms and data sizes."""
    results = benchmark_runner.run_full_benchmark()
    return {"results": results}


@app.post("/api/decrypt")
def decrypt(req: DecryptRequest):
    """Decrypt a previously encrypted packet using stored keys."""
    enc_data = base64.b64decode(req.encrypted_data)
    nonce = base64.b64decode(req.nonce)
    tag = base64.b64decode(req.tag) if req.tag else None
    rsa_key = base64.b64decode(req.rsa_encrypted_key) if req.rsa_encrypted_key else None

    try:
        import time
        start = time.perf_counter()
        dec_data = crypto_engine.decrypt(
            enc_data, req.algorithm, req.key_id, key_manager, nonce, tag, rsa_key
        )
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        return {
            "success": True,
            "decrypted_data": base64.b64encode(dec_data).decode("utf-8"),
            "decryption_time_ms": round(elapsed_ms, 4),
            "packet_id": req.packet_id,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/policy-table")
def get_policy_table():
    """Return the adaptive policy decision table."""
    table = policy_engine.get_decision_table()
    # Enrich with rationale
    enriched = []
    for entry in table:
        enriched.append({
            **entry,
            "rationale": policy_engine.explain_decision(
                entry["Sensitivity"], entry["Node Resources"]
            ),
        })
    return enriched


# Serve the dashboard as static files (mount AFTER API routes)
dashboard_path = os.path.join(os.path.dirname(__file__), "..", "dashboard")
if os.path.isdir(dashboard_path):
    app.mount("/", StaticFiles(directory=dashboard_path, html=True), name="dashboard")

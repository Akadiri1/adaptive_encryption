import argparse
import uvicorn
from simulator import Simulator
from benchmark import BenchmarkRunner
from api import app
import json
import os

def run_simulate():
    print("Running Simulation...")
    sim = Simulator()
    nodes = sim.generate_fog_nodes()
    packets = sim.generate_data_packets(10)
    results = sim.run_simulation(nodes, packets)
    
    print(f"{'Node':<10} | {'Algorithm':<20} | {'Time (ms)':<10} | {'Throughput (MB/s)':<15}")
    print("-" * 65)
    for r in results:
        print(f"{r.node_id:<10} | {r.algorithm:<20} | {r.encryption_time_ms:<10.3f} | {r.throughput_mbps:<15.3f}")

def run_benchmark():
    print("Running Benchmark...")
    runner = BenchmarkRunner()
    results = runner.run_full_benchmark()
    
    os.makedirs("results", exist_ok=True)
    filepath = "results/benchmark_results.json"
    runner.save_results(filepath, results)
    print(f"Results saved to {filepath}")
    print(json.dumps(results, indent=2))

def serve(port: int):
    print(f"Starting server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Adaptive Encryption System CLI")
    subparsers = parser.add_subparsers(dest="command")
    
    sim_parser = subparsers.add_parser("simulate", help="Run simulation")
    bench_parser = subparsers.add_parser("benchmark", help="Run benchmark")
    serve_parser = subparsers.add_parser("serve", help="Start API server")
    serve_parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    
    args = parser.parse_args()
    
    if args.command == "simulate":
        run_simulate()
    elif args.command == "benchmark":
        run_benchmark()
    elif args.command == "serve":
        serve(args.port)
    else:
        parser.print_help()

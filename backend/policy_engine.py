class PolicyEngine:
    def __init__(self):
        self.decision_table = [
            {"Sensitivity": "Low", "Node Resources": "Constrained", "Algorithm": "ChaCha20-Poly1305"},
            {"Sensitivity": "Low", "Node Resources": "Medium", "Algorithm": "AES-128-GCM"},
            {"Sensitivity": "Low", "Node Resources": "High", "Algorithm": "AES-128-GCM"},
            {"Sensitivity": "Medium", "Node Resources": "Constrained", "Algorithm": "AES-128-GCM"},
            {"Sensitivity": "Medium", "Node Resources": "Medium", "Algorithm": "AES-256-GCM"},
            {"Sensitivity": "Medium", "Node Resources": "High", "Algorithm": "AES-256-GCM"},
            {"Sensitivity": "High", "Node Resources": "Constrained", "Algorithm": "AES-256-GCM"},
            {"Sensitivity": "High", "Node Resources": "Medium", "Algorithm": "AES-256-GCM + RSA envelope"},
            {"Sensitivity": "High", "Node Resources": "High", "Algorithm": "AES-256-GCM + RSA-2048 envelope"},
        ]
        
        self.algorithm_map = {
            "ChaCha20-Poly1305": "CHACHA20_POLY1305",
            "AES-128-GCM": "AES_128_GCM",
            "AES-256-GCM": "AES_256_GCM",
            "AES-256-GCM + RSA envelope": "HYBRID_RSA_AES256",
            "AES-256-GCM + RSA-2048 envelope": "HYBRID_RSA_AES256"
        }

    def select_algorithm(self, sensitivity: str, resource_level: str) -> str:
        s_cap = sensitivity.capitalize()
        r_cap = resource_level.capitalize()
        
        for entry in self.decision_table:
            if entry["Sensitivity"] == s_cap and entry["Node Resources"] == r_cap:
                return self.algorithm_map[entry["Algorithm"]]
        
        return "AES_128_GCM"

    def explain_decision(self, sensitivity: str, resource_level: str) -> str:
        s_cap = sensitivity.capitalize()
        r_cap = resource_level.capitalize()
        
        for entry in self.decision_table:
            if entry["Sensitivity"] == s_cap and entry["Node Resources"] == r_cap:
                algo = entry["Algorithm"]
                return f"{s_cap} sensitivity data on {r_cap.lower()} node \u2192 {algo} selected."
        
        return "Unknown parameters"

    def get_decision_table(self) -> list:
        return self.decision_table

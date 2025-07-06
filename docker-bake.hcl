group "gpu" {
    targets = ["backend", "frontend", "worker-gpu"]
    description = "Build GPU images (without monitoring)"
}

group "cpu" {
    targets = ["backend", "frontend", "worker-cpu"]
    description = "Build CPU images (without monitoring)"
}


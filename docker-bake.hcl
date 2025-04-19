group "gpu" {
    targets = ["backend", "frontend", "worker-gpu"]
    description = "Build all GPU images"
}

group "cpu" {
    targets = ["backend", "frontend", "worker-cpu"]
    description = "Build all CPU images"
}


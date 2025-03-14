#!/bin/bash

# Enable garbage collection
export NODE_OPTIONS="--expose-gc"

# Run the benchmark
jest --runInBand --no-cache performance-comparison.test.ts
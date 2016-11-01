"""Generate visualization figures for the thesis.
Compatible with Python 2.7 and Matplotlib 1.4.
"""
from __future__ import print_function
import os
import json
import pandas as pd
import matplotlib
# Use Agg backend for non-interactive saving
matplotlib.use('Agg')
import matplotlib.pyplot as plt

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "img")
MEASUREMENTS_CSV = os.path.join(DATA_DIR, "measurements.csv")
PERFORMANCE_JSON = os.path.join(DATA_DIR, "analysis_performance.json")

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def plot_shrinkage_trends(df):
    print("Plotting shrinkage trends...")
    
    # 1. Temperature vs Length Factor
    plt.figure(figsize=(10, 6))
    groups = df.groupby('material')
    for name, group in groups:
        plt.plot(group.temperature_c, group.length_factor, marker='o', linestyle='', label=name)
    
    plt.title('Shrinkage vs Temperature')
    plt.xlabel('Temperature (C)')
    plt.ylabel('Length Factor')
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(OUT_DIR, "shrinkage_vs_temp.png"))
    plt.close()

    # 2. Dwell Time vs Length Factor
    plt.figure(figsize=(10, 6))
    for name, group in groups:
        plt.plot(group.dwell_min, group.length_factor, marker='x', linestyle='', label=name)
    
    plt.title('Shrinkage vs Dwell Time')
    plt.xlabel('Dwell Time (min)')
    plt.ylabel('Length Factor')
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(OUT_DIR, "shrinkage_vs_dwell.png"))
    plt.close()

def plot_distribution(df):
    print("Plotting distribution...")
    plt.figure(figsize=(10, 6))
    
    # Plot histogram for length factor
    df['length_factor'].hist(bins=20, alpha=0.7, label='Length')
    df['width_factor'].hist(bins=20, alpha=0.7, label='Width')
    
    plt.title('Distribution of Shrinkage Factors')
    plt.xlabel('Shrinkage Factor')
    plt.ylabel('Frequency')
    plt.legend()
    plt.savefig(os.path.join(OUT_DIR, "shrinkage_distribution.png"))
    plt.close()

def plot_performance():
    print("Plotting performance metrics...")
    if not os.path.exists(PERFORMANCE_JSON):
        print("Performance data not found, skipping.")
        return

    with open(PERFORMANCE_JSON, 'r') as f:
        data = json.load(f)
    
    scaling = data.get('scaling', [])
    if not scaling:
        return

    workers = [x['workers'] for x in scaling]
    speedup = [x['speedup'] for x in scaling]
    
    # 1. Speedup
    plt.figure(figsize=(10, 6))
    plt.plot(workers, speedup, 'b-o', label='Measured Speedup')
    # Ideal speedup
    plt.plot(workers, workers, 'k--', label='Ideal Linear Speedup')
    
    plt.title('Parallel Speedup (Multiprocessing)')
    plt.xlabel('Number of Workers (Cores)')
    plt.ylabel('Speedup Factor')
    plt.grid(True)
    plt.legend()
    plt.savefig(os.path.join(OUT_DIR, "parallel_speedup.png"))
    plt.close()

    # 2. Efficiency (Speedup / Workers)
    efficiency = [s / float(w) for s, w in zip(speedup, workers)]
    
    plt.figure(figsize=(10, 6))
    plt.plot(workers, efficiency, 'r-o')
    plt.ylim(0, 1.1)
    plt.title('Parallel Efficiency')
    plt.xlabel('Number of Workers (Cores)')
    plt.ylabel('Efficiency (Speedup/Workers)')
    plt.grid(True)
    plt.savefig(os.path.join(OUT_DIR, "parallel_efficiency.png"))
    plt.close()

def main():
    ensure_dir(OUT_DIR)
    
    if os.path.exists(MEASUREMENTS_CSV):
        df = pd.read_csv(MEASUREMENTS_CSV)
        plot_shrinkage_trends(df)
        plot_distribution(df)
    else:
        print("Measurements CSV not found.")

    plot_performance()
    print("Figures generated in: " + OUT_DIR)

if __name__ == "__main__":
    main()
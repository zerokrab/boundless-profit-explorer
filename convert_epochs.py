#!/usr/bin/env python3
import csv
import json
import os
import re


def parse_scaled_number(value: str) -> float:
    value = value.strip()
    m = re.match(r"^([\d.]+)([TGMK]?)$", value)
    if not m:
        return 0.0
    num = float(m.group(1))
    suffix = m.group(2)
    multipliers = {"T": 1e12, "G": 1e9, "M": 1e6, "K": 1e3, "": 1}
    return num * multipliers.get(suffix, 1)


def parse_price(value: str) -> float:
    value = value.strip().replace("$", "")
    return float(value) if value else 0.0


def parse_zkc_amount(value: str) -> float:
    value = re.sub(r"\s*ZKC\s*$", "", value.strip())
    value = value.replace(",", "")
    m = re.match(r"^([\d.]+)([KMT]?)$", value)
    if not m:
        return 0.0
    num = float(m.group(1))
    suffix = m.group(2)
    multipliers = {"T": 1e12, "M": 1e6, "K": 1e3, "": 1}
    return num * multipliers.get(suffix, 1)


def main() -> None:
    input_path = "epochs.csv"
    output_path = "src/data/epochs.json"
    results = []

    with open(input_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            results.append(
                {
                    "epoch": int(row["Epoch"]),
                    "timestamp": row["Timestamp"],
                    "zkc_price_usd": parse_price(row["ZKC Price (USD)"]),
                    "total_cycles": parse_scaled_number(row["Total Cycles"]),
                    "mining_rewards_zkc": parse_zkc_amount(row["Mining Rewards (ZKC)"]),
                }
            )

    os.makedirs("src/data", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"Converted {len(results)} epochs from {input_path}")
    if results:
        print(f"Latest epoch in output: {results[0]['epoch']}")


if __name__ == "__main__":
    main()

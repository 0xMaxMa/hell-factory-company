#!/usr/bin/env python3
"""test-echo: print timestamp + Hello World."""
import argparse
import datetime

def main():
    parser = argparse.ArgumentParser(description="test-echo job")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without side effects")
    args = parser.parse_args()

    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if args.dry_run:
        print(f"[DRY-RUN] Would print: [{ts}] Hello World")
    else:
        print(f"[{ts}] Hello World")

if __name__ == "__main__":
    main()

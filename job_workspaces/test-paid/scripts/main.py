#!/usr/bin/env python3
import datetime

ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
print(f"[{ts}] PAID JOB OK")

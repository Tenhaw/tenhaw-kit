"""Generate package assets from /spec; --check prevents published schema drift."""

from __future__ import annotations

import argparse
from pathlib import Path

ASSETS = {
    "tenhaw-ai-readiness": ("readiness-framework.v1.json", "readiness-response.schema.json"),
    "tenhaw-ai-roi": ("roi-defaults.v1.json", "roi-input.schema.json"),
    "tenhaw-delivery-metrics": ("delivery-events.schema.json", "delivery-report.schema.json"),
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    for package, names in ASSETS.items():
        for name in names:
            source = root / "spec" / ("schemas" if ".schema." in name else "content") / name
            target = root / "python" / package / "src" / package.replace("-", "_") / "data" / name
            contents = source.read_bytes()
            if arguments.check:
                if not target.is_file() or target.read_bytes() != contents:
                    raise ValueError(f"Generated asset is stale: {target.relative_to(root)}")
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(contents)
    for package in ["tenhaw", *ASSETS]:
        for licence in ["LICENSE", "LICENSE-CONTENT"]:
            source = root / licence
            target = root / "python" / package / licence
            if arguments.check:
                if not target.is_file() or target.read_bytes() != source.read_bytes():
                    raise ValueError(f"Packaged licence is stale: {target.relative_to(root)}")
            else:
                target.write_bytes(source.read_bytes())
    print("Python package assets match shared spec")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

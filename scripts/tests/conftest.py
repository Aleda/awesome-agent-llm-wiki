"""Make `scripts/` importable as the `lib` package root when running
`pytest scripts/tests` from the repo root (no package installation step —
this project has no setup.py/pyproject, just PEP 723 inline deps).
"""

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

make test
glib-compile-schemas --strict --dry-run src/schemas
make pack

python3 - <<'PY'
import json
import pathlib
import zipfile

metadata = json.loads(pathlib.Path('src/metadata.json').read_text())
archive_path = pathlib.Path(f"{metadata['uuid']}.shell-extension.zip")

required = {
    'extension.js',
    'metadata.json',
    'prefs.js',
    'schemas/gschemas.compiled',
    'LICENSE',
    'NOTICE',
}

with zipfile.ZipFile(archive_path) as archive:
    missing = required - set(archive.namelist())
    if missing:
        raise SystemExit(f"release archive is missing: {', '.join(sorted(missing))}")
    packaged_metadata = json.loads(archive.read('metadata.json'))

if packaged_metadata['version-name'] != metadata['version-name']:
    raise SystemExit('packaged metadata version does not match source metadata')

print(f"release archive verified: {archive_path}")
PY

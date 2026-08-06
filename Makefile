UUID := monitor-pointer-lock@incirci.github.io
SRC := $(CURDIR)/src
TARGET := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: schemas test install uninstall enable disable status pack

schemas:
	glib-compile-schemas $(SRC)/schemas

test:
	node --test tests/*.test.mjs

install: schemas
	@if [ -e "$(TARGET)" ] && [ ! -L "$(TARGET)" ]; then \
		echo "ERROR: $(TARGET) exists and is not a symlink. Remove the old installed copy first."; exit 1; \
	fi
	@rm -f "$(TARGET)"
	@ln -s "$(SRC)" "$(TARGET)"
	@echo "Installed development link: $(TARGET)"

uninstall:
	@if [ -L "$(TARGET)" ]; then rm -f "$(TARGET)"; echo "Uninstalled development link"; \
	else echo "Nothing to uninstall"; fi

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

status:
	gnome-extensions info $(UUID)

pack: schemas
	@python3 -c "$$PACK_SCRIPT"

define PACK_SCRIPT
import pathlib, zipfile

root = pathlib.Path('.')
src = root / 'src'
out = root / '$(UUID).shell-extension.zip'
members = sorted(p for p in src.rglob('*') if p.is_file())

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in members:
        info = zipfile.ZipInfo(str(path.relative_to(src)), (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
    for name in ('LICENSE', 'NOTICE'):
        info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (root / name).read_bytes())

print(f'packed {out}')
endef
export PACK_SCRIPT

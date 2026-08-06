# Public release checklist

Complete this checklist before changing repository visibility or creating the first release.

## Repository and GitHub settings

- [ ] Scan the full Git history for credentials and personal information. Enable GitHub secret scanning and push protection if available for the repository.
- [ ] Set the repository description: `GNOME Shell extension that keeps the pointer on its current monitor until Ctrl is held to cross a display edge.`
- [ ] Add topics: `gnome-shell-extension`, `gnome`, `wayland`, `multi-monitor`, `pointer-barrier`.
- [ ] Enable **Private vulnerability reporting** in the repository Security settings.
- [ ] Protect `main`: require the CI status check before merging, and decide whether direct pushes should be allowed for the maintainer.

## Documentation and release material

- [ ] Add a real screenshot or short GIF showing blocked crossing and Ctrl-gated crossing. Do not use a mock image.
- [ ] Check the README against a fresh GNOME Shell 46 Wayland install.
- [ ] Run `make release-check`.
- [ ] Install the resulting ZIP with `gnome-extensions install --force …` on a clean account or machine, then log out/in and test it.
- [ ] Update `src/metadata.json` and `.github/release-notes.md` for the release version.
- [ ] Push the matching tag, for example `git tag v1.0.0 && git push origin v1.0.0`; the release workflow publishes the ZIP.

## GNOME Extensions website (optional)

- [ ] Review the current GNOME Extensions submission guidelines before uploading. The submitter should understand and be able to maintain the extension code.
- [ ] Confirm the license approach is appropriate for the intended GNOME Extensions distribution.

# Version changes

Run `pnpm changeset` for a public behaviour or schema change. The nine npm distributions share one release version. Merge the version PR after updating Python project versions, plugin manifests, MCP metadata and install examples to the same version. The release script rejects version drift before publishing.

Publication runs directly in `.github/workflows/release.yml` through the protected `release` environment. A version commit or tag alone never publishes packages or starts satellite pushes.

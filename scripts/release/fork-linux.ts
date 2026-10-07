#!/usr/bin/env bun
/**
 * Release this checkout to a private GitHub repository whose releases the
 * app's updater reads (see update-feed.ts).
 *
 *   bun scripts/release/fork-linux.ts <owner/repo>
 *
 * Tags HEAD `v<version>`, one patch above both the checkout and the repo's
 * latest release, and pushes the branch and tag. The tag runs
 * .github/workflows/fork-release-linux.yml there, which builds the AppImage
 * with SUPERSET_UPDATE_GITHUB_REPO baked in and publishes it with its
 * latest-linux.yml manifest.
 */
import { $ } from "bun";
import semver from "semver";
import { DESKTOP_PACKAGE, incrementPatch, readVersion, repoRoot } from "./lib";

const repo = process.argv[2];
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
	console.error("usage: bun scripts/release/fork-linux.ts <owner/repo>");
	process.exit(1);
}

const root = await repoRoot();
if ((await $`git -C ${root} status --porcelain`.text()).trim()) {
	console.error("Working tree is not clean; commit or stash first.");
	process.exit(1);
}

const current = readVersion(root, DESKTOP_PACKAGE);
const published = (
	await $`gh release view --repo ${repo} --json tagName -q .tagName`
		.nothrow()
		.quiet()
		.text()
)
	.trim()
	.replace(/^v/, "");
const base =
	semver.valid(published) && semver.gt(published, current)
		? published
		: current;
const next = incrementPatch(base);
if (!next) throw new Error(`Cannot bump ${base}`);
const tag = `v${next}`;

console.log(
	`Releasing ${tag} to ${repo} (checkout ${current}, published ${published || "none"})`,
);
await $`git -C ${root} tag ${tag}`;
await $`git -C ${root} push ${`https://github.com/${repo}.git`} HEAD:main ${tag}`;
console.log(
	`Building in Actions: https://github.com/${repo}/actions/workflows/fork-release-linux.yml`,
);

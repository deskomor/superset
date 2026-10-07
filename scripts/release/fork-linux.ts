#!/usr/bin/env bun
/**
 * Release a Linux AppImage of this checkout to a private GitHub repository
 * whose releases the app's updater reads (see update-feed.ts).
 *
 *   bun scripts/release/fork-linux.ts <owner/repo>
 *
 * Patch-bumps the unified version above both the checkout and the repo's
 * latest release, commits and tags it, builds with
 * SUPERSET_UPDATE_GITHUB_REPO baked in, pushes, and publishes the AppImage
 * with its latest-linux.yml manifest.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import semver from "semver";
import {
	DESKTOP_PACKAGE,
	incrementPatch,
	readVersion,
	refreshLockfile,
	repoRoot,
	syncUnified,
	writeVersion,
} from "./lib";

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

await writeVersion(root, DESKTOP_PACKAGE, next);
await syncUnified(root, next);
await refreshLockfile(root);
await $`git -C ${root} commit -am ${`release: ${tag}`}`;
await $`git -C ${root} tag ${tag}`;

const desktop = join(root, DESKTOP_PACKAGE);
const env = { ...process.env, SUPERSET_UPDATE_GITHUB_REPO: repo };
await $`bun run prebuild`.cwd(desktop).env(env);
await $`bun run build --linux AppImage`.cwd(desktop).env(env);

const appImage = join(desktop, "release", `superset-${next}-x86_64.AppImage`);
const manifest = join(desktop, "release", "latest-linux.yml");
for (const file of [appImage, manifest]) {
	if (!existsSync(file)) throw new Error(`Build did not produce ${file}`);
}

await $`git -C ${root} push ${`https://github.com/${repo}.git`} HEAD:main ${tag}`;
await $`gh release create ${tag} --repo ${repo} --title ${`Superset ${next}`} --notes ${`Linux build of ${next} from ${(await $`git -C ${root} rev-parse --short HEAD`.text()).trim()}.`} ${appImage} ${manifest}`;
console.log(`Published ${tag}: https://github.com/${repo}/releases/tag/${tag}`);

import { randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	open,
	readFile,
	rename,
	rmdir,
	unlink,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { resolveSupersetHomeDir } from "@superset/agent-setup/paths";
import {
	applyRoadmapActions,
	emptyRoadmap,
	ROADMAP_MAX_BYTES,
	type Roadmap,
	type RoadmapAction,
	type RoadmapActor,
	RoadmapError,
	validateRoadmap,
} from "@superset/shared/roadmap";

const LOCK_TIMEOUT_MS = 5000;

interface LockOwner {
	pid: number;
	nonce: string;
	at: number;
}

export interface RoadmapStore {
	readRoadmap(projectId: string): Promise<Roadmap>;
	mutateRoadmap(
		projectId: string,
		expectedRevision: number,
		actions: RoadmapAction[],
		actor: RoadmapActor,
	): Promise<Roadmap>;
}

function isMissing(error: unknown) {
	return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

async function statOrNull(target: string) {
	try {
		return await lstat(target);
	} catch (error) {
		if (isMissing(error)) return null;
		throw error;
	}
}

function alive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== "ESRCH";
	}
}

async function lockOwner(lock: string): Promise<LockOwner | null | "pending"> {
	const stat = await statOrNull(lock);
	if (!stat) return null;
	try {
		const owner = JSON.parse(
			await readFile(path.join(lock, "owner.json"), "utf8"),
		);
		if (
			Number.isSafeInteger(owner?.pid) &&
			owner.pid > 0 &&
			typeof owner.nonce === "string"
		)
			return owner as LockOwner;
	} catch {}
	return "pending";
}

async function acquireLock(lock: string): Promise<() => Promise<void>> {
	const owner: LockOwner = {
		pid: process.pid,
		nonce: randomUUID(),
		at: Date.now(),
	};
	const ownerFile = path.join(lock, "owner.json");
	const deadline = Date.now() + LOCK_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			await mkdir(lock);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			const current = await lockOwner(lock);
			if (current && current !== "pending" && !alive(current.pid)) {
				// The non-empty tombstone keeps a concurrent recoverer from renaming a fresh lock over it.
				const verified = await lockOwner(lock);
				if (verified !== "pending" && verified?.nonce === current.nonce)
					await rename(lock, `${lock}.retired-${current.nonce}`).catch(
						() => {},
					);
			}
			await delay(25 + Math.floor(Math.random() * 30));
			continue;
		}
		try {
			const handle = await open(ownerFile, "wx", 0o600);
			try {
				await handle.writeFile(JSON.stringify(owner));
				await handle.sync();
			} finally {
				await handle.close();
			}
		} catch (error) {
			await unlink(ownerFile).catch(() => {});
			await rmdir(lock).catch(() => {});
			throw error;
		}
		return async () => {
			const current = await lockOwner(lock);
			if (current === "pending" || current?.nonce !== owner.nonce) return;
			await unlink(ownerFile);
			await rmdir(lock);
		};
	}
	throw new RoadmapError(
		"busy",
		"Another Roadmap write is in progress. Try again in a moment.",
	);
}

async function readFileRoadmap(file: string): Promise<Roadmap> {
	let raw: string;
	try {
		const handle = await open(file, "r");
		try {
			if ((await handle.stat()).size > ROADMAP_MAX_BYTES)
				throw new RoadmapError(
					"too_large",
					"The Roadmap document is too large.",
				);
			raw = await handle.readFile({ encoding: "utf8" });
		} finally {
			await handle.close();
		}
	} catch (error) {
		if (isMissing(error)) return emptyRoadmap();
		throw error;
	}
	try {
		return validateRoadmap(JSON.parse(raw));
	} catch {
		throw new RoadmapError(
			"corrupt",
			`The Roadmap document ${file} is unreadable or invalid. It is kept intact; restore a valid copy before you change it.`,
		);
	}
}

async function writeFileRoadmap(file: string, doc: Roadmap) {
	const data = `${JSON.stringify(doc, null, 2)}\n`;
	if (Buffer.byteLength(data) > ROADMAP_MAX_BYTES)
		throw new RoadmapError(
			"too_large",
			"The Roadmap document exceeds the 4 MiB limit.",
		);
	const temporary = path.join(
		path.dirname(file),
		`.${path.basename(file)}-${randomUUID()}.tmp`,
	);
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(data, "utf8");
			await handle.sync();
		} finally {
			await handle.close();
		}
		await rename(temporary, file);
	} finally {
		await unlink(temporary).catch(() => {});
	}
}

/** Private per-project Roadmaps under `<baseDir>/<projectId>.json`. */
export function createRoadmapStore(
	baseDir = path.join(resolveSupersetHomeDir(), "roadmaps"),
): RoadmapStore {
	const queues = new Map<string, Promise<unknown>>();
	const fileFor = (projectId: string) => {
		if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(projectId))
			throw new RoadmapError("invalid", "Invalid project id.");
		return path.join(baseDir, `${projectId}.json`);
	};
	return {
		readRoadmap: (projectId) => readFileRoadmap(fileFor(projectId)),
		async mutateRoadmap(projectId, expectedRevision, actions, actor) {
			const file = fileFor(projectId);
			const operation = (queues.get(file) ?? Promise.resolve())
				.catch(() => {})
				.then(async () => {
					await mkdir(baseDir, { recursive: true, mode: 0o700 });
					const release = await acquireLock(`${file}.lock`);
					try {
						const before = await readFileRoadmap(file);
						const after = applyRoadmapActions(before, actions, actor, {
							expectedRevision,
						});
						if (after !== before) await writeFileRoadmap(file, after);
						return after;
					} finally {
						await release();
					}
				});
			queues.set(file, operation);
			try {
				return await operation;
			} finally {
				if (queues.get(file) === operation) queues.delete(file);
			}
		},
	};
}

export const roadmapStore = createRoadmapStore();

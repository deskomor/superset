import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decrypt } from "@superset/shared/auth-token-crypto";
import { SUPERSET_HOME_DIR } from "./config";

export interface DesktopSession {
	token: string;
	expiresAt: number;
	organizationIds: string[];
}

/**
 * The session the desktop app saved on this machine (auth-token.enc), so a
 * host-service can start without a separate CLI login. Null when the desktop
 * has never signed in here or the file cannot be read.
 */
export function readDesktopSession(): DesktopSession | null {
	const file = join(SUPERSET_HOME_DIR, "auth-token.enc");
	if (!existsSync(file)) return null;
	try {
		const parsed: unknown = JSON.parse(decrypt(readFileSync(file)));
		if (!parsed || typeof parsed !== "object") return null;
		const { token, expiresAt, organizationIds } = parsed as Record<
			string,
			unknown
		>;
		if (typeof token !== "string" || !token) return null;
		const expires = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
		if (Number.isNaN(expires)) return null;
		return {
			token,
			expiresAt: expires,
			organizationIds: Array.isArray(organizationIds)
				? organizationIds.filter(
						(id): id is string => typeof id === "string" && id.length > 0,
					)
				: [],
		};
	} catch {
		return null;
	}
}

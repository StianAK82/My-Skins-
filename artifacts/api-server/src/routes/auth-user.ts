import { Router, type IRouter } from "express";
import { db, usersTable, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clearSession, getSessionId } from "../lib/auth";

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  let [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    [profile] = await db.insert(userProfilesTable).values({
      userId,
      displayName: user.firstName ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}` : null,
    }).returning();
  }

  res.json({
    id: user.id,
    email: user.email,
    username: profile.username,
    displayName: profile.displayName ?? user.firstName ?? "Creator",
    avatarUrl: user.profileImageUrl,
    language: profile.language,
    timezone: profile.timezone,
    plan: profile.plan,
    aiCredits: profile.aiCredits,
    credits: user.credits,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const sid = getSessionId(req);
  if (sid) {
    await clearSession(res, sid);
  }
  res.json({ success: true, message: "Logged out" });
});

router.patch("/auth/profile", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { displayName, language, timezone } = req.body;
  const userId = req.user.id;

  const updates: Record<string, unknown> = {};
  if (displayName != null) updates.displayName = displayName;
  if (language != null) updates.language = language;
  if (timezone != null) updates.timezone = timezone;

  let [profile] = await db
    .insert(userProfilesTable)
    .values({ userId, ...updates })
    .onConflictDoUpdate({ target: userProfilesTable.userId, set: updates })
    .returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    id: user.id,
    email: user.email,
    username: profile.username,
    displayName: profile.displayName ?? user?.firstName ?? "Creator",
    avatarUrl: user?.profileImageUrl,
    language: profile.language,
    timezone: profile.timezone,
    plan: profile.plan,
    aiCredits: profile.aiCredits,
    credits: user.credits,
    createdAt: user.createdAt,
  });
});

export default router;

const { randomBytes } = require("node:crypto");
const { requireText } = require("./community-rooms");

const pageSize = 12;
const reelIdPattern = /^[a-f0-9]{64}$/;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function readPublication(input) {
  const reelId = input?.reelId;
  if (typeof reelId !== "string" || !reelIdPattern.test(reelId)) fail(400, "Choose a valid rendered reel.");
  const title = requireText(input.title, "a reel title", 120).replace(/\s+/g, " ");
  return { reelId, title };
}

function createCommunityReels(db, { now = Date.now } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_reel_owners (
      user_id INTEGER PRIMARY KEY REFERENCES community_users(id) ON DELETE CASCADE,
      scope TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS community_reels (
      id INTEGER PRIMARY KEY,
      reel_id TEXT NOT NULL UNIQUE,
      creator_id INTEGER NOT NULL REFERENCES community_users(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      removed_at TEXT,
      owner_scope TEXT
    );
    CREATE INDEX IF NOT EXISTS community_reels_by_creator ON community_reels(creator_id) WHERE removed_at IS NULL;

    CREATE TABLE IF NOT EXISTS community_reel_likes (
      post_id INTEGER NOT NULL REFERENCES community_reels(id),
      user_id INTEGER NOT NULL REFERENCES community_users(id),
      PRIMARY KEY (post_id, user_id)
    );
  `);
  inTransaction(() => {
    if (!db.prepare("PRAGMA table_info(community_reels)").all().some(column => column.name === "owner_scope")) {
      db.exec("ALTER TABLE community_reels ADD COLUMN owner_scope TEXT");
    }
  });

  const publicRows = `
    SELECT reel.id, reel.title, user.username, reel.created_at AS createdAt,
      (SELECT COUNT(*) FROM community_reel_likes WHERE post_id = reel.id) AS likes,
      EXISTS(SELECT 1 FROM community_reel_likes WHERE post_id = reel.id AND user_id = $viewer) AS liked,
      reel.creator_id = $viewer AS canRemove
    FROM community_reels reel JOIN community_users user ON user.id = reel.creator_id
    WHERE reel.removed_at IS NULL
  `;
  const readPage = db.prepare(`${publicRows} AND ($before IS NULL OR reel.id < $before) ORDER BY reel.id DESC LIMIT ${pageSize + 1}`);
  const readPost = db.prepare(`${publicRows} AND reel.id = $id`);
  const findByReel = db.prepare("SELECT id, creator_id AS creatorId, removed_at AS removedAt FROM community_reels WHERE reel_id = ?");
  const findPublished = db.prepare("SELECT reel_id AS reelId, creator_id AS creatorId, owner_scope AS scope FROM community_reels WHERE id = ? AND removed_at IS NULL");
  const insertPost = db.prepare("INSERT INTO community_reels (reel_id, creator_id, title, created_at, owner_scope) VALUES (?, ?, ?, ?, ?) RETURNING id");
  const readScope = db.prepare("SELECT scope FROM community_reel_owners WHERE user_id = ?");
  const readOwner = db.prepare("SELECT user_id AS userId FROM community_reel_owners WHERE scope = ?");
  const insertScope = db.prepare("INSERT INTO community_reel_owners (user_id, scope) VALUES (?, ?) ON CONFLICT (user_id) DO NOTHING");
  const restorePost = db.prepare("UPDATE community_reels SET title = ?, removed_at = NULL WHERE id = ?");
  const removePost = db.prepare("UPDATE community_reels SET removed_at = ? WHERE id = ? AND creator_id = ? AND removed_at IS NULL");
  const insertLike = db.prepare("INSERT INTO community_reel_likes (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING");
  const deleteLike = db.prepare("DELETE FROM community_reel_likes WHERE post_id = ? AND user_id = ?");
  const clearLikes = db.prepare("DELETE FROM community_reel_likes WHERE post_id = ?");

  function inTransaction(action) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function present(row) {
    return {
      ...row,
      liked: Boolean(row.liked),
      canRemove: Boolean(row.canRemove),
      videoUrl: `/api/community/reels/${row.id}/video`,
    };
  }

  function list(viewer, before) {
    const rows = readPage.all({ viewer, before });
    const page = rows.slice(0, pageSize);
    return { reels: page.map(present), nextCursor: rows.length > pageSize ? page.at(-1).id : null };
  }

  function scopeFor(userId) {
    const existing = readScope.get(userId);
    if (existing) return existing.scope;
    insertScope.run(userId, randomBytes(24).toString("hex"));
    return readScope.get(userId).scope;
  }

  function publish({ reelId, title }, viewer, scope) {
    return inTransaction(() => {
      const existing = findByReel.get(reelId);
      if (existing && existing.creatorId !== viewer) fail(409, "This rendered reel already belongs to another student’s post.");
      if (existing?.removedAt) restorePost.run(title, existing.id);
      const id = existing?.id ?? insertPost.get(reelId, viewer, title, new Date(now()).toISOString(), scope).id;
      return { created: !existing, reel: present(readPost.get({ id, viewer })) };
    });
  }

  function requirePublished(id) {
    const reel = findPublished.get(id);
    if (!reel) fail(404, "Shared reel not found.");
    return reel;
  }

  function setLike(id, viewer, liked) {
    if (typeof liked !== "boolean") fail(400, "Choose whether to like this reel.");
    return inTransaction(() => {
      const reel = requirePublished(id);
      if (reel.creatorId === viewer) fail(403, "You can like reels from other students.");
      (liked ? insertLike : deleteLike).run(id, viewer);
      const updated = readPost.get({ id, viewer });
      return { likes: updated.likes, liked: Boolean(updated.liked) };
    });
  }

  function remove(id, viewer) {
    return inTransaction(() => {
      const result = removePost.run(new Date(now()).toISOString(), id, viewer);
      if (!result.changes) fail(404, "Shared reel not found.");
      clearLikes.run(id);
      return { removed: true };
    });
  }

  return { list, publish, setLike, remove, requirePublished, scopeFor, ownerFor: scope => readOwner.get(scope)?.userId };
}

module.exports = { createCommunityReels, readPublication };

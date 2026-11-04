const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openCommunity } = require("../server/community");

test("HTTPS auth uses a host-only cookie and stores independently salted password hashes", async t => {
  const { auth, db } = openCommunity(":memory:");
  t.after(() => db.close());
  const password = "test-only login passphrase";
  const first = await auth.register({ username: "first_student", password }, { secure: true });
  const second = await auth.register({ username: "second_student", password }, { secure: true });
  const [firstStored, secondStored] = db.prepare("SELECT password_salt, password_hash FROM community_users ORDER BY id").all();
  assert.equal(firstStored.password_salt.length, 16);
  assert.equal(firstStored.password_hash.length, 64);
  assert.notDeepEqual(firstStored.password_salt, secondStored.password_salt);
  assert.notDeepEqual(firstStored.password_hash, secondStored.password_hash);
  assert.match(first.cookie, /^__Host-sg_community=/);
  assert.match(first.cookie, /; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+; Secure$/);
  const session = first.cookie.split(";")[0];
  assert.deepEqual(auth.session(session, { secure: true }), first.user);
  assert.equal(auth.session(session), null);
  assert.equal(auth.session(`${session}; ${second.cookie.split(";")[0]}`, { secure: true }), null);
});

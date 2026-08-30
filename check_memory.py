from backend.memory import get_mistakes_db, get_learner_profile_db
print('=== MISTAKES DB ===')
mistakes = get_mistakes_db(limit=20)
for m in mistakes:
    print('  id=%s original=%r correction=%r' % (m['id'], m['original'], m['correction']))
if not mistakes:
    print('  (empty)')

print()
print('=== PROFILE DB ===')
p = get_learner_profile_db()
print(p)

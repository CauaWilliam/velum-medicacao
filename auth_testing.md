# Auth Testing Playbook

1. MongoDB: `db.users.find({role:"admin"})` — bcrypt hash starts with `$2b$`; unique index on users.email; index on login_attempts.identifier.
2. API:
```
curl -c cookies.txt -X POST $URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"cauabeckler0@gmail.com","password":"Velum@2026"}'
curl -b cookies.txt $URL/api/auth/me
```
Login returns user and sets access_token + refresh_token cookies; /me returns same user.
3. Multi-tenant: a second caregiver must get 404 on the first caregiver's patient/medication/appointment ids.
4. 5 failed logins for same ip+email → 429 lockout for 15 minutes.

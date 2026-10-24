"""Create (or remove) throwaway FREE students for the load test, and write a bearer token for each.

    python -m app.scripts.loadtest_users create --count 100 --out loadtest/tokens.txt
    python -m app.scripts.loadtest_users delete

Run it against a staging copy of the database, not production: the test writes real attempts and answers.
Students are FREE, so no report triggers an LLM call; they all get emails @loadtest.invalid and are found
and deleted by that domain. Tokens last 24 hours.
"""
import argparse
import asyncio
import sys
from datetime import timedelta

from sqlalchemy import delete
from sqlmodel import col, select

from app.core.security import create_access_token, get_password_hash
from app.db.models.user import StudentProfile, User, UserRole
from app.db.session import managed_async_session

DOMAIN = "loadtest.invalid"


async def create(count: int, target_exam: str | None, out: str) -> None:
    async with managed_async_session() as session:
        existing = {
            u.email: u
            for u in (await session.exec(select(User).where(col(User.email).like(f"%@{DOMAIN}")))).all()
        }
        users = []
        for n in range(1, count + 1):
            email = f"student{n:03d}@{DOMAIN}"
            user = existing.get(email)
            if not user:
                user = User(
                    full_name=f"Load Test {n:03d}",
                    email=email,
                    role=UserRole.STUDENT,
                    password_hash=get_password_hash(f"unused-{n}"),
                )
                session.add(user)
                await session.flush()
                session.add(StudentProfile(user_id=user.id, target_exam=target_exam))
            users.append(user)
        await session.commit()
        # Written to a file, not stdout: the app's loggers print to stdout.
        with open(out, "w") as f:
            for user in users:
                f.write(create_access_token(subject=user.id, role=UserRole.STUDENT.value, expires_delta=timedelta(hours=24)) + "\n")
    print(f"{len(users)} load-test students ready; tokens in {out}.", file=sys.stderr)


async def remove() -> None:
    from app.db.models.notification import UserNotification

    async with managed_async_session() as session:
        ids = select(User.id).where(col(User.email).like(f"%@{DOMAIN}"))
        # In-app notifications have no ON DELETE CASCADE; everything else the test wrote does.
        await session.exec(delete(UserNotification).where(col(UserNotification.user_id).in_(ids)))
        result = await session.exec(delete(User).where(col(User.email).like(f"%@{DOMAIN}")))
        await session.commit()
    print(f"Deleted {result.rowcount} load-test students (their attempts cascade).", file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create")
    c.add_argument("--count", type=int, default=100)
    c.add_argument("--target-exam", default=None, help="Target exam code for the students' profiles")
    c.add_argument("--out", default="loadtest/tokens.txt", help="Where to write one bearer token per line")
    sub.add_parser("delete")
    args = parser.parse_args()
    asyncio.run(create(args.count, args.target_exam, args.out) if args.cmd == "create" else remove())

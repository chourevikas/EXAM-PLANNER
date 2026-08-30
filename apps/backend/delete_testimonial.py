import asyncio
from sqlmodel import select
from app.db.session import async_session_factory
from app.db.models.testimonial import Testimonial

async def delete_arjun():
    async with async_session_factory() as session:
        stmt = select(Testimonial).where(Testimonial.user_name == "Arjun Sharma")
        res = await session.exec(stmt)
        items = res.all()
        for item in items:
            await session.delete(item)
        await session.commit()
        print(f"Deleted {len(items)} testimonials.")

if __name__ == "__main__":
    asyncio.run(delete_arjun())

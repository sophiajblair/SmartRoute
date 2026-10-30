from app.database import Base, SessionLocal, engine
from app.seed import seed_demo_data


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    print("Fictional SmartRoute demonstration data is ready.")

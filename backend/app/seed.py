from datetime import date, timedelta

from sqlalchemy.orm import Session

from .models import (
    Allocation, BuildingInstruction, DeliveryFailureReason, DeliveryReport, ExpertAvailability, Notification,
    NotebookVersion, PostalUnit, ReplacementRequest, RouteIssue, DeliveryRoute, User,
)
from .security import hash_password


DEMO_PASSWORD = "SmartRoute2026!"


def seed_demo_data(db: Session):
    if db.query(User).count():
        return
    units = [
        PostalUnit(name="Paris Rive Gauche", city="Paris"),
        PostalUnit(name="Lyon Presqu'île", city="Lyon"),
        PostalUnit(name="Bordeaux Centre", city="Bordeaux"),
    ]
    db.add_all(units)
    db.flush()
    director = User(name="Camille Laurent", email="director@smartroute.demo", password_hash=hash_password(DEMO_PASSWORD), role="director")
    db.add(director)
    managers, postmen = [], []
    for index, unit in enumerate(units):
        manager = User(name=["Sophie Bernard", "Karim Moreau", "Julie Petit"][index],
                       email=f"manager{index + 1}@smartroute.demo", password_hash=hash_password(DEMO_PASSWORD),
                       role="manager", unit_id=unit.id)
        db.add(manager)
        managers.append(manager)
        for person in range(2):
            postman = User(name=f"Facteur {index * 2 + person + 1}", email=f"postman{index * 2 + person + 1}@smartroute.demo",
                           password_hash=hash_password(DEMO_PASSWORD), role="postman", unit_id=unit.id)
            db.add(postman)
            postmen.append(postman)
    experts = []
    for index in range(10):
        expert = User(name=f"Alex Martin {index + 1}", email=f"expert{index + 1}@smartroute.demo",
                      password_hash=hash_password(DEMO_PASSWORD), role="expert")
        db.add(expert)
        experts.append(expert)
    db.flush()
    routes = []
    for index in range(12):
        unit = units[index % 3]
        route = DeliveryRoute(
            code=f"R-{index + 1:02d}", name=["Quartier des Arts", "Centre historique", "Les Jardins", "Rive Nord"][index % 4],
            unit_id=unit.id, postman_id=postmen[index % len(postmen)].id, duration_minutes=330 + index % 4 * 20,
            parcel_volume=70 + index * 3, difficulty=1 + index % 5,
            description=f"Tournée de démonstration {index + 1}, secteur fictif de {unit.city}.",
            sequence="Départ agence → axe commerçant → secteur résidentiel → retour agence",
            obstacles="Travaux ponctuels au carrefour principal; vérifier la signalisation.",
            instructions="Suivre la séquence recommandée. En cas d'accès impossible, contacter le responsable d'unité.",
            manager_contact=f"manager{index % 3 + 1}@smartroute.demo",
            support_contact="support@smartroute.demo",
        )
        db.add(route)
        routes.append(route)
    db.flush()
    for index, route in enumerate(routes):
        db.add(NotebookVersion(
            route_id=route.id, changed_by=managers[index % 3].id, field="initial_notebook",
            old_value="", new_value=route.description, approval_status="Approved",
        ))
        db.add(BuildingInstruction(route_id=route.id, name=f"Résidence {chr(65 + index % 8)}",
                                   address=f"{10 + index} rue de la République, {units[index % 3].city}",
                                   entrance="Entrée côté cour, panneau bleu.",
                                   access_instructions="Accès public en journée; aucun code d'entrée enregistré.",
                                   delivery_instructions="Boîtes aux lettres dans le hall, à gauche.",
                                   difficulties="Porte lourde; prévoir quelques secondes.", notes="Consigne fictive de démonstration."))
        if index % 3 == 0:
            db.add(RouteIssue(route_id=route.id, reported_by=managers[index % 3].id,
                              title="Travaux de voirie", description="Déviation piétonne signalée sur l'axe principal.",
                              category="Navigation", priority="Medium", status="Open"))
    db.flush()
    for expert in experts:
        db.add(ExpertAvailability(user_id=expert.id, available=True, skills="Résidentiel, colis"))
    db.flush()
    for index in range(9):
        request = ReplacementRequest(
            unit_id=units[index % 3].id, requested_by=managers[index % 3].id,
            request_date=date.today() + timedelta(days=index % 2),
            absent_employees=1 + index % 3, uncovered_rounds=1 + index % 4,
            parcel_volume=55 + index * 8, backlog=15 + index * 13, urgent_deliveries=index % 5 * 4,
            route_difficulty=1 + index % 5, comments="Demande de démonstration, données fictives.",
            status="Pending" if index < 6 else "Approved" if index < 8 else "Partially Covered",
        )
        db.add(request)
    db.flush()
    for index in range(7):
        request = db.query(ReplacementRequest).filter_by(id=index + 1).one()
        allocation = Allocation(request_id=request.id, expert_id=experts[index].id, route_id=routes[index].id,
                                assignment_date=request.request_date, status="Assigned", score=62 + index,
                                reasoning="Allocation historique fictive.", allocated_by=director.id)
        db.add(allocation)
        if index < 5:
            db.flush()
            report = DeliveryReport(allocation_id=allocation.id, assigned=80 + index * 5, delivered=76 + index * 5,
                                    undelivered=4, comments="Rapport de démonstration fictif.")
            db.add(report)
            db.flush()
            reason = (
                "Recipient unavailable", "Building inaccessible", "Incorrect address",
                "Insufficient time", "Navigation difficulty",
            )[index]
            db.add(DeliveryFailureReason(report_id=report.id, reason=reason, parcel_count=4))
    db.add_all([
        Notification(user_id=director.id, message="Une nouvelle demande de remplacement attend votre revue.", link="/requests"),
        Notification(user_id=managers[0].id, message="Votre unité dispose de demandes en cours.", link="/requests"),
        Notification(user_id=experts[0].id, message="Une tournée de démonstration vous est assignée.", link="/assignments"),
    ])
    db.commit()

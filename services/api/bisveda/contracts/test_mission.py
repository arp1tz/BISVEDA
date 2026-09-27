from bisveda.contracts.mission import (
    ComplianceMission,
    ComplianceStep,
    DecisionExplainability,
    MissionStatus,
    ProductIdentity,
    StepEvaluationState,
)


def test_compliance_mission_initialization():
    identity = ProductIdentity(
        name="Domestic Pressure Cooker",
        category="Cookers & Utensils",
        material="Stainless Steel",
        grade="Grade 304",
        intended_use="Domestic",
        user_type="msme",
        location_city="Nagpur",
        location_state="Maharashtra",
        pincode="440001",
    )

    mission = ComplianceMission(
        mission_id="MSN-TEST-001",
        title="MSME Stainless Steel Cooker Compliance Pathway",
        status=MissionStatus.DRAFT,
        product_identity=identity,
    )

    assert mission.mission_id == "MSN-TEST-001"
    assert mission.status == MissionStatus.DRAFT
    assert mission.product_identity.material == "Stainless Steel"
    assert len(mission.step_states) == 0


def test_compliance_mission_update_step_with_3_questions():
    identity = ProductIdentity(
        name="Stainless Steel Water Bottle",
        material="Stainless Steel",
    )

    mission = ComplianceMission(
        mission_id="MSN-TEST-002",
        title="Bottle Compliance",
        product_identity=identity,
    )

    # 3-Question Explainability Model (Canonical Spec §6.2)
    exp = DecisionExplainability(
        why="Standard IS 17475:2020 directly applies to stainless steel water bottles and flasks",
        evidence_ids=["S1", "S2"],
        change_triggers=[
            "Switching from stainless steel to copper triggers IS 17475 material mismatch",
            "Change of volume capacity to industrial container exceeds domestic standard scope",
        ],
    )

    mission.update_step(
        step=ComplianceStep.PRODUCT_MATCHING,
        state=StepEvaluationState.SUPPORTED,
        summary="Matched IS 17475:2020 directly",
        explainability=exp,
    )

    assert ComplianceStep.PRODUCT_MATCHING.value in mission.step_states
    progress = mission.step_states[ComplianceStep.PRODUCT_MATCHING.value]
    assert progress.state == StepEvaluationState.SUPPORTED
    assert progress.explainability is not None
    assert progress.explainability.why.startswith("Standard IS 17475:2020")
    assert progress.explainability.evidence_ids == ["S1", "S2"]
    assert len(progress.explainability.change_triggers) == 2


def test_mission_serialization_roundtrip():
    identity = ProductIdentity(name="TMT Steel Bars", user_type="large_scale")
    mission = ComplianceMission(
        mission_id="MSN-TEST-003",
        title="TMT Rebar Compliance",
        product_identity=identity,
        open_questions=["Is the steel hot-rolled or cold-worked?"],
    )
    dumped = mission.model_dump()
    reloaded = ComplianceMission.model_validate(dumped)

    assert reloaded.mission_id == "MSN-TEST-003"
    assert reloaded.open_questions == ["Is the steel hot-rolled or cold-worked?"]

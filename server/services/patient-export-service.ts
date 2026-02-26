import { db } from "../db";
import {
  patients, medicalRecords, appointments, prescriptions, prescriptionItems,
  examResults, diagnosticInferences, consultationNotes, videoConsultations,
  labOrders, hospitalReferrals, medications, users
} from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

export type ExportStandard = 'fhir-br' | 'fhir-us' | 'fhir-eu' | 'fhir-intl';
export type ExportFormat = 'json' | 'pdf';

interface ExportOptions {
  standard: ExportStandard;
  format: ExportFormat;
  deidentify?: boolean;
  includeConsent?: boolean;
}

interface PatientData {
  patient: any;
  records: any[];
  appointmentsList: any[];
  prescriptionsList: any[];
  prescriptionItemsList: any[];
  exams: any[];
  inferences: any[];
  notes: any[];
  consultations: any[];
  labs: any[];
  referrals: any[];
  doctorNames: Record<string, string>;
}

async function aggregatePatientData(patientId: string): Promise<PatientData> {
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!patient) throw new Error("Patient not found");

  const [records, appointmentsList, prescriptionsList, exams, inferences, consultations, labs, referrals] = await Promise.all([
    db.select().from(medicalRecords).where(eq(medicalRecords.patientId, patientId)).orderBy(desc(medicalRecords.createdAt)),
    db.select().from(appointments).where(eq(appointments.patientId, patientId)).orderBy(desc(appointments.scheduledAt)),
    db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId)).orderBy(desc(prescriptions.createdAt)),
    db.select().from(examResults).where(eq(examResults.patientId, patientId)).orderBy(desc(examResults.createdAt)),
    db.select().from(diagnosticInferences).where(eq(diagnosticInferences.patientId, patientId)).orderBy(desc(diagnosticInferences.createdAt)),
    db.select().from(videoConsultations).where(eq(videoConsultations.patientId, patientId)).orderBy(desc(videoConsultations.createdAt)),
    db.select().from(labOrders).where(eq(labOrders.patientId, patientId)).orderBy(desc(labOrders.createdAt)),
    db.select().from(hospitalReferrals).where(eq(hospitalReferrals.patientId, patientId)).orderBy(desc(hospitalReferrals.createdAt)),
  ]);

  const prescriptionIds = prescriptionsList.map(p => p.id);
  let prescriptionItemsList: any[] = [];
  for (const pid of prescriptionIds) {
    const items = await db.select({
      item: prescriptionItems,
      medication: medications,
    }).from(prescriptionItems)
      .leftJoin(medications, eq(prescriptionItems.medicationId, medications.id))
      .where(eq(prescriptionItems.prescriptionId, pid));
    prescriptionItemsList.push(...items.map(i => ({ ...i.item, medication: i.medication })));
  }

  let notes: any[] = [];
  const consultationIds = [...new Set([
    ...records.filter(r => r.appointmentId).map(r => r.appointmentId!),
    ...consultations.map(c => c.id),
  ])];
  for (const cid of consultationIds.slice(0, 50)) {
    const cNotes = await db.select().from(consultationNotes).where(eq(consultationNotes.consultationId, cid)).orderBy(consultationNotes.createdAt);
    notes.push(...cNotes);
  }

  const doctorIds = [...new Set([
    ...records.map(r => r.doctorId),
    ...appointmentsList.map(a => a.doctorId),
    ...prescriptionsList.map(p => p.doctorId),
  ].filter(Boolean))];
  const doctorNames: Record<string, string> = {};
  for (const did of doctorIds) {
    const [doc] = await db.select({ name: users.name }).from(users).where(eq(users.id, did)).limit(1);
    if (doc) doctorNames[did] = doc.name;
  }

  return { patient, records, appointmentsList, prescriptionsList, prescriptionItemsList, exams, inferences, notes, consultations, labs, referrals, doctorNames };
}

function deidentifyValue(val: string | null | undefined): string {
  if (!val) return "[REDACTED]";
  return "[REDACTED]";
}

function buildFhirPatient(data: PatientData, standard: ExportStandard, deidentify: boolean): any {
  const p = data.patient;
  const resource: any = {
    resourceType: "Patient",
    id: p.id,
    meta: {
      lastUpdated: p.updatedAt?.toISOString() || new Date().toISOString(),
      profile: getPatientProfile(standard),
    },
    identifier: [],
    active: true,
  };

  if (!deidentify) {
    resource.name = [{ use: "official", text: p.name, family: p.name.split(" ").pop(), given: [p.name.split(" ")[0]] }];
    resource.telecom = [];
    if (p.phone) resource.telecom.push({ system: "phone", value: p.phone, use: "mobile" });
    if (p.email) resource.telecom.push({ system: "email", value: p.email });
    if (p.whatsappNumber) resource.telecom.push({ system: "phone", value: p.whatsappNumber, use: "mobile", extension: [{ url: "http://hl7.org/fhir/StructureDefinition/contactpoint-purpose", valueString: "whatsapp" }] });
    if (p.dateOfBirth) resource.birthDate = p.dateOfBirth.toISOString().split("T")[0];
    if (p.gender) resource.gender = mapGender(p.gender);
  } else {
    resource.name = [{ use: "official", text: deidentifyValue(null) }];
    if (p.dateOfBirth) {
      const year = p.dateOfBirth.getFullYear();
      resource.birthDate = `${year}`;
    }
    if (p.gender) resource.gender = mapGender(p.gender);
  }

  if (standard === 'fhir-br') {
    resource.identifier.push({
      system: "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "TAX" }] },
      value: p.userId || "000.000.000-00",
    });
    resource.identifier.push({
      system: "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "HC" }] },
      value: "000000000000000",
    });
    resource.meta.profile = ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0"];
  }

  if (standard === 'fhir-us') {
    resource.meta.profile = ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"];
    resource.identifier.push({
      system: "http://hl7.org/fhir/sid/us-ssn",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "SS" }] },
      value: deidentify ? deidentifyValue(null) : "000-00-0000",
    });
  }

  if (standard === 'fhir-eu') {
    resource.meta.profile = ["http://hl7.eu/fhir/StructureDefinition/Patient-eu"];
    resource.meta.security = [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "GDPRCD", display: "GDPR Consent Directive" }];
  }

  if (p.bloodType) {
    resource.extension = resource.extension || [];
    resource.extension.push({
      url: "http://hl7.org/fhir/StructureDefinition/patient-bloodType",
      valueString: p.bloodType,
    });
  }

  return resource;
}

function buildAllergyIntolerances(data: PatientData): any[] {
  if (!data.patient.allergies) return [];
  const allergyList = data.patient.allergies.split(",").map((a: string) => a.trim()).filter(Boolean);
  return allergyList.map((allergy: string, idx: number) => ({
    resourceType: "AllergyIntolerance",
    id: `allergy-${data.patient.id}-${idx}`,
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
    verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "confirmed" }] },
    patient: { reference: `Patient/${data.patient.id}` },
    code: { text: allergy },
    recordedDate: data.patient.createdAt?.toISOString(),
  }));
}

function buildEncounters(data: PatientData, standard: ExportStandard): any[] {
  return data.appointmentsList.map(appt => {
    const enc: any = {
      resourceType: "Encounter",
      id: appt.id,
      meta: { profile: getEncounterProfile(standard) },
      status: mapEncounterStatus(appt.status),
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: appt.type === "emergency" ? "EMER" : appt.videoCallUrl ? "VR" : "AMB",
        display: appt.type === "emergency" ? "emergency" : appt.videoCallUrl ? "virtual" : "ambulatory",
      },
      type: [{
        coding: [{ system: "http://snomed.info/sct", code: mapAppointmentType(appt.type), display: appt.type }],
      }],
      subject: { reference: `Patient/${data.patient.id}` },
      participant: [{
        individual: { reference: `Practitioner/${appt.doctorId}`, display: data.doctorNames[appt.doctorId] || "Doctor" },
      }],
      period: {
        start: appt.scheduledAt?.toISOString(),
      },
    };

    if (standard === 'fhir-br') {
      enc.meta.profile = ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRContatoAssistencial-1.0"];
      enc.extension = [{
        url: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRModalidadeAssistencial",
        valueCoding: {
          system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRModalidadeAssistencial",
          code: appt.videoCallUrl ? "04" : "01",
          display: appt.videoCallUrl ? "Telessaúde" : "Atenção Básica",
        },
      }];
    }

    if (appt.notes) enc.reasonCode = [{ text: appt.notes }];
    return enc;
  });
}

function buildConditions(data: PatientData, standard: ExportStandard): any[] {
  const conditions: any[] = [];
  for (const record of data.records) {
    if (!record.diagnosis) continue;
    const condition: any = {
      resourceType: "Condition",
      id: `condition-${record.id}`,
      meta: { profile: getConditionProfile(standard) },
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
      verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
      code: { text: record.diagnosis },
      subject: { reference: `Patient/${data.patient.id}` },
      encounter: record.appointmentId ? { reference: `Encounter/${record.appointmentId}` } : undefined,
      recordedDate: record.createdAt?.toISOString(),
      recorder: { reference: `Practitioner/${record.doctorId}`, display: data.doctorNames[record.doctorId] || "Doctor" },
    };

    if (record.diagnosticHypotheses && Array.isArray(record.diagnosticHypotheses)) {
      const hyps = record.diagnosticHypotheses as any[];
      const coding = hyps.filter((h: any) => h.code).map((h: any) => {
        const sys = h.system === "CID-10" ? "http://hl7.org/fhir/sid/icd-10"
          : h.system === "ICD-11" ? "http://id.who.int/icd/release/11/mms"
          : h.system === "DSM-5" ? "urn:oid:2.16.840.1.113883.6.344"
          : "http://hl7.org/fhir/sid/icd-10";
        return { system: sys, code: h.code, display: h.description || h.code };
      });
      if (coding.length > 0) condition.code.coding = coding;
    }

    if (standard === 'fhir-br') {
      condition.meta.profile = ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRDiagnosticoAvaliado-1.0"];
    }

    conditions.push(condition);
  }

  for (const inf of data.inferences) {
    if (!inf.hypotheses || !Array.isArray(inf.hypotheses)) continue;
    for (const hyp of inf.hypotheses as any[]) {
      conditions.push({
        resourceType: "Condition",
        id: `inference-${inf.id}-${hyp.code || 'unknown'}`,
        meta: { profile: getConditionProfile(standard) },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        verificationStatus: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: inf.reviewStatus === "approved" ? "confirmed" : "provisional",
          }],
        },
        code: {
          text: hyp.description || hyp.code,
          coding: hyp.code ? [{
            system: hyp.system === "CID-10" ? "http://hl7.org/fhir/sid/icd-10"
              : hyp.system === "ICD-11" ? "http://id.who.int/icd/release/11/mms"
              : hyp.system === "DSM-5" ? "urn:oid:2.16.840.1.113883.6.344"
              : "http://hl7.org/fhir/sid/icd-10",
            code: hyp.code,
            display: hyp.description,
          }] : undefined,
        },
        subject: { reference: `Patient/${data.patient.id}` },
        recordedDate: inf.createdAt?.toISOString(),
        note: [{ text: `AI Confidence: ${hyp.confidence || inf.overallConfidence}% | Review: ${inf.reviewStatus}` }],
      });
    }
  }

  return conditions;
}

function buildObservations(data: PatientData): any[] {
  const observations: any[] = [];
  for (const record of data.records) {
    if (record.symptoms) {
      observations.push({
        resourceType: "Observation",
        id: `obs-symptoms-${record.id}`,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam", display: "Exam" }] }],
        code: { coding: [{ system: "http://loinc.org", code: "56831-1", display: "Chief complaint" }], text: "Sintomas / Symptoms" },
        subject: { reference: `Patient/${data.patient.id}` },
        encounter: record.appointmentId ? { reference: `Encounter/${record.appointmentId}` } : undefined,
        effectiveDateTime: record.createdAt?.toISOString(),
        valueString: record.symptoms,
      });
    }
    if (record.observations) {
      observations.push({
        resourceType: "Observation",
        id: `obs-clinical-${record.id}`,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam" }] }],
        code: { text: "Observações Clínicas / Clinical Observations" },
        subject: { reference: `Patient/${data.patient.id}` },
        effectiveDateTime: record.createdAt?.toISOString(),
        valueString: record.observations,
      });
    }
  }
  return observations;
}

function buildMedicationRequests(data: PatientData, standard: ExportStandard): any[] {
  const requests: any[] = [];
  for (const rx of data.prescriptionsList) {
    const items = data.prescriptionItemsList.filter(i => i.prescriptionId === rx.id);
    for (const item of items) {
      const req: any = {
        resourceType: "MedicationRequest",
        id: `medrx-${item.id}`,
        meta: { profile: getMedicationRequestProfile(standard) },
        status: mapPrescriptionStatus(rx.status),
        intent: "order",
        medicationCodeableConcept: {
          text: item.medication?.name || item.customMedication || "Unknown Medication",
          coding: item.medication?.activeIngredient ? [{
            system: "http://www.anvisa.gov.br/datavisa/fila_bula",
            display: item.medication.activeIngredient,
          }] : undefined,
        },
        subject: { reference: `Patient/${data.patient.id}` },
        encounter: rx.appointmentId ? { reference: `Encounter/${rx.appointmentId}` } : undefined,
        authoredOn: rx.createdAt?.toISOString(),
        requester: { reference: `Practitioner/${rx.doctorId}`, display: data.doctorNames[rx.doctorId] || "Doctor" },
        dosageInstruction: [{
          text: `${item.dosage} — ${item.frequency} — ${item.duration}`,
          timing: { code: { text: item.frequency } },
          doseAndRate: [{ doseQuantity: { value: parseFloat(item.dosage) || 0, unit: item.dosage } }],
        }],
        dispenseRequest: {
          quantity: { value: item.quantity, unit: "units" },
          validityPeriod: { start: rx.createdAt?.toISOString(), end: rx.expiresAt?.toISOString() },
        },
        note: [],
      };

      if (item.instructions) req.note.push({ text: item.instructions });
      if (rx.specialInstructions) req.note.push({ text: rx.specialInstructions });
      if (rx.isUrgent) req.priority = "urgent";

      if (standard === 'fhir-br') {
        req.meta.profile = ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRPrescricaoMedicamento-1.0"];
        req.extension = [{
          url: "http://www.saude.gov.br/fhir/r4/StructureDefinition/BRPrescricaoEletronica",
          valueBoolean: rx.isElectronic,
        }];
      }

      requests.push(req);
    }
  }
  return requests;
}

function buildDiagnosticReports(data: PatientData, standard: ExportStandard): any[] {
  const reports: any[] = [];

  for (const exam of data.exams) {
    const report: any = {
      resourceType: "DiagnosticReport",
      id: `diagrpt-${exam.id}`,
      meta: { profile: getDiagnosticReportProfile(standard) },
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB", display: "Laboratory" }] }],
      code: { text: exam.examType },
      subject: { reference: `Patient/${data.patient.id}` },
      effectiveDateTime: exam.createdAt?.toISOString(),
      conclusion: typeof exam.results === "object" ? JSON.stringify(exam.results) : String(exam.results),
    };

    if (exam.analyzedByAI) {
      report.extension = [{ url: "http://telem3d.com/fhir/StructureDefinition/ai-analyzed", valueBoolean: true }];
    }

    if (exam.abnormalValues && Array.isArray(exam.abnormalValues)) {
      report.conclusionCode = (exam.abnormalValues as any[]).map((av: any) => ({
        text: typeof av === "string" ? av : JSON.stringify(av),
      }));
    }

    reports.push(report);
  }

  for (const lab of data.labs) {
    reports.push({
      resourceType: "DiagnosticReport",
      id: `labrpt-${lab.id}`,
      status: mapLabStatus(lab.status),
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB" }] }],
      code: { text: lab.orderDetails },
      subject: { reference: `Patient/${data.patient.id}` },
      effectiveDateTime: lab.completedAt?.toISOString() || lab.createdAt?.toISOString(),
      conclusion: lab.results ? JSON.stringify(lab.results) : undefined,
    });
  }

  return reports;
}

function buildDocumentReferences(data: PatientData): any[] {
  const docs: any[] = [];

  for (const record of data.records) {
    if (record.treatment) {
      docs.push({
        resourceType: "DocumentReference",
        id: `doc-treatment-${record.id}`,
        status: "current",
        type: { coding: [{ system: "http://loinc.org", code: "18776-5", display: "Plan of care note" }] },
        subject: { reference: `Patient/${data.patient.id}` },
        date: record.createdAt?.toISOString(),
        author: [{ reference: `Practitioner/${record.doctorId}`, display: data.doctorNames[record.doctorId] || "Doctor" }],
        content: [{ attachment: { contentType: "text/plain", data: Buffer.from(record.treatment).toString("base64") } }],
        context: record.appointmentId ? { encounter: [{ reference: `Encounter/${record.appointmentId}` }] } : undefined,
      });
    }
    if (record.audioTranscript) {
      docs.push({
        resourceType: "DocumentReference",
        id: `doc-transcript-${record.id}`,
        status: "current",
        type: { coding: [{ system: "http://loinc.org", code: "75476-2", display: "Consultation transcript" }] },
        subject: { reference: `Patient/${data.patient.id}` },
        date: record.createdAt?.toISOString(),
        content: [{ attachment: { contentType: "text/plain", data: Buffer.from(record.audioTranscript).toString("base64") } }],
      });
    }
  }

  for (const note of data.notes.filter(n => n.type === "doctor_note")) {
    docs.push({
      resourceType: "DocumentReference",
      id: `doc-note-${note.id}`,
      status: "current",
      type: { coding: [{ system: "http://loinc.org", code: "11506-3", display: "Progress note" }] },
      subject: { reference: `Patient/${data.patient.id}` },
      date: note.createdAt?.toISOString(),
      content: [{ attachment: { contentType: "text/plain", data: Buffer.from(note.content || "").toString("base64") } }],
    });
  }

  return docs;
}

function buildCarePlans(data: PatientData): any[] {
  const plans: any[] = [];
  for (const record of data.records) {
    if (!record.treatment) continue;
    plans.push({
      resourceType: "CarePlan",
      id: `careplan-${record.id}`,
      status: "active",
      intent: "plan",
      subject: { reference: `Patient/${data.patient.id}` },
      encounter: record.appointmentId ? { reference: `Encounter/${record.appointmentId}` } : undefined,
      created: record.createdAt?.toISOString(),
      author: { reference: `Practitioner/${record.doctorId}`, display: data.doctorNames[record.doctorId] || "Doctor" },
      description: record.treatment,
      activity: record.prescription ? [{
        detail: { description: record.prescription, status: "scheduled" },
      }] : undefined,
    });
  }
  return plans;
}

function buildReferralRequests(data: PatientData): any[] {
  return data.referrals.map(ref => ({
    resourceType: "ServiceRequest",
    id: `referral-${ref.id}`,
    status: mapReferralStatus(ref.status),
    intent: "order",
    priority: ref.urgency === "emergency" ? "stat" : ref.urgency === "urgent" ? "urgent" : "routine",
    code: { text: ref.specialty },
    subject: { reference: `Patient/${data.patient.id}` },
    requester: { reference: `Practitioner/${ref.referringDoctorId}` },
    reasonCode: [{ text: ref.reason }],
    note: [
      ...(ref.clinicalSummary ? [{ text: `Clinical Summary: ${ref.clinicalSummary}` }] : []),
      ...(ref.dischargeNotes ? [{ text: `Discharge: ${ref.dischargeNotes}` }] : []),
    ],
    authoredOn: ref.createdAt?.toISOString(),
  }));
}

function buildFhirBundle(data: PatientData, options: ExportOptions): any {
  const { standard, deidentify = false } = options;
  const entries: any[] = [];

  const patientResource = buildFhirPatient(data, standard, deidentify);
  entries.push({ fullUrl: `urn:uuid:${data.patient.id}`, resource: patientResource });

  for (const allergy of buildAllergyIntolerances(data)) {
    entries.push({ fullUrl: `urn:uuid:${allergy.id}`, resource: allergy });
  }

  for (const encounter of buildEncounters(data, standard)) {
    entries.push({ fullUrl: `urn:uuid:${encounter.id}`, resource: encounter });
  }

  for (const condition of buildConditions(data, standard)) {
    entries.push({ fullUrl: `urn:uuid:${condition.id}`, resource: condition });
  }

  for (const obs of buildObservations(data)) {
    entries.push({ fullUrl: `urn:uuid:${obs.id}`, resource: obs });
  }

  for (const medReq of buildMedicationRequests(data, standard)) {
    entries.push({ fullUrl: `urn:uuid:${medReq.id}`, resource: medReq });
  }

  for (const report of buildDiagnosticReports(data, standard)) {
    entries.push({ fullUrl: `urn:uuid:${report.id}`, resource: report });
  }

  for (const doc of buildDocumentReferences(data)) {
    entries.push({ fullUrl: `urn:uuid:${doc.id}`, resource: doc });
  }

  for (const plan of buildCarePlans(data)) {
    entries.push({ fullUrl: `urn:uuid:${plan.id}`, resource: plan });
  }

  for (const ref of buildReferralRequests(data)) {
    entries.push({ fullUrl: `urn:uuid:${ref.id}`, resource: ref });
  }

  if (options.includeConsent && (standard === 'fhir-eu' || standard === 'fhir-br')) {
    entries.push({
      fullUrl: `urn:uuid:consent-${data.patient.id}`,
      resource: {
        resourceType: "Consent",
        id: `consent-${data.patient.id}`,
        status: "active",
        scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy" }] },
        category: [{
          coding: [{
            system: standard === 'fhir-eu' ? "http://loinc.org" : "http://www.saude.gov.br/fhir/r4/CodeSystem/BRTipoConsentimento",
            code: standard === 'fhir-eu' ? "59284-0" : "LGPD",
            display: standard === 'fhir-eu' ? "GDPR Consent" : "Consentimento LGPD",
          }],
        }],
        patient: { reference: `Patient/${data.patient.id}` },
        dateTime: new Date().toISOString(),
        policy: [{
          authority: standard === 'fhir-eu' ? "https://eur-lex.europa.eu" : "http://www.planalto.gov.br",
          uri: standard === 'fhir-eu' ? "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679" : "http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
        }],
      },
    });
  }

  const bundle: any = {
    resourceType: "Bundle",
    id: `export-${data.patient.id}-${Date.now()}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      tag: [{ system: "http://telem3d.com/fhir/export-standard", code: standard }],
    },
    type: "document",
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries,
  };

  if (standard === 'fhir-br') {
    bundle.meta.profile = ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRRegistroAtendimentoClinico"];
    bundle.meta.tag.push(
      { system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRPadrao", code: "RNDS", display: "Rede Nacional de Dados em Saúde" },
      { system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRPadrao", code: "RAC", display: "Registro de Atendimento Clínico" },
      { system: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRPadrao", code: "SBIS", display: "Sociedade Brasileira de Informática em Saúde" },
    );
  }

  if (standard === 'fhir-us') {
    bundle.meta.profile = ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"];
    bundle.meta.tag.push(
      { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HIPAA", display: "HIPAA Compliance" },
      { system: "http://www.healthit.gov/uscdi", code: "USCDIv3", display: "USCDI v3 - ONC" },
    );
    if (deidentify) {
      bundle.meta.security = [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "DEID", display: "HIPAA Safe Harbor De-identification" }];
    }
  }

  if (standard === 'fhir-eu') {
    bundle.meta.tag.push(
      { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "GDPR", display: "GDPR Compliance" },
      { system: "http://hl7.eu/fhir", code: "EU-FHIR", display: "European FHIR Profile" },
    );
    bundle.meta.security = [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "GDPRCD", display: "GDPR Consent Directive" }];
  }

  if (standard === 'fhir-intl') {
    bundle.meta.tag.push(
      { system: "http://hl7.org/fhir", code: "FHIR-R4", display: "HL7 FHIR R4 International" },
      { system: "http://id.who.int/icd", code: "ICD-11", display: "WHO ICD-11" },
    );
  }

  return bundle;
}

function generatePdfHtml(data: PatientData, bundle: any, options: ExportOptions): string {
  const { standard, deidentify = false } = options;
  const p = data.patient;
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const standardLabels: Record<ExportStandard, string> = {
    'fhir-br': 'Brasil — SUS / RNDS / RAC / SBIS / HL7 FHIR R4',
    'fhir-us': 'United States — HL7 FHIR R4 / HIPAA / ONC USCDI v3',
    'fhir-eu': 'European Union — HL7 FHIR R4 / GDPR / EUDAMED',
    'fhir-intl': 'International — HL7 FHIR R4 / WHO ICD-11',
  };

  const complianceBadges: Record<ExportStandard, string[]> = {
    'fhir-br': ['RNDS', 'RAC (DATASUS)', 'SBIS', 'HL7 FHIR R4', 'LGPD (Lei 13.709/2018)', 'CID-10'],
    'fhir-us': ['HL7 FHIR R4', 'HIPAA', 'ONC', 'USCDI v3', 'US Core', ...(deidentify ? ['Safe Harbor De-ID'] : [])],
    'fhir-eu': ['HL7 FHIR R4', 'GDPR (EU 2016/679)', 'EUDAMED', 'EU Patient Summary'],
    'fhir-intl': ['HL7 FHIR R4', 'WHO ICD-11', 'SNOMED CT', 'LOINC'],
  };

  const patientName = deidentify ? "[REDACTED]" : p.name;
  const patientDob = deidentify ? (p.dateOfBirth ? p.dateOfBirth.getFullYear().toString() : "N/A") : (p.dateOfBirth ? p.dateOfBirth.toLocaleDateString("pt-BR") : "N/A");
  const patientPhone = deidentify ? "[REDACTED]" : (p.phone || "N/A");
  const patientEmail = deidentify ? "[REDACTED]" : (p.email || "N/A");

  const recordsHtml = data.records.map(r => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;background:#f8fafc;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <strong>${r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "N/A"}</strong>
        <span style="color:#64748b;font-size:0.85em;">Dr. ${data.doctorNames[r.doctorId] || "N/A"}</span>
      </div>
      ${r.symptoms ? `<p><strong>Sintomas:</strong> ${r.symptoms}</p>` : ''}
      ${r.diagnosis ? `<p><strong>Diagnóstico:</strong> ${r.diagnosis}</p>` : ''}
      ${r.treatment ? `<p><strong>Tratamento:</strong> ${r.treatment}</p>` : ''}
      ${r.observations ? `<p><strong>Observações:</strong> ${r.observations}</p>` : ''}
      ${r.digitalSignature ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:0.8em;">✓ Assinado Digitalmente</span>' : ''}
    </div>
  `).join("");

  const prescriptionsHtml = data.prescriptionsList.map(rx => {
    const items = data.prescriptionItemsList.filter(i => i.prescriptionId === rx.id);
    return `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <strong>Prescrição #${rx.prescriptionNumber}</strong>
          <span style="background:${rx.status === 'active' ? '#dcfce7' : '#fef3c7'};color:${rx.status === 'active' ? '#166534' : '#92400e'};padding:2px 8px;border-radius:4px;font-size:0.8em;">${rx.status}</span>
        </div>
        ${rx.diagnosis ? `<p style="color:#64748b;font-size:0.9em;">Diagnóstico: ${rx.diagnosis}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          <thead><tr style="background:#f1f5f9;"><th style="text-align:left;padding:4px 8px;font-size:0.85em;">Medicamento</th><th style="text-align:left;padding:4px 8px;font-size:0.85em;">Dosagem</th><th style="text-align:left;padding:4px 8px;font-size:0.85em;">Frequência</th><th style="text-align:left;padding:4px 8px;font-size:0.85em;">Duração</th></tr></thead>
          <tbody>${items.map(item => `<tr><td style="padding:4px 8px;font-size:0.85em;">${item.medication?.name || item.customMedication || 'N/A'}</td><td style="padding:4px 8px;font-size:0.85em;">${item.dosage}</td><td style="padding:4px 8px;font-size:0.85em;">${item.frequency}</td><td style="padding:4px 8px;font-size:0.85em;">${item.duration}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const examsHtml = data.exams.map(e => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
      <strong>${e.examType}</strong> <span style="color:#64748b;font-size:0.85em;">(${e.createdAt ? new Date(e.createdAt).toLocaleDateString("pt-BR") : "N/A"})</span>
      ${e.analyzedByAI ? ' <span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:0.75em;">IA</span>' : ''}
      <pre style="background:#f8fafc;padding:8px;border-radius:4px;font-size:0.8em;overflow:auto;max-height:200px;">${typeof e.results === 'object' ? JSON.stringify(e.results, null, 2) : e.results}</pre>
    </div>
  `).join("");

  const inferencesHtml = data.inferences.map(inf => {
    const hyps = Array.isArray(inf.hypotheses) ? inf.hypotheses as any[] : [];
    return `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;">
          <strong>Inferência Diagnóstica</strong>
          <span style="background:${inf.reviewStatus === 'approved' ? '#dcfce7' : '#fef3c7'};color:${inf.reviewStatus === 'approved' ? '#166534' : '#92400e'};padding:2px 8px;border-radius:4px;font-size:0.8em;">${inf.reviewStatus} (${inf.overallConfidence}%)</span>
        </div>
        ${hyps.map((h: any) => `<p style="margin:4px 0;font-size:0.9em;">• <strong>${h.code || 'N/A'}</strong> (${h.system || 'N/A'}): ${h.description || 'N/A'} — ${h.confidence || 0}%</p>`).join("")}
      </div>
    `;
  }).join("");

  const referralsHtml = data.referrals.map(ref => `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
      <strong>${ref.specialty}</strong> — <span style="font-size:0.85em;">${ref.urgency}</span>
      <p style="font-size:0.9em;color:#64748b;">${ref.reason}</p>
      ${ref.clinicalSummary ? `<p style="font-size:0.85em;"><em>Resumo clínico:</em> ${ref.clinicalSummary}</p>` : ''}
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Prontuário Digital — ${patientName}</title>
  <style>
    @page { margin: 20mm; size: A4; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.5; max-width: 210mm; margin: 0 auto; padding: 20px; }
    h1 { color: #0f172a; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; }
    h2 { color: #1e40af; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .header { background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.75em; margin: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
    .info-item { background: #f8fafc; padding: 8px 12px; border-radius: 6px; }
    .info-label { font-size: 0.8em; color: #64748b; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 2px solid #e2e8f0; font-size: 0.8em; color: #94a3b8; text-align: center; }
    p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="color:white;border:none;margin:0;">Tele&lt;M3D&gt; Pro — Prontuário Digital Eletrônico</h1>
    <p style="margin:4px 0 12px;">Padrão: ${standardLabels[standard]}</p>
    <div>${complianceBadges[standard].map(b => `<span class="badge">${b}</span>`).join(" ")}</div>
  </div>

  <h2>1. Dados do Paciente</h2>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Nome</span><br><strong>${patientName}</strong></div>
    <div class="info-item"><span class="info-label">Data de Nascimento</span><br><strong>${patientDob}</strong></div>
    <div class="info-item"><span class="info-label">Gênero</span><br><strong>${p.gender || "N/A"}</strong></div>
    <div class="info-item"><span class="info-label">Tipo Sanguíneo</span><br><strong>${p.bloodType || "N/A"}</strong></div>
    <div class="info-item"><span class="info-label">Telefone</span><br><strong>${patientPhone}</strong></div>
    <div class="info-item"><span class="info-label">E-mail</span><br><strong>${patientEmail}</strong></div>
    <div class="info-item"><span class="info-label">Alergias</span><br><strong>${p.allergies || "Nenhuma registrada"}</strong></div>
    <div class="info-item"><span class="info-label">Status de Saúde</span><br><strong>${p.healthStatus}</strong></div>
  </div>

  <h2>2. Prontuários Médicos (${data.records.length})</h2>
  ${data.records.length > 0 ? recordsHtml : '<p style="color:#94a3b8;">Nenhum prontuário registrado.</p>'}

  <h2>3. Prescrições (${data.prescriptionsList.length})</h2>
  ${data.prescriptionsList.length > 0 ? prescriptionsHtml : '<p style="color:#94a3b8;">Nenhuma prescrição registrada.</p>'}

  <h2>4. Resultados de Exames (${data.exams.length})</h2>
  ${data.exams.length > 0 ? examsHtml : '<p style="color:#94a3b8;">Nenhum exame registrado.</p>'}

  <h2>5. Inferências Diagnósticas (${data.inferences.length})</h2>
  ${data.inferences.length > 0 ? inferencesHtml : '<p style="color:#94a3b8;">Nenhuma inferência registrada.</p>'}

  <h2>6. Encaminhamentos (${data.referrals.length})</h2>
  ${data.referrals.length > 0 ? referralsHtml : '<p style="color:#94a3b8;">Nenhum encaminhamento registrado.</p>'}

  <h2>7. Consultas (${data.appointmentsList.length})</h2>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Data</th><th style="text-align:left;padding:6px;">Tipo</th><th style="text-align:left;padding:6px;">Status</th><th style="text-align:left;padding:6px;">Médico</th></tr></thead>
    <tbody>${data.appointmentsList.map(a => `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">${a.scheduledAt ? new Date(a.scheduledAt).toLocaleDateString("pt-BR") : "N/A"}</td><td style="padding:6px;">${a.type}</td><td style="padding:6px;">${a.status}</td><td style="padding:6px;">${data.doctorNames[a.doctorId] || "N/A"}</td></tr>`).join("")}
    ${data.appointmentsList.length === 0 ? '<tr><td colspan="4" style="padding:6px;color:#94a3b8;">Nenhuma consulta registrada.</td></tr>' : ''}
    </tbody>
  </table>

  <h2>8. Metadados FHIR</h2>
  <div class="info-grid">
    <div class="info-item"><span class="info-label">Bundle ID</span><br><strong>${bundle.id}</strong></div>
    <div class="info-item"><span class="info-label">Total de Recursos</span><br><strong>${bundle.total}</strong></div>
    <div class="info-item"><span class="info-label">Gerado em</span><br><strong>${now}</strong></div>
    <div class="info-item"><span class="info-label">Versão FHIR</span><br><strong>R4 (4.0.1)</strong></div>
  </div>

  <div class="footer">
    <p>Documento gerado automaticamente pelo sistema Tele&lt;M3D&gt; Pro</p>
    <p>Padrão de interoperabilidade: ${standardLabels[standard]}</p>
    ${standard === 'fhir-br' ? '<p>Em conformidade com a Portaria GM/MS nº 1.434/2020 (RNDS) e normas SBIS/CFM</p>' : ''}
    ${standard === 'fhir-us' ? '<p>Compliant with 21st Century Cures Act, ONC Final Rule, and HIPAA Privacy Rule (45 CFR §164)</p>' : ''}
    ${standard === 'fhir-eu' ? '<p>Compliant with GDPR (EU 2016/679) and European Patient Summary guidelines</p>' : ''}
    <p>Este documento NÃO substitui a avaliação médica presencial quando necessária.</p>
  </div>
</body>
</html>`;
}

function getPatientProfile(standard: ExportStandard): string[] {
  switch (standard) {
    case 'fhir-br': return ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRIndividuo-1.0"];
    case 'fhir-us': return ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"];
    case 'fhir-eu': return ["http://hl7.eu/fhir/StructureDefinition/Patient-eu"];
    default: return ["http://hl7.org/fhir/StructureDefinition/Patient"];
  }
}

function getEncounterProfile(standard: ExportStandard): string[] {
  switch (standard) {
    case 'fhir-br': return ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRContatoAssistencial-1.0"];
    case 'fhir-us': return ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter"];
    default: return ["http://hl7.org/fhir/StructureDefinition/Encounter"];
  }
}

function getConditionProfile(standard: ExportStandard): string[] {
  switch (standard) {
    case 'fhir-br': return ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRDiagnosticoAvaliado-1.0"];
    case 'fhir-us': return ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns"];
    default: return ["http://hl7.org/fhir/StructureDefinition/Condition"];
  }
}

function getMedicationRequestProfile(standard: ExportStandard): string[] {
  switch (standard) {
    case 'fhir-br': return ["http://www.saude.gov.br/fhir/r4/StructureDefinition/BRPrescricaoMedicamento-1.0"];
    case 'fhir-us': return ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"];
    default: return ["http://hl7.org/fhir/StructureDefinition/MedicationRequest"];
  }
}

function getDiagnosticReportProfile(standard: ExportStandard): string[] {
  switch (standard) {
    case 'fhir-us': return ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab"];
    default: return ["http://hl7.org/fhir/StructureDefinition/DiagnosticReport"];
  }
}

function mapGender(gender: string): string {
  const g = gender.toLowerCase();
  if (g === "masculino" || g === "male" || g === "m") return "male";
  if (g === "feminino" || g === "female" || g === "f") return "female";
  if (g === "outro" || g === "other") return "other";
  return "unknown";
}

function mapEncounterStatus(status: string): string {
  switch (status) {
    case "completed": return "finished";
    case "scheduled": return "planned";
    case "cancelled": return "cancelled";
    case "rescheduled": return "cancelled";
    default: return "unknown";
  }
}

function mapAppointmentType(type: string): string {
  switch (type) {
    case "consultation": return "11429006";
    case "followup": return "185389009";
    case "emergency": return "50849002";
    default: return "11429006";
  }
}

function mapPrescriptionStatus(status: string): string {
  switch (status) {
    case "active": return "active";
    case "dispensed": return "completed";
    case "cancelled": return "cancelled";
    case "expired": return "stopped";
    default: return "active";
  }
}

function mapLabStatus(status: string): string {
  switch (status) {
    case "completed": return "final";
    case "processing": return "preliminary";
    case "ordered": return "registered";
    case "cancelled": return "cancelled";
    default: return "registered";
  }
}

function mapReferralStatus(status: string): string {
  switch (status) {
    case "completed": return "completed";
    case "accepted": return "active";
    case "rejected": return "revoked";
    case "pending": return "draft";
    default: return "draft";
  }
}

export async function exportPatientData(patientId: string, options: ExportOptions): Promise<{ bundle: any; html?: string }> {
  const data = await aggregatePatientData(patientId);
  const bundle = buildFhirBundle(data, options);

  if (options.format === 'pdf') {
    const html = generatePdfHtml(data, bundle, options);
    return { bundle, html };
  }

  return { bundle };
}

export const patientExportService = { exportPatientData };

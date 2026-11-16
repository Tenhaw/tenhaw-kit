/** Vendor-neutral adaptation of Tenhaw's authored AI RFP framework.
 * Content: CC BY 4.0.
 * Source: https://tenhaw.com/tools/ai-rfp-template
 * Changes: supplier answers and prices removed; hosting, residency and sector criteria generalised.
 */
export type Requirement = { id:string; category:string; name:string; question:string; good:string; why:string; three:string; must:boolean };
export const requirements: readonly Requirement[] = [
  {
    "id": "people-screening",
    "category": "people",
    "name": "Screening before access",
    "question": "How are the people who will work in our systems screened, to what standard, and is screening complete before their first access?",
    "good": "A named standard, such as BS7858, the checks it covers, the same treatment for employees and subcontractors, and the point at which screening is complete.",
    "why": "Consultants work inside your systems and with your data, so the first control is who they are and what has been checked about them.",
    "three": "A named standard, every check listed, employees and subcontractors treated alike, and screening complete before any access.",
    "must": true
  },
  {
    "id": "people-team",
    "category": "people",
    "name": "Who does the work",
    "question": "Who exactly will do the work, how senior are they, and who is accountable for the engagement?",
    "good": "Named people or roles with their seniority, the one person accountable for delivery, and how the supplier selects anyone it brings in. Check that the people presenting the proposal are the people who will do the work.",
    "why": "A price tells you little until you know who is doing the work, and accountability decides who answers when something goes wrong.",
    "three": "Named people or roles, seniority stated, one accountable lead, and the people who presented are the people who deliver.",
    "must": false
  },
  {
    "id": "people-substitution",
    "category": "people",
    "name": "Replacing a named person",
    "question": "If a named person is replaced during the engagement, what notice do we get, who can replace them, and who pays for the handover?",
    "good": "Notice before any change, a replacement of equivalent skill and seniority, the supplier remaining responsible for the work, and the handover carried at the supplier's cost.",
    "why": "The team you evaluate is part of what you are buying, so the contract should say what happens if it changes.",
    "three": "Notice before any change, equivalent seniority, the supplier responsible for quality, and the handover at its cost.",
    "must": false
  },
  {
    "id": "people-confidentiality",
    "category": "people",
    "name": "Confidentiality",
    "question": "How long do confidentiality obligations last, and is every individual with access, including subcontractors, bound in writing before they start?",
    "good": "Obligations that survive the end of the engagement, written confidentiality for every person with access, and whether the supplier may name you as a client without your consent.",
    "why": "Your information outlives the contract, so the duty to protect it should too.",
    "three": "Obligations survive termination, every individual bound in writing before access, and no use of your name without consent.",
    "must": false
  },
  {
    "id": "data-location",
    "category": "data",
    "name": "Where the work is done",
    "question": "Where will our code, documents and data be processed during delivery, and what will be returned or deleted when the engagement ends?",
    "good": "An agreed hosting architecture, authorised processing locations, approved copies and a tested return or deletion plan.",
    "why": "An explicit processing and exit design makes responsibilities clear across client-controlled and supplier-controlled systems.",
    "three": "The hosting architecture is approved, copies are documented and authorised, and return or deletion responsibilities are clear.",
    "must": false
  },
  {
    "id": "data-residency",
    "category": "data",
    "name": "Data residency",
    "question": "In which countries will our data be processed, and how will you meet our documented residency and transfer requirements?",
    "good": "Named processing locations, available residency choices and a matching answer for each sub-processor and model provider.",
    "why": "Documented processing locations help your organisation assess its own contractual, policy and legal requirements.",
    "three": "Processing countries are named, exceptions are explicit and the answer covers every relevant sub-processor and model provider.",
    "must": true
  },
  {
    "id": "data-subprocessors",
    "category": "data",
    "name": "Sub-processors",
    "question": "Which sub-processors will touch our data, in which locations and under which transfer mechanisms, and how will we be told before one is added?",
    "good": "A list giving entity, location, purpose and transfer mechanism for each, annexed to the data processing agreement, with notice of changes written into the contract.",
    "why": "The supplier you assess may not be the only company that handles your data. The list and the change-notice terms tell you who else does.",
    "three": "A published list with entity, location, purpose and mechanism, annexed to the agreement, and change notice written into the contract.",
    "must": false
  },
  {
    "id": "data-ai",
    "category": "data",
    "name": "AI tools and model providers",
    "question": "Which AI tools and model providers will touch our content, who approves them, and can any of them retain it or train on it?",
    "good": "Named tools, your written approval before any content goes in, and the retention and training terms of each provider agreement.",
    "why": "AI-assisted delivery puts your code and documents into third-party systems. The approval rule and the retention terms decide whether that is under your control.",
    "three": "Named tools only, your written approval first, zero-retention or enterprise terms, and no training on your content.",
    "must": true
  },
  {
    "id": "data-breach",
    "category": "data",
    "name": "Breach notification",
    "question": "How quickly will you notify us of a personal data breach affecting our data, and in which document is that commitment written?",
    "good": "A notification time in hours, written as a term of the data processing agreement, with the route to your named contact and a written report to follow.",
    "why": "Supplier notification time affects your ability to investigate and respond. Agree the required timeline and notification route with your legal and security teams.",
    "three": "A time in hours, written into the data processing agreement, with a named route and a written report.",
    "must": true
  },
  {
    "id": "ip-ownership",
    "category": "ip",
    "name": "Ownership of the work",
    "question": "Who owns the deliverables, code and documentation, when does ownership pass to us, and what licence do we receive to anything of the supplier's that is embedded in them?",
    "good": "Ownership of everything created specifically for you, the point at which it passes, a perpetual licence to any supplier material embedded in the deliverables, and no claim on anything in your environment.",
    "why": "The ownership clause decides whether you can change supplier, or change the system yourselves, without asking permission.",
    "three": "You own everything made for you, the trigger is stated, embedded supplier material is licensed perpetually, and nothing in your environment is claimed.",
    "must": true
  },
  {
    "id": "ip-handover",
    "category": "ip",
    "name": "Handover to your own team",
    "question": "How will our own people learn to run and change what you build, and what does the handover contain?",
    "good": "Your engineers working alongside the supplier's during the build, a documented handover to named owners on your side, and a date from which you can run the system without the supplier.",
    "why": "A system only the supplier understands keeps you dependent on that supplier, whatever the contract says about ownership.",
    "three": "Your people build alongside the supplier's, the handover is documented to named owners, and there is a date you can run it alone.",
    "must": false
  },
  {
    "id": "ip-exit",
    "category": "ip",
    "name": "Ending the engagement",
    "question": "How can either side end the engagement, what notice applies, and what do we receive on the day it ends?",
    "good": "A notice period for monthly work, a termination right for fixed-price work and what is payable on it, all work product to date including code in your environment, and deletion of your data on a stated basis.",
    "why": "The cost of an engagement that is not working is the notice period plus whatever you cannot take with you, and both should be known before a contract is signed.",
    "three": "Short mutual notice, all work product and documentation handed over, and your data deleted on a stated basis.",
    "must": true
  },
  {
    "id": "com-rates",
    "category": "commercial",
    "name": "Published rates",
    "question": "Do you publish your rates, and what is each price in your proposal derived from?",
    "good": "Day rates by grade, the people-days by grade and the calendar each price assumes, and what the price excludes. For a fixed price, a written definition of done.",
    "why": "A day rate is not a cost until you also hold people-days by grade and a calendar, so require both from every bidder.",
    "three": "Rates by grade, people-days and calendar stated, exclusions listed, and done defined in writing.",
    "must": false
  },
  {
    "id": "com-model",
    "category": "commercial",
    "name": "Margin on model and platform costs",
    "question": "Do you add margin to model, platform or licence costs, and whose accounts do those costs sit on?",
    "good": "A direct answer on margin, where each cost is billed, and the run costs to expect: model inference, the platform, storage and search, evaluation and monitoring, and human review time.",
    "why": "Run costs continue after the build. If the supplier earns a margin on them, its interest in how the system is designed and yours can pull apart.",
    "three": "No mark-up, costs on your own accounts, and every run-cost line named.",
    "must": false
  },
  {
    "id": "com-payment",
    "category": "commercial",
    "name": "Payment terms",
    "question": "What is the invoicing basis, and what is the payment period?",
    "good": "The invoicing basis for fixed-price and monthly work, a stated payment period, whether VAT and expenses are included, and how expenses are approved.",
    "why": "Payment terms feed your cash flow and your milestone definitions, so they should match how the work will be delivered.",
    "three": "Basis and period stated, VAT and expenses treatment explicit, and milestones tied to evidence.",
    "must": false
  },
  {
    "id": "com-liability",
    "category": "commercial",
    "name": "Liability",
    "question": "What is the liability cap, how is it set, and which obligations sit outside it?",
    "good": "A figure or formula for the cap, the standard exceptions for death, personal injury and fraud, and separate treatment of confidentiality and data protection.",
    "why": "The cap is the most you can recover, so check it against what a serious failure would cost you.",
    "three": "The cap stated as a figure, the exceptions listed, and confidentiality and data protection treated separately.",
    "must": true
  },
  {
    "id": "com-insurance",
    "category": "commercial",
    "name": "Insurance",
    "question": "What insurance do you hold, at what limits, and can a limit be increased for our engagement?",
    "good": "Each line with its limit (professional indemnity, public liability, employers' liability, cyber and legal expenses), current certificates, and how and how quickly a limit can be raised.",
    "why": "Your supplier standard may set a floor, most often on professional indemnity, and knowing the figures early avoids a late surprise.",
    "three": "Every line in figures, certificates supplied, and a stated route and timescale for higher limits.",
    "must": true
  },
  {
    "id": "eval-criteria",
    "category": "assurance",
    "name": "Acceptance criteria",
    "question": "How will we agree what good looks like before the build, and who owns the pass thresholds?",
    "good": "A ground-truth set and pass thresholds agreed with your business owner during design, which then become the release gate. Be wary of a guaranteed accuracy figure offered before the supplier has seen your data.",
    "why": "If you cannot state the acceptance criteria, you cannot manage the work. Agreeing them early also settles in advance the argument about whether it works.",
    "three": "A ground-truth set and thresholds agreed with your business owner before the build, and used as the release gate.",
    "must": false
  },
  {
    "id": "eval-stop",
    "category": "assurance",
    "name": "The stopping condition",
    "question": "What finding would make you tell us not to proceed, and who has the authority to hold a release?",
    "good": "A stated stopping condition, a named assurance owner outside the build team with the authority to hold a release, and an example of a time the supplier advised a client not to ship.",
    "why": "A supplier that has never advised against shipping has not shown you how it behaves when the evidence is bad.",
    "three": "A specific stopping condition, a named owner outside the build team, and a real example.",
    "must": false
  },
  {
    "id": "eval-governance",
    "category": "assurance",
    "name": "Accountability and audit trail",
    "question": "Who in our organisation will be accountable for each class of decision an agent makes, and what records will the system keep while it runs?",
    "good": "Each class of agent decision mapped to a named person with matching authority, your risk function involved during design, and records of what the agent was asked, what it retrieved, which tools it called, what it decided and who approved or overrode it.",
    "why": "When an agent's decision is questioned, someone in your organisation has to answer for it, and records the system keeps as it runs cost far less than evidence assembled afterwards.",
    "three": "Every class of decision has a named owner, the risk function is involved in design, and a past decision can be reconstructed from the system's own records.",
    "must": false
  },
  {
    "id": "eval-code",
    "category": "assurance",
    "name": "Checks on AI-built code",
    "question": "How is AI-generated code checked before it ships, and who tests the finished system independently?",
    "good": "Static analysis, dependency and secrets scanning on every build, human review before merge, a software bill of materials for what ships, and independent penetration testing scoped to the code delivered.",
    "why": "AI-assisted delivery can produce code faster than people can read it, so the checks have to run in the pipeline rather than depend on someone remembering.",
    "three": "Scanning on every commit and build, human review before merge, a bill of materials and an independent penetration test.",
    "must": false
  },
  {
    "id": "eval-agent-access",
    "category": "assurance",
    "name": "Agent identity and access",
    "question": "How is each agent's access limited, how do we revoke it, who is authorised to do that, and when was it last tested?",
    "good": "A distinct identity for each agent, least privilege at the level of the workflow with time-boxed credentials, every action attributable to an agent and to the person accountable for it, and a named person with a tested way to revoke access immediately.",
    "why": "The first thing a security team asks is how to switch an agent off, and the second is how much damage it could do if it were manipulated.",
    "three": "Distinct agent identities, least privilege with expiry, full attribution, and a revocation path that has been tested.",
    "must": false
  },
  {
    "id": "ev-references",
    "category": "evidence",
    "name": "References",
    "question": "Which delivered engagements can we check, is each one labelled production, pilot or proof of concept, and what happened after your team left?",
    "good": "Named clients with outcomes you can check, each engagement labelled production, pilot or proof of concept, and reference calls that cover whether the system is still running, who runs it now, what it cost to run in year two and how much of the client's own people's time it took.",
    "why": "A reference call tells you what happened after the supplier left, which no proposal can.",
    "three": "Named references, every engagement labelled, and reference calls that answer the year-two questions.",
    "must": false
  },
  {
    "id": "ev-certs",
    "category": "evidence",
    "name": "Certifications",
    "question": "Which security certifications do you hold, which are in progress, and what are the dates?",
    "good": "A clear split between certificates held and certificates in progress, with the scope and date of each, and the controls that stand in for any certificate not yet held.",
    "why": "Certificates in progress, policies and gap assessments all have value, and none of them is a certificate. Asking for the split in writing keeps them apart.",
    "three": "Held and in progress listed separately, with scope and dates, and evidence available on request.",
    "must": false
  },
  {
    "id": "ev-onboarding",
    "category": "evidence",
    "name": "The onboarding pack",
    "question": "Can we see your master services agreement, statement of work template, data processing agreement, insurance certificates and completed security questionnaires before we shortlist?",
    "good": "The documents themselves rather than a description of them, sent within days, with a named contact for questions.",
    "why": "Your legal and security reviewers work from documents, and seeing them before shortlisting shows early where the redlines will be.",
    "three": "Every document supplied as a file, within days, from a named contact.",
    "must": false
  },
  {
    "id": "sector-financial",
    "category": "sector",
    "name": "ICT third-party risk",
    "question": "How will you support the audit, access, subcontracting, continuity and exit requirements our organisation identifies for this engagement?",
    "good": "A response against the buyer’s documented requirements, contract wording where requested, subcontracting visibility and explicit limitations.",
    "why": "Financial services buyers need evidence against their own applicable third-party risk requirements and approval process.",
    "three": "Each buyer requirement has supporting evidence or draft terms, with ownership and limitations stated.",
    "must": true
  },
  {
    "id": "sector-public",
    "category": "sector",
    "name": "Transparency record and approval path",
    "question": "How will you support our organisation’s transparency record, impact assessment and approval process for this use of AI?",
    "good": "A named owner, the records and supporting evidence the buyer requests, and a clear route through the buyer’s approval process.",
    "why": "Public bodies need information that supports accountable decisions and their own applicable publication and approval duties.",
    "three": "Responsibilities and evidence are mapped to the buyer’s transparency and approval process, with gaps stated.",
    "must": true
  },
  {
    "id": "sector-retail",
    "category": "sector",
    "name": "Peak trading freezes",
    "question": "How does the supplier's plan handle your peak trading freezes, and what is delivered before and during them?",
    "good": "A dated plan that shows your freeze windows, releases that ship and stabilise before each freeze, useful work during a freeze that needs no deployment, and what happens if a freeze moves.",
    "why": "Peak trading freezes remove roughly a quarter of the delivery year, so sequencing around them is a design constraint rather than a scheduling detail.",
    "three": "Freeze windows on the plan, releases sequenced around them, and a stated response if one moves.",
    "must": false
  },
  {
    "id": "sector-industrial",
    "category": "sector",
    "name": "The control domain and the safety case",
    "question": "Will any agent cross the boundary between corporate IT and the control domain, and how is the first workflow kept clear of the operational safety case?",
    "good": "A clear line between back-office workflows and anything adjacent to operational safety, read-only access by default across the IT and OT boundary, and your OT security function designing any path that crosses it.",
    "why": "Anything adjacent to operational safety carries a governance burden that back-office automation does not, because the safety case is the argument that permits the asset to operate.",
    "three": "Workflows sorted by safety exposure, read-only by default across the boundary, and a first workflow clear of the safety case.",
    "must": true
  }
];
